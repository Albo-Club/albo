/**
 * Step: OCR Deck
 * 1. Mistral OCR pour extraire le texte brut du PDF
 * 2. Nettoyage regex rapide (supprime artefacts images, normalise whitespace)
 *
 * Pas besoin de Haiku : l'agent Mastra gère très bien le texte OCR brut nettoyé par regex.
 * Gain : ~30-60s de latence + coût tokens Haiku.
 */

import { extractPdf } from "../extract-pdf";

export interface OcrDeckResult {
  rawText: string;
  cleanedText: string;
  charCount: number;
}

/**
 * Extrait et nettoie le texte d'un deck PDF.
 * Si le PDF est null (text_only), retourne le textContent directement.
 */
export async function ocrDeck(
  pdfBuffer: Buffer | null,
  pdfFileName: string | null,
  textContent: string | null
): Promise<OcrDeckResult> {
  // Route text_only : pas de PDF, on retourne le texte du mail
  if (!pdfBuffer) {
    const text = textContent || "";
    return { rawText: text, cleanedText: text, charCount: text.length };
  }

  // Étape 1 : Mistral OCR
  const rawText = await extractPdf(pdfBuffer, pdfFileName || "deck.pdf");
  console.log(`[ocr-deck] Mistral OCR: ${rawText.length} chars`);

  // Étape 2 : Nettoyage regex (instantané)
  const cleanedText = stripOcrNoise(rawText);
  console.log(`[ocr-deck] Regex cleanup: ${rawText.length} → ${cleanedText.length} chars`);

  return { rawText, cleanedText, charCount: cleanedText.length };
}

/** Supprime le bruit OCR sans LLM — instantané */
function stripOcrNoise(text: string): string {
  return text
    // Supprimer les références images : ![img-X.jpeg](img-X.jpeg)
    .replace(/!\[.*?\]\(.*?\)\n?/g, "")
    // Supprimer les lignes vides multiples
    .replace(/\n{3,}/g, "\n\n")
    // Supprimer les séparateurs de page redondants
    .replace(/(\n---\n){2,}/g, "\n---\n")
    .trim();
}
