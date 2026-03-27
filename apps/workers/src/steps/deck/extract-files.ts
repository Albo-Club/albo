/**
 * Step: Extract Files (multi-format)
 * Route chaque fichier par type MIME, extrait le contenu en parallèle,
 * et retourne un texte combiné prêt pour l'agent Mastra.
 *
 * Types supportés :
 * - PDF → Mistral OCR
 * - Excel (.xlsx, .xls, .csv) → XLSX parser
 * - Image (jpg, png, webp, etc.) → Mistral OCR
 * - Word (.docx) → mammoth
 */

import { extractPdf } from "../extract-pdf";
import { extractExcel } from "../extract-excel";
import { extractImage } from "../extract-image";
import { extractWord } from "../extract-word";

/** Max chars par fichier extrait — au-delà, on tronque avec un marqueur */
const MAX_CHARS_PER_FILE = 100_000;
/** Max chars total combiné envoyé à l'agent */
const MAX_TOTAL_CHARS = 200_000;

export interface UploadedFile {
  buffer: Buffer;
  originalname: string;
  mimetype: string;
  size: number;
}

export type FileCategory = "pdf" | "excel" | "image" | "word" | "unknown";

interface ExtractedFile {
  fileName: string;
  category: FileCategory;
  content: string;
  charCount: number;
}

export interface ExtractAllResult {
  files: ExtractedFile[];
  /** Texte combiné, structuré par section, prêt pour l'agent */
  combinedText: string;
  /** Résumé pour les logs */
  summary: string;
}

export async function extractAllFiles(files: UploadedFile[]): Promise<ExtractAllResult> {
  console.log(`[extract-files] ${files.length} fichier(s) à traiter`);

  // Classer chaque fichier
  const categorized = files.map((f) => ({
    file: f,
    category: categorizeFile(f.mimetype, f.originalname),
  }));

  // Extraire en parallèle
  const extractions = await Promise.all(
    categorized.map(async ({ file, category }): Promise<ExtractedFile> => {
      let content = "";

      try {
        switch (category) {
          case "pdf":
            content = await extractPdf(file.buffer, file.originalname);
            content = stripOcrNoise(content);
            break;
          case "excel":
            const excel = extractExcel(file.buffer, file.originalname);
            content = excel.extractedText;
            break;
          case "image":
            content = await extractImage(file.buffer, file.mimetype, file.originalname);
            break;
          case "word":
            content = await extractWord(file.buffer, file.originalname);
            break;
          default:
            console.warn(`[extract-files] Type non supporté: ${file.mimetype} (${file.originalname})`);
        }
      } catch (err: any) {
        console.error(`[extract-files] Échec extraction ${file.originalname}: ${err.message}`);
      }

      // Tronquer si trop long pour éviter de saturer l'agent
      if (content.length > MAX_CHARS_PER_FILE) {
        console.warn(`[extract-files] ${file.originalname} tronqué: ${content.length} → ${MAX_CHARS_PER_FILE} chars`);
        content = content.slice(0, MAX_CHARS_PER_FILE) + `\n\n[... tronqué à ${MAX_CHARS_PER_FILE} caractères sur ${content.length} total]`;
      }

      return {
        fileName: file.originalname,
        category,
        content,
        charCount: content.length,
      };
    })
  );

  // Construire le texte combiné structuré par section
  const sections: string[] = [];

  // Grouper par catégorie pour une lecture claire par l'agent
  const pdfFiles = extractions.filter((e) => e.category === "pdf" && e.content);
  const excelFiles = extractions.filter((e) => e.category === "excel" && e.content);
  const imageFiles = extractions.filter((e) => e.category === "image" && e.content);
  const wordFiles = extractions.filter((e) => e.category === "word" && e.content);

  if (pdfFiles.length > 0) {
    sections.push("## Contenu PDF (OCR)");
    for (const f of pdfFiles) {
      if (pdfFiles.length > 1) sections.push(`### ${f.fileName}`);
      sections.push(f.content);
    }
  }

  if (excelFiles.length > 0) {
    sections.push("## Données Excel");
    for (const f of excelFiles) {
      if (excelFiles.length > 1) sections.push(`### ${f.fileName}`);
      sections.push(f.content);
    }
  }

  if (wordFiles.length > 0) {
    sections.push("## Contenu Word");
    for (const f of wordFiles) {
      if (wordFiles.length > 1) sections.push(`### ${f.fileName}`);
      sections.push(f.content);
    }
  }

  if (imageFiles.length > 0) {
    sections.push("## Contenu Images (OCR)");
    for (const f of imageFiles) {
      sections.push(`### ${f.fileName}`);
      sections.push(f.content);
    }
  }

  let combinedText = sections.join("\n\n");

  // Cap total pour ne pas saturer le contexte de l'agent
  if (combinedText.length > MAX_TOTAL_CHARS) {
    console.warn(`[extract-files] Texte combiné tronqué: ${combinedText.length} → ${MAX_TOTAL_CHARS} chars`);
    combinedText = combinedText.slice(0, MAX_TOTAL_CHARS) + `\n\n[... contenu total tronqué à ${MAX_TOTAL_CHARS} caractères]`;
  }

  const summary = extractions
    .map((e) => `${e.fileName} (${e.category}: ${e.charCount} chars)`)
    .join(", ");

  console.log(`[extract-files] Extraction terminée: ${summary}`);
  console.log(`[extract-files] Texte combiné: ${combinedText.length} chars`);

  return { files: extractions, combinedText, summary };
}

function categorizeFile(mimetype: string, fileName: string): FileCategory {
  const mime = mimetype.toLowerCase();
  const name = fileName.toLowerCase();

  if (mime === "application/pdf" || name.endsWith(".pdf")) return "pdf";

  if (
    mime.includes("spreadsheet") ||
    mime.includes("excel") ||
    mime === "text/csv" ||
    name.endsWith(".xlsx") ||
    name.endsWith(".xls") ||
    name.endsWith(".csv")
  )
    return "excel";

  if (
    mime === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    mime === "application/msword" ||
    name.endsWith(".docx") ||
    name.endsWith(".doc")
  )
    return "word";

  if (mime.startsWith("image/")) return "image";

  return "unknown";
}

/** Supprime le bruit OCR — même logique que ocr-deck.ts */
function stripOcrNoise(text: string): string {
  return text
    .replace(/!\[.*?\]\(.*?\)\n?/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/(\n---\n){2,}/g, "\n---\n")
    .trim();
}
