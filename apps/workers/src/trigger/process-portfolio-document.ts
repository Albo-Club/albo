/**
 * Trigger.dev Task: Process Portfolio Document
 *
 * Quand un fichier est uploadé dans portfolio_documents :
 * 1. Télécharge le fichier depuis Supabase Storage
 * 2. Extrait le contenu (PDF → Mistral OCR, Excel → XLSX parser, Image → Mistral OCR)
 * 3. Stocke text_content dans portfolio_documents
 * 4. Extrait les métriques (Claude Haiku) pour TOUS les types → portfolio_company_metrics (source='document_upload')
 * 5. Chunk le contenu dans deck_embeddings (pour le contexte agent)
 *
 * Déclenché par : DB trigger → edge function process-document-webhook → tasks.trigger()
 */

import { schemaTask, logger, metadata, tags } from "@trigger.dev/sdk";
import { z } from "zod";
import { supabase } from "../lib/supabase.js";
import { extractPdf } from "../steps/extract-pdf.js";
import { extractImage } from "../steps/extract-image.js";
import { extractExcel } from "../steps/extract-excel.js";
import { extractDocumentMetrics } from "../steps/extract-excel-metrics.js";
import type { ExtractedMetric } from "../steps/extract-excel-metrics.js";
import { normalizeMetricsForDb } from "../lib/metric-aliases.js";
import { curateDisplayMetrics } from "../steps/report/curate-display-metrics.js";

const CHUNK_SIZE = 2000; // chars per chunk for deck_embeddings

