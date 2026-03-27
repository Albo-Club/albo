/**
 * Step: Extract Report Content
 * Route chaque fichier vers le bon extracteur (PDF, Excel, Image)
 * et accumule le contenu OCR + les métriques Excel.
 */

import { logger } from "@trigger.dev/sdk";
import { extractPdf } from "../extract-pdf.js";
import { extractExcel, type ExcelMetric } from "../extract-excel.js";
import { extractImage } from "../extract-image.js";
import type { FileToStore } from "../store-files.js";
import type { DownloadedFile } from "./download-report-files.js";

const EXCEL_EXTENSIONS = ["xlsx", "xls", "xlsm"];
const IMAGE_EXTENSIONS = ["png", "jpg", "jpeg", "gif", "webp", "bmp", "tiff"];

export interface ExtractionResult {
  /** Contenu OCR combiné de tous les fichiers */
  ocrContent: string | null;
  /** Métriques regex extraites des Excel */
  excelMetrics: ExcelMetric[];
  /** Texte brut des Excel (pour extraction Claude Haiku) */
  allExcelTexts: string[];
  /** Fichiers prêts pour stockage en DB */
  filesToStore: FileToStore[];
}

export async function extractReportContent(
  downloadedFiles: DownloadedFile[],
  additionalContext?: string
): Promise<ExtractionResult> {
  let ocrContent: string | null = null;
  const excelMetrics: ExcelMetric[] = [];
  const extractedTexts = new Map<string, string>();
  const filesToStore: FileToStore[] = [];
  const allExcelTexts: string[] = [];

  for (const file of downloadedFiles) {
    const ext = file.extension;

    if (ext === "pdf") {
      try {
        const text = await extractPdf(file.buffer, file.name);
        extractedTexts.set(file.name, text);
        ocrContent = ocrContent ? `${ocrContent}\n\n---\n\n${text}` : text;
        logger.info(`PDF extracted: ${file.name} (${text.length} chars)`);
      } catch (err: any) {
        logger.error(`PDF extraction failed: ${file.name}`, { error: err.message });
      }
    } else if (EXCEL_EXTENSIONS.includes(ext)) {
      try {
        const result = extractExcel(file.buffer, file.name);
        extractedTexts.set(file.name, result.extractedText);
        excelMetrics.push(...result.metricsForDb);
        if (result.extractedText) allExcelTexts.push(`--- ${file.name} ---\n${result.extractedText}`);
        const excelText = result.llmPrompt || result.extractedText;
        ocrContent = ocrContent
          ? `${ocrContent}\n\n--- EXCEL (${file.name}) ---\n\n${excelText}`
          : excelText;
        logger.info(`Excel extracted: ${file.name} (${result.sheetCount} sheets, ${result.metricsForDb.length} metrics)`);
      } catch (err: any) {
        logger.error(`Excel extraction failed: ${file.name}`, { error: err.message });
      }
    } else if (IMAGE_EXTENSIONS.includes(ext)) {
      try {
        const text = await extractImage(file.buffer, file.mime, file.name);
        if (text) {
          extractedTexts.set(file.name, text);
          ocrContent = ocrContent
            ? `${ocrContent}\n\n--- IMAGE (${file.name}) ---\n\n${text}`
            : text;
        }
        logger.info(`Image extracted: ${file.name} (${text?.length || 0} chars)`);
      } catch (err: any) {
        logger.error(`Image extraction failed: ${file.name}`, { error: err.message });
      }
    }

    filesToStore.push({
      buffer: file.buffer,
      name: file.name,
      extension: file.extension,
      mime: file.mime,
      size: file.buffer.length,
      extractedText: extractedTexts.get(file.name),
    });
  }

  // Text-only : utiliser additional_context comme contenu principal
  if (!ocrContent && additionalContext) {
    ocrContent = additionalContext;
    logger.info(`Text-only mode: using additional_context (${additionalContext.length} chars)`);
  }

  return { ocrContent, excelMetrics, allExcelTexts, filesToStore };
}
