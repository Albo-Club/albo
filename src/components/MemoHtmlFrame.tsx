import { useMemo } from "react";
import { cn } from "@/lib/utils";

function normalizeMemoHtml(raw: string) {
  const input = (raw ?? "").trim();
  if (!input) return "";

  // If backend stored literal "\\n" sequences, convert them back to new lines.
  const withNewlines = input.includes("\\n") ? input.replace(/\\n/g, "\n") : input;
  const lower = withNewlines.trimStart().toLowerCase();

  const isFullDoc = lower.startsWith("<!doctype") || lower.includes("<html");
  if (isFullDoc) return withNewlines;

  // Minimal, safe wrapper for fragments.
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Ubuntu, sans-serif;
      line-height: 1.6;
      color: hsl(0 0% 10%);
      padding: 24px;
      margin: 0;
      background: hsl(0 0% 100%);
    }
    img { max-width: 100%; height: auto; }
    table { border-collapse: collapse; width: 100%; }
    th, td { border: 1px solid hsl(0 0% 86%); padding: 8px 12px; text-align: left; }
    th { background: hsl(0 0% 96%); }
  </style>
</head>
<body>${withNewlines}</body>
</html>`;
}

export function MemoHtmlFrame({
  html,
  title,
  className,
}: {
  html: string;
  title: string;
  className?: string;
}) {
  const srcDoc = useMemo(() => normalizeMemoHtml(html), [html]);

  return (
    <iframe
      srcDoc={srcDoc}
      className={cn("w-full h-full border-0", className)}
      title={title}
      sandbox="allow-same-origin"
    />
  );
}