export const processPortfolioDocumentTask = schemaTask({
  id: "process-portfolio-document",
  schema: z.object({
    document_id: z.string().uuid(),
    company_id: z.string().uuid(),
    storage_path: z.string(),
    mime_type: z.string(),
    file_name: z.string(),
    /** Bucket where the file is stored. Defaults to looking up from DB. */
    source_bucket: z.string().optional(),
  }),
  queue: { concurrencyLimit: 3 },
  retry: { maxAttempts: 3 },

  run: async (payload) => {
    const { document_id, company_id, storage_path, mime_type, file_name } = payload;

    logger.info("Processing portfolio document", { document_id, file_name, mime_type });
    await tags.add(`company:${company_id}`);
    await tags.add(`doc:${document_id}`);
    metadata.set("status", "downloading");
    metadata.set("fileName", file_name);
    metadata.set("documentId", document_id);

    // 1. Resolve the bucket (payload > DB > fallback to report-files then portfolio-documents)
    let bucket = payload.source_bucket;
    if (!bucket) {
      const { data: doc } = await supabase
        .from("portfolio_documents")
        .select("source_bucket")
        .eq("id", document_id)
        .single();
      bucket = doc?.source_bucket || undefined;
    }

    // Try the resolved bucket, then fallback to the other one
    const primaryBucket = bucket || "report-files";
    const fallbackBucket = primaryBucket === "report-files" ? "portfolio-documents" : "report-files";

    let fileData: Blob | null = null;
    const { data: d1, error: e1 } = await supabase.storage
      .from(primaryBucket)
      .download(storage_path);

    if (d1) {
      fileData = d1;
      logger.info(`Downloaded from bucket "${primaryBucket}"`);
    } else {
      logger.warn(`Download from "${primaryBucket}" failed: ${e1?.message}, trying "${fallbackBucket}"`);
      const { data: d2, error: e2 } = await supabase.storage
        .from(fallbackBucket)
        .download(storage_path);
      if (d2) {
        fileData = d2;
        logger.info(`Downloaded from fallback bucket "${fallbackBucket}"`);
        // Fix the source_bucket in DB for future lookups
        await supabase
          .from("portfolio_documents")
          .update({ source_bucket: fallbackBucket })
          .eq("id", document_id);
      } else {
        throw new Error(`[process-doc] Download failed from both buckets. ${primaryBucket}: ${e1?.message}, ${fallbackBucket}: ${e2?.message}`);
      }
    }

    const buffer = Buffer.from(await fileData.arrayBuffer());
    logger.info("Downloaded file", { size: buffer.length, path: storage_path });
    metadata.set("status", "extracting");

    // 2. Extract content based on MIME type
    let textContent = "";
    let metricsCount = 0;
    let regexMetrics: ExtractedMetric[] = []; // Excel-only: regex-parsed metrics

    const lowerName = file_name.toLowerCase();
    const isPdf = mime_type === "application/pdf" || lowerName.endsWith(".pdf");
    const isExcel = mime_type.includes("spreadsheet") || mime_type.includes("excel") ||
      lowerName.endsWith(".xlsx") || lowerName.endsWith(".xls") || lowerName.endsWith(".csv");
    const isImage = mime_type.startsWith("image/") ||
      lowerName.endsWith(".png") || lowerName.endsWith(".jpg") || lowerName.endsWith(".jpeg") ||
      lowerName.endsWith(".webp");

    if (isPdf) {
      textContent = await extractPdf(buffer, file_name);
      logger.info("PDF extracted", { chars: textContent.length });
    } else if (isExcel) {
      const excelResult = extractExcel(buffer, file_name);
      textContent = excelResult.extractedText;
      regexMetrics = excelResult.metricsForDb as ExtractedMetric[];
      logger.info("Excel extracted", {
        sheets: excelResult.sheetCount,
        rows: excelResult.rowCount,
        chars: textContent.length,
      });
    } else if (isImage) {
      textContent = await extractImage(buffer, mime_type, file_name);
      logger.info("Image OCR extracted", { chars: textContent.length });
    } else {
      logger.warn("Unsupported file type, storing as-is", { mime_type });
    }

    // 3. Extract metrics via Claude Haiku (for ALL document types with text)
    // Skip if this document was already processed by report-frontend (avoid double extraction)
    const { data: docMeta } = await supabase
      .from("portfolio_documents")
      .select("source_report_id")
      .eq("id", document_id)
      .single();
    const hasReportSource = !!docMeta?.source_report_id;

    if (hasReportSource) {
      logger.info("Skipping metric extraction: document already processed by report-frontend", {
        source_report_id: docMeta.source_report_id,
      });
    } else if (textContent && textContent.length >= 20) {
      metadata.set("status", "extracting_metrics");
      try {
        const claudeMetrics = await extractDocumentMetrics(textContent, file_name);

        // Merge regex metrics (Excel only) + Claude metrics, deduplicate
        const allMetrics = [...regexMetrics];
        const existingKeys = new Set(regexMetrics.map(
          (m) => `${m.metric_key}|${m.report_period}`
        ));
        for (const cm of claudeMetrics) {
          if (!existingKeys.has(`${cm.metric_key}|${cm.report_period}`)) {
            allMetrics.push(cm);
          }
        }

        // Normalize: canonical keys + enrich periods with year
        const normalizedMetrics = normalizeMetricsForDb(allMetrics, file_name);

        if (normalizedMetrics.length > 0) {
          const { error: metricsError } = await supabase
            .from("portfolio_company_metrics")
            .upsert(
              normalizedMetrics.map((m) => ({
                company_id,
                metric_key: m.metric_key,
                metric_value: m.metric_value,
                metric_type: m.metric_type,
                report_period: m.report_period,
                canonical_key: m.canonical_key,
                metric_category: m.metric_category,
                period_sort_date: m.period_sort_date,
                source: "document_upload",
                source_document_id: document_id,
              })),
              { onConflict: "company_id,metric_key,report_period" }
            );

          if (metricsError) {
            logger.error("Metrics upsert failed", { error: metricsError.message });
          } else {
            metricsCount = normalizedMetrics.length;
            logger.info("Metrics upserted", { count: metricsCount });

            // Denormalize: merge into portfolio_companies.latest_metrics for frontend display
            const latestMetricsFlat: Record<string, number> = {};
            for (const m of normalizedMetrics) {
              const numVal = parseFloat(m.metric_value);
              if (!isNaN(numVal)) latestMetricsFlat[m.metric_key] = numVal;
            }

            if (Object.keys(latestMetricsFlat).length > 0) {
              const { data: company } = await supabase
                .from("portfolio_companies")
                .select("latest_metrics")
                .eq("id", company_id)
                .single();

              const merged = { ...(company?.latest_metrics as Record<string, number> || {}), ...latestMetricsFlat };

              const { error: lmError } = await supabase
                .from("portfolio_companies")
                .update({ latest_metrics: merged })
                .eq("id", company_id);

              if (lmError) {
                logger.error("latest_metrics update failed", { error: lmError.message });
              } else {
                logger.info("latest_metrics updated", { keys: Object.keys(latestMetricsFlat).length });
              }
            }
          }
        } else {
          logger.info("No metrics found in document");
        }
      } catch (err: any) {
        logger.error("Metric extraction failed (non-blocking)", { error: err.message });
      }
    }

    // Curate display metrics if any were upserted
    if (metricsCount > 0) {
      metadata.set("status", "curating_metrics");
      await curateDisplayMetrics(company_id);
    }

    if (!textContent) {
      logger.warn("No content extracted", { file_name });
      metadata.set("status", "completed_empty");
      return { document_id, textContent: "", metricsCount: 0, chunksCount: 0 };
    }

    // 4. Store text_content in portfolio_documents
    metadata.set("status", "storing");
    const { error: updateError } = await supabase
      .from("portfolio_documents")
      .update({ text_content: textContent })
      .eq("id", document_id);

    if (updateError) {
      logger.error("text_content update failed", { error: updateError.message });
    }

    // 5. Chunk content and store in deck_embeddings
    // (sans embedding vector — le contenu text est lu directement par fetchFullContext)
    metadata.set("status", "chunking");
    const chunks = chunkText(textContent, CHUNK_SIZE);

    // Delete existing chunks for this document (in case of re-processing)
    await supabase
      .from("deck_embeddings")
      .delete()
      .eq("document_id", document_id);

    // Insert new chunks
    const chunkRows = chunks.map((content, index) => ({
      company_id,
      document_id,
      file_name,
      storage_path,
      chunk_index: index,
      content,
      total_chunks: chunks.length,
      processing_status: "completed",
      metadata: {
        source: "document_upload",
        mime_type,
        original_file_name: file_name,
      },
    }));

    if (chunkRows.length > 0) {
      const { error: chunkError } = await supabase
        .from("deck_embeddings")
        .insert(chunkRows);

      if (chunkError) {
        logger.error("Chunk insert failed", { error: chunkError.message });
      } else {
        logger.info("Chunks stored", { count: chunkRows.length });
      }
    }

    metadata.set("status", "completed");
    logger.info("Document processing complete", {
      document_id,
      file_name,
      textChars: textContent.length,
      metricsCount,
      chunksCount: chunks.length,
    });

    return {
      document_id,
      file_name,
      textChars: textContent.length,
      metricsCount,
      chunksCount: chunks.length,
    };
  },
});

/**
 * Split text into chunks of ~maxChars, splitting on paragraph boundaries.
 */
function chunkText(text: string, maxChars: number): string[] {
  if (text.length <= maxChars) return [text];

  const chunks: string[] = [];
  const paragraphs = text.split(/\n\n+/);
  let current = "";

  for (const para of paragraphs) {
    if (current.length + para.length + 2 > maxChars && current.length > 0) {
      chunks.push(current.trim());
      current = "";
    }
    current += (current ? "\n\n" : "") + para;
  }
  if (current.trim()) chunks.push(current.trim());

  return chunks;
}
