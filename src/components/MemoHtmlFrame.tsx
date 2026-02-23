import { useMemo } from "react";
import { cn } from "@/lib/utils";
import { cleanEmailHtml } from "@/lib/cleanEmailHtml";

function normalizeMemoHtml(raw: string, skipCleaning = false) {
  const input = (raw ?? "").trim();
  if (!input) return "";

  // 1. Clean email HTML (signatures, quotes, forwarded headers, "=" prefix)
  const cleaned = skipCleaning ? input : cleanEmailHtml(input);

  // 2. Convert literal "\\n" sequences to actual newlines
  const withNewlines = cleaned.includes("\\n")
    ? cleaned.replace(/\\n/g, "\n")
    : cleaned;
  const lower = withNewlines.trimStart().toLowerCase();

  // If it's already a full document, return as-is
  const isFullDoc = lower.startsWith("<!doctype") || lower.includes("<html");
  if (isFullDoc) return withNewlines;

  // Otherwise wrap in a minimal HTML document with clean styles
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Ubuntu, sans-serif;
      line-height: 1.65;
      color: #1a1a1a;
      padding: 24px;
      margin: 0;
      background: #fff;
      font-size: 14px;
    }
    img { max-width: 100%; height: auto; }
    table { border-collapse: collapse; width: 100%; margin: 8px 0; }
    th, td { border: 1px solid #ddd; padding: 8px 12px; text-align: left; }
    th { background: #f5f5f5; font-weight: 600; }
    a { color: #2563eb; text-decoration: none; }
    a:hover { text-decoration: underline; }
    b, strong { font-weight: 600; }
    ul, ol { padding-left: 20px; }
    li { margin-bottom: 4px; }
    h1, h2, h3 { margin-top: 1em; margin-bottom: 0.5em; }
  </style>
</head>
<body>${withNewlines}</body>
</html>`;
}

export function MemoHtmlFrame({
  html,
  title,
  className,
  skipCleaning,
}: {
  html: string;
  title: string;
  className?: string;
  skipCleaning?: boolean;
}) {
  const srcDoc = useMemo(() => normalizeMemoHtml(html, skipCleaning), [html, skipCleaning]);

  return (
    <iframe
      srcDoc={srcDoc}
      className={cn("w-full h-full border-0", className)}
      title={title}
      sandbox="allow-same-origin"
    />
  );
}
