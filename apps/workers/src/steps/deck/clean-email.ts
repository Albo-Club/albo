/**
 * Step: Clean Email
 * Nettoie le HTML de l'email et génère un markdown structuré.
 * Reproduit le nœud N8N "Clean Email text".
 */

export interface CleanedDeckEmail {
  emailSubject: string;
  senderName: string;
  senderEmail: string;
  emailDate: string;
  textClean: string;
  htmlClean: string;
  markdown: string;
}

export function cleanDeckEmail(
  rawHtml: string,
  rawText: string,
  subject: string,
  senderName: string,
  senderEmail: string,
  emailDate: string
): CleanedDeckEmail {
  const textFromPlain = cleanText(rawText);
  const textFromHtml = rawHtml ? stripHtmlTags(rawHtml) : "";

  // Utilise le texte le plus complet : body_plain est souvent tronqué dans les
  // emails forwardés (Gmail ne livre que le wrapper, pas le contenu transféré).
  const textClean =
    textFromHtml.length > textFromPlain.length * 1.3
      ? cleanText(textFromHtml)
      : textFromPlain;

  const htmlClean = cleanHtml(rawHtml, rawText);
  const markdown = toMarkdown(textClean, subject, senderName, senderEmail, emailDate);

  return { emailSubject: subject, senderName, senderEmail, emailDate, textClean, htmlClean, markdown };
}

/** Extrait le texte lisible d'un HTML email (strip tags, décode entités) */
function stripHtmlTags(html: string): string {
  return html
    // Supprimer signatures Gmail et attributions de forward
    .replace(/<div[^>]*class="gmail_signature"[^>]*>[\s\S]*?<\/div>/gi, "")
    .replace(/<div[^>]*class="gmail_attr"[^>]*>[\s\S]*?<\/div>/gi, "")
    // Supprimer les images (pas de texte utile)
    .replace(/<img[^>]*\/?>/gi, "")
    // Supprimer les tables de signature (signitic, etc.)
    .replace(/<table[^>]*>[\s\S]*?<\/table>/gi, "")
    // Convertir les blocs en newlines
    .replace(/<\/?(p|div|br|h[1-6]|li|tr|blockquote)[^>]*>/gi, "\n")
    // Supprimer tous les tags restants
    .replace(/<[^>]+>/g, "")
    // Décoder les entités HTML courantes
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    // Nettoyer whitespace
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function cleanText(text: string): string {
  if (!text) return "";
  return text
    .replace(/^>+\s?/gm, "")
    .replace(/\[image:[^\]]*\]/g, "")
    .replace(/\n-- \n[\s\S]*$/m, "")
    .replace(/^Le .+ a écrit\s?:\s*$/gm, "")
    .replace(/https?:\/\/app\.signitic\.com\/[^\s]*/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function cleanHtml(html: string, text: string): string {
  if (html) {
    return html
      .replace(/<div[^>]*class="gmail_signature"[^>]*>[\s\S]*?<\/div>/gi, "")
      .replace(/<div[^>]*class="gmail_attr"[^>]*>[\s\S]*?<\/div>/gi, "")
      .replace(/<img[^>]*src="https?:\/\/[^"]*signitic[^"]*"[^>]*\/?>/gi, "")
      .replace(/<table[^>]*>[\s\S]*?signitic[\s\S]*?<\/table>/gi, "")
      .replace(/<a[^>]*href="https?:\/\/app\.signitic\.com[^"]*"[^>]*>[\s\S]*?<\/a>/gi, "")
      .replace(/(<br\s*\/?>[\s]*){3,}/gi, "<br><br>")
      .replace(/<div[^>]*>[\s]*<\/div>/gi, "")
      .trim();
  }

  if (text) {
    const cleaned = cleanText(text);
    return cleaned
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\n\n/g, "</p><p>")
      .replace(/\n/g, "<br>")
      .replace(/^/, "<p>")
      .replace(/$/, "</p>");
  }

  return "<p>Aucun contenu disponible</p>";
}

function toMarkdown(
  cleanedText: string,
  subject: string,
  senderName: string,
  senderEmail: string,
  emailDate: string
): string {
  return [
    `# ${subject}`,
    "",
    `**De:** ${senderName} <${senderEmail}>`,
    `**Date:** ${emailDate}`,
    "",
    "---",
    "",
    cleanedText,
  ].join("\n");
}
