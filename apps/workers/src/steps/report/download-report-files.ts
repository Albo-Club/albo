/**
 * Step: Download Report Files
 * Télécharge les fichiers depuis Supabase Storage (bucket report-files).
 * Retourne les buffers avec métadonnées pour extraction.
 */

import { logger } from "@trigger.dev/sdk";
import { supabase } from "../../lib/supabase.js";

export interface StoragePath {
  path: string;
  file_name: string;
  mime_type: string;
}

export interface DownloadedFile {
  buffer: Buffer;
  name: string;
  mime: string;
  extension: string;
}

export async function downloadReportFiles(
  storagePaths: StoragePath[]
): Promise<DownloadedFile[]> {
  const files: DownloadedFile[] = [];

  for (const sp of storagePaths) {
    const { data, error } = await supabase.storage
      .from("report-files")
      .download(sp.path);

    if (error || !data) {
      logger.error(`Download failed: ${sp.path}`, { error: error?.message });
      continue;
    }

    const buffer = Buffer.from(await data.arrayBuffer());
    const ext = sp.file_name.split(".").pop()?.toLowerCase() || "bin";
    files.push({ buffer, name: sp.file_name, mime: sp.mime_type, extension: ext });
  }

  if (files.length > 0) {
    logger.info(`Downloaded ${files.length} files`);
  }

  return files;
}
