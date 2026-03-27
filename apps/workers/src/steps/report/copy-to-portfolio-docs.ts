/**
 * Step: Copy to Portfolio Documents
 * Copie les fichiers du report dans portfolio_documents/Reporting
 * pour qu'ils soient accessibles dans l'arborescence documents de la company.
 */

import { logger } from "@trigger.dev/sdk";
import { supabase } from "../../lib/supabase.js";
import type { FileToStore } from "../store-files.js";

export async function copyToPortfolioDocs(
  companyId: string,
  reportId: string,
  files: FileToStore[]
): Promise<void> {
  if (files.length === 0) return;

  try {
    // Trouver ou créer le dossier "Reporting"
    const { data: folders } = await supabase
      .from("portfolio_documents")
      .select("id")
      .eq("company_id", companyId)
      .eq("type", "folder")
      .eq("name", "Reporting")
      .is("parent_id", null)
      .limit(1);

    let folderId: string;
    if (folders && folders.length > 0) {
      folderId = folders[0].id;
    } else {
      const { data: newFolder, error: folderErr } = await supabase
        .from("portfolio_documents")
        .insert({ company_id: companyId, type: "folder", name: "Reporting" })
        .select("id")
        .single();

      if (folderErr || !newFolder) {
        logger.error("Failed to create Reporting folder", { error: folderErr?.message });
        return;
      }
      folderId = newFolder.id;
    }

    for (const file of files) {
      const storagePath = `${companyId}/reporting/${Date.now()}_${file.name}`;
      const { error: uploadErr } = await supabase.storage
        .from("portfolio-documents")
        .upload(storagePath, file.buffer, { contentType: file.mime });

      if (uploadErr) {
        logger.error(`Doc upload failed: ${file.name}`, { error: uploadErr.message });
        continue;
      }

      await supabase.from("portfolio_documents").insert({
        company_id: companyId,
        type: "file",
        name: file.name,
        parent_id: folderId,
        storage_path: storagePath,
        mime_type: file.mime,
        file_size_bytes: file.size,
        original_file_name: file.name,
        source_report_id: reportId,
        source_bucket: "portfolio-documents",
        text_content: file.extractedText || null,
      });
    }

    logger.info(`Copied ${files.length} files to portfolio_documents/Reporting`);
  } catch (err: any) {
    logger.error("portfolio_documents copy failed", { error: err.message });
  }
}
