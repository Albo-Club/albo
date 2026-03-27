/**
 * Step: Store Files
 * Equivalent N8N: "Prepares files" + "Upload storage" + "Insert report files"
 *
 * 1. For each file: sanitize name, build storage path
 * 2. Upload to Supabase Storage bucket "report-files" (upsert)
 * 3. Insert row into report_files table
 */

import { supabase } from "../lib/supabase";

export interface FileToStore {
  buffer: Buffer;
  name: string;
  extension: string;
  mime: string;
  size: number;
  extractedText?: string;
  htmlContent?: string;
}

export interface StoredFile {
  fileName: string;
  originalName: string;
  storagePath: string;
  mimeType: string;
  size: number;
}

function cleanFileName(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .replace(/_+/g, "_");
}

export async function storeFiles(
  files: FileToStore[],
  reportId: string,
  companyId: string,
  reportPeriod: string
): Promise<StoredFile[]> {
  const stored: StoredFile[] = [];

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const cleanName = cleanFileName(file.name);
    const ext = file.extension || "bin";
    const storagePath = `${companyId}/${reportId}/${reportPeriod}_${i}.${ext}`;

    // 1. Upload to storage
    const { error: uploadError } = await supabase.storage
      .from("report-files")
      .upload(storagePath, file.buffer, {
        contentType: file.mime,
        upsert: true,
      });

    if (uploadError) {
      console.error(`[store-files] Upload failed for ${file.name}:`, uploadError.message);
      continue;
    }

    // 2. Insert into report_files table (with extracted content if available)
    const { error: insertError } = await supabase.from("report_files").insert({
      report_id: reportId,
      file_name: cleanName,
      original_file_name: file.name,
      storage_path: storagePath,
      mime_type: file.mime,
      file_size_bytes: file.size,
      file_type: "report",
      ...(file.extractedText && { original_text_report: file.extractedText }),
      ...(file.htmlContent && { html_content: file.htmlContent }),
    });

    if (insertError) {
      console.error(`[store-files] Insert failed for ${file.name}:`, insertError.message);
      continue;
    }

    stored.push({
      fileName: cleanName,
      originalName: file.name,
      storagePath,
      mimeType: file.mime,
      size: file.size,
    });
  }

  console.log(`[store-files] Stored ${stored.length}/${files.length} files`);
  return stored;
}
