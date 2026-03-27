/**
 * Step: Clean Email Content
 * Equivalent N8N: "Clean original text report"
 *
 * Strips HTML tags, scripts, styles, and normalizes whitespace.
 */

export interface CleanedContent {
  textContent: string;
  htmlContent: string;
  originalHtml: string;
  emailFrom: string;
  emailSubject: string;
}

export function cleanEmailContent(
  bodyHtml: string,
  bodyText: string,
  emailFrom: string,
  emailSubject: string
): CleanedContent {
  let cleaned = bodyHtml;
  cleaned = cleaned.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "");
  cleaned = cleaned.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "");
  cleaned = cleaned.replace(/<!--[\s\S]*?-->/g, "");
  cleaned = cleaned.replace(/<img[^>]*>/gi, "");
  cleaned = cleaned.replace(/<[^>]+>/g, " ");
  cleaned = cleaned.replace(/&nbsp;/g, " ");
  cleaned = cleaned.replace(/&amp;/g, "&");
  cleaned = cleaned.replace(/&lt;/g, "<");
  cleaned = cleaned.replace(/&gt;/g, ">");
  cleaned = cleaned.replace(/&#?\w+;/g, "");
  cleaned = cleaned.replace(/\s+/g, " ").trim();

  return {
    htmlContent: cleaned,
    originalHtml: bodyHtml,
    textContent: bodyText,
    emailFrom,
    emailSubject,
  };
}
