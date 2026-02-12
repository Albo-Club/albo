/**
 * Utilities for cleaning email HTML content and detecting content format.
 */

/**
 * Remove Gmail/Outlook forwarded headers, quoted replies, and email signatures
 * from HTML content. Also strips the leading "=" artifact from quoted-printable MIME.
 */
export function cleanEmailHtml(raw: string): string {
  let html = (raw ?? "").trim();
  if (!html) return "";

  // 1. Strip leading "=" artifact from quoted-printable MIME encoding
  if (html.startsWith("=")) {
    html = html.slice(1).trimStart();
  }

  // 2. Remove forwarded headers blocks (---------- Forwarded message ----------)
  html = html.replace(
    /[-–—]{2,}\s*(?:Forwarded|Transferred|Original)\s+message\s*[-–—]{2,}[\s\S]*?(?=<(?:div|p|table|br)\b)/gi,
    ""
  );

  // 3. Remove Gmail quote containers (<div class="gmail_quote">...</div>)
  html = html.replace(/<div[^>]*class="gmail_quote"[^>]*>[\s\S]*?<\/div>/gi, "");

  // 4. Remove Outlook-style quoted text (blockquote with cite or type="cite")
  html = html.replace(/<blockquote[^>]*(?:type="cite"|cite=)[^>]*>[\s\S]*?<\/blockquote>/gi, "");

  // 5. Remove common email signatures
  // Pattern: <div class="gmail_signature_prefix">-- </div><div class="gmail_signature">...</div>
  html = html.replace(/<div[^>]*class="gmail_signature[^"]*"[^>]*>[\s\S]*?<\/div>/gi, "");
  html = html.replace(/<div[^>]*class="gmail_signature_prefix"[^>]*>[\s\S]*?<\/div>/gi, "");

  // Pattern: -- followed by signature block at end
  html = html.replace(/<br\s*\/?>\s*--\s*<br\s*\/?>[\s\S]*$/gi, "");

  // 6. Remove "On ... wrote:" lines (reply attribution)
  html = html.replace(/<div[^>]*>On\s.+wrote:<\/div>/gi, "");
  html = html.replace(/Le\s.+a\s+écrit\s*:/gi, "");

  // 7. Remove excessive <br> runs (more than 3 consecutive)
  html = html.replace(/(<br\s*\/?>\s*){4,}/gi, "<br><br>");

  // 8. Trim trailing whitespace/breaks
  html = html.replace(/(\s|<br\s*\/?>)*$/i, "");

  return html.trim();
}

/**
 * Detect whether a string contains HTML content.
 * Handles edge cases like "=" prefix from MIME encoding.
 */
export function isHtmlContent(content: string | null): boolean {
  if (!content) return false;
  let trimmed = content.trim();

  // Strip leading "=" artifact
  if (trimmed.startsWith("=") && trimmed.length > 1) {
    trimmed = trimmed.slice(1).trimStart();
  }

  const lower = trimmed.toLowerCase();
  return (
    lower.startsWith("<!doctype") ||
    lower.startsWith("<html") ||
    lower.startsWith("<style") ||
    lower.startsWith("<div") ||
    lower.startsWith("<article") ||
    lower.startsWith("<section") ||
    lower.startsWith("<table") ||
    lower.startsWith("<p") ||
    lower.startsWith("<h1") ||
    lower.startsWith("<h2") ||
    lower.startsWith("<h3") ||
    lower.startsWith("<ul") ||
    lower.startsWith("<ol") ||
    lower.startsWith("<span") ||
    // Also detect if content has significant HTML tags anywhere
    /<(?:div|table|p|h[1-6]|ul|ol|article|section)\b[^>]*>/i.test(trimmed)
  );
}

/**
 * Detect whether a string is Markdown content (e.g. Notion exports).
 */
export function isMarkdownContent(content: string | null): boolean {
  if (!content) return false;
  const trimmed = content.trim();

  // If it looks like HTML, it's not Markdown
  if (isHtmlContent(content)) return false;

  // Check for common Markdown patterns
  const mdPatterns = [
    /^#{1,6}\s/m,           // # Heading
    /^\s*[-*+]\s/m,         // - list item
    /^\s*\d+\.\s/m,         // 1. ordered list
    /\[.+\]\(.+\)/,         // [link](url)
    /^\s*>\s/m,             // > blockquote
    /\*\*.+\*\*/,           // **bold**
    /^\s*```/m,             // ```code block
    /^\|.+\|$/m,            // | table |
  ];

  const matchCount = mdPatterns.filter((p) => p.test(trimmed)).length;
  return matchCount >= 2;
}
