/**
 * Step: Store Deck Files
 * Upload TOUS les fichiers (PDF, Excel, Word, images) dans Supabase Storage
 * (bucket "deck-files") et insère une row par fichier dans la table deck_files.
 *
 * Supporte deux modes :
 * - Legacy : un seul PDF (pdfBuffer + originalFileName)
 * - Multi-fichier : liste de fichiers (additionalFiles)
 */

import { supabase } from "../../lib/supabase";

export interface StoredDeckFile {
  storagePath: string;
  cleanFileName: string;
}

export interface FileToStore {
  buffer: Buffer;
  name: string;
  mime: string;
  size: number;
}

export async function storeDeckFiles(
  dealId: string,
  senderEmail: string,
  pdfBuffer: Buffer | null,
  originalFileName: string | null,
  companyName: string,
  additionalFiles?: FileToStore[]
): Promise<StoredDeckFile | null> {
  const cleanEmail = senderEmail.toLowerCase().trim();
  const timestamp = Date.now();
  let firstStored: StoredDeckFile | null = null;

  // --- 1. Stocker le PDF principal (si présent) ---
  if (pdfBuffer) {
    const cleanName = sanitizeFileName(originalFileName || companyName || "deck");
    const finalFileName = `${cleanName}_${timestamp}.pdf`;
    const storagePath = `${cleanEmail}/${dealId}/${finalFileName}`;

    console.log(`[store-deck-files] Upload PDF: ${storagePath} (${(pdfBuffer.length / 1024).toFixed(0)}KB)`);

    const { error: uploadError } = await supabase.storage
      .from("deck-files")
      .upload(storagePath, pdfBuffer, {
        contentType: "application/pdf",
        upsert: true,
      });

    if (uploadError) {
      console.error(`[store-deck-files] Upload PDF échoué: ${uploadError.message}`);
    } else {
      await insertDeckFileRow(dealId, cleanEmail, finalFileName, storagePath, "application/pdf");
      firstStored = { storagePath, cleanFileName: finalFileName };
      console.log(`[store-deck-files] PDF stocké: ${storagePath}`);
    }
  }

  // --- 2. Stocker les fichiers additionnels (Excel, Word, images, autres PDF) ---
  if (additionalFiles && additionalFiles.length > 0) {
    for (const file of additionalFiles) {
      const ext = file.name.split(".").pop()?.toLowerCase() || "bin";
      const cleanName = sanitizeFileName(file.name);
      const finalFileName = `${cleanName}_${timestamp}.${ext}`;
      const storagePath = `${cleanEmail}/${dealId}/${finalFileName}`;

      console.log(`[store-deck-files] Upload ${ext}: ${storagePath} (${(file.size / 1024).toFixed(0)}KB)`);

      const { error: uploadError } = await supabase.storage
        .from("deck-files")
        .upload(storagePath, file.buffer, {
          contentType: file.mime,
          upsert: true,
        });

      if (uploadError) {
        console.error(`[store-deck-files] Upload ${file.name} échoué: ${uploadError.message}`);
        continue;
      }

      await insertDeckFileRow(dealId, cleanEmail, finalFileName, storagePath, file.mime);

      if (!firstStored) {
        firstStored = { storagePath, cleanFileName: finalFileName };
      }

      console.log(`[store-deck-files] ${file.name} stocké: ${storagePath}`);
    }
  }

  if (!firstStored) {
    console.log("[store-deck-files] Aucun fichier à uploader");
  }

  return firstStored;
}

async function insertDeckFileRow(
  dealId: string,
  senderEmail: string,
  fileName: string,
  storagePath: string,
  mimeType: string
): Promise<void> {
  const { error } = await supabase.from("deck_files").insert({
    deal_id: dealId,
    sender_email: senderEmail,
    file_name: fileName,
    storage_path: storagePath,
    mime_type: mimeType,
  });

  if (error) {
    console.error(`[store-deck-files] Insert deck_files failed for ${fileName}: ${error.message}`);
  }
}

function sanitizeFileName(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\.(pdf|xlsx?|xls|csv|docx?|png|jpe?g|gif|webp|bmp|tiff?)$/i, "")
    .replace(/[[\]{}()]/g, "")
    .replace(/[\\/:*?"<>|#%&@!^+=`~,;']/g, "_")
    .replace(/[\s\t\r\n]+/g, "_")
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "")
    .substring(0, 80) || "deck";
}
