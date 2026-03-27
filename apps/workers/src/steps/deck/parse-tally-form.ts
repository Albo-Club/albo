/**
 * Step: Parse Tally Form
 * Extrait les champs structurés d'un email de soumission Tally.
 *
 * Les emails Tally ont un format prévisible :
 *   <b>Label</b>
 *   <div>Valeur</div>
 *
 * On extrait tous les paires label/valeur + le lien deck.
 */

export interface TallyFormData {
  companyName: string | null;
  companyDomain: string | null;
  firstName: string | null;
  lastName: string | null;
  contactEmail: string | null;
  phone: string | null;
  extraInfo: string | null;
  deckUrl: string | null;
  /** Tous les champs bruts pour passer à l'agent */
  allFields: Array<{ label: string; value: string }>;
}

/**
 * Détecte si l'email est un formulaire Tally et extrait les champs.
 * Retourne null si ce n'est pas un email Tally.
 */
export function parseTallyForm(
  bodyHtml: string,
  bodyText: string,
  subject: string
): TallyFormData | null {
  const isTally =
    subject.toLowerCase().includes("tally") ||
    bodyText.includes("tally.so") ||
    bodyHtml.includes("tally.so");

  if (!isTally) return null;

  // Extraire les paires label/valeur du HTML
  const allFields = extractFieldsFromHtml(bodyHtml);

  // Fallback sur le texte brut si HTML ne donne rien
  if (allFields.length === 0) {
    allFields.push(...extractFieldsFromText(bodyText));
  }

  if (allFields.length === 0) return null;

  // Mapper les champs connus
  const get = (keywords: string[]) =>
    allFields.find((f) =>
      keywords.some((kw) => f.label.toLowerCase().includes(kw))
    )?.value || null;

  // Extraire l'URL du deck Tally
  const deckUrlMatch = bodyHtml.match(
    /href=["']([^"']*storage\.tally\.so[^"']*)["']/i
  );
  const deckUrl = deckUrlMatch ? deckUrlMatch[1].replace(/&amp;/g, "&") : null;

  return {
    companyName: get(["company name", "nom de la société", "startup name", "company"]),
    companyDomain: get(["domain", "website", "site web", "url"]),
    firstName: get(["first name", "prénom"]),
    lastName: get(["last name", "laste name", "nom de famille", "nom"]),
    contactEmail: get(["email", "e-mail", "mail"]),
    phone: get(["phone", "téléphone", "tel"]),
    extraInfo: get(["more info", "info", "description", "pitch", "comment"]),
    deckUrl,
    allFields,
  };
}

/** Génère un markdown structuré des données Tally pour l'agent */
export function tallyFormToMarkdown(form: TallyFormData): string {
  const lines: string[] = ["## Données formulaire Tally"];

  for (const f of form.allFields) {
    lines.push(`- **${f.label}** : ${f.value}`);
  }

  return lines.join("\n");
}

// --- Extraction HTML ---

function extractFieldsFromHtml(html: string): Array<{ label: string; value: string }> {
  const fields: Array<{ label: string; value: string }> = [];

  // Pattern : <b>Label</b></div><div>Value</div> ou <b>Label</b> suivi de <div>Value</div>
  const rx = /<(?:b|strong)>(.*?)<\/(?:b|strong)><\/div>\s*<div[^>]*>([\s\S]*?)<\/div>/gi;
  let m;
  while ((m = rx.exec(html)) !== null) {
    const label = stripHtml(m[1]).trim();
    const value = stripHtml(m[2]).trim();
    if (label && value) {
      fields.push({ label, value });
    }
  }

  // Pattern alternatif : <div><b>Label</b></div>\n<div>Value</div>
  if (fields.length === 0) {
    const rx2 = /<div[^>]*><(?:b|strong)>(.*?)<\/(?:b|strong)><\/div>\s*<div[^>]*>([\s\S]*?)<\/div>/gi;
    while ((m = rx2.exec(html)) !== null) {
      const label = stripHtml(m[1]).trim();
      const value = stripHtml(m[2]).trim();
      if (label && value) {
        fields.push({ label, value });
      }
    }
  }

  return fields;
}

// --- Extraction texte brut ---

function extractFieldsFromText(text: string): Array<{ label: string; value: string }> {
  const fields: Array<{ label: string; value: string }> = [];

  // Pattern texte : *Label*\nValue (format Tally plain text, \r\n ou \n)
  const normalized = text.replace(/\r\n/g, "\n");
  const rx = /\*([^*]+)\*\n([^\n*]+)/g;
  let m;
  while ((m = rx.exec(normalized)) !== null) {
    const label = m[1].trim();
    const value = m[2].trim();
    if (label && value && !value.startsWith("<")) {
      fields.push({ label, value });
    }
  }

  return fields;
}

function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<a[^>]*href=["']([^"']+)["'][^>]*>[^<]*<\/a>/gi, "$1")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim();
}
