import { useRef, useEffect, useState, useMemo } from 'react';
import { cn } from '@/lib/utils';

interface EmailBodyFrameProps {
  html: string;
  className?: string;
}

export function EmailBodyFrame({ html, className }: EmailBodyFrameProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [height, setHeight] = useState(400);

  // Wrap the HTML in a complete document with clean base styles
  const srcDoc = useMemo(() => {
    const raw = (html ?? '').trim();
    if (!raw) return '';

    const lower = raw.trimStart().toLowerCase();
    const isFullDoc = lower.startsWith('<!doctype') || lower.includes('<html');

    // If it's already a full HTML doc, inject a small style reset
    if (isFullDoc) {
      return raw.replace(
        '</head>',
        `<style>
          body { overflow: hidden !important; margin: 0; }
          img { max-width: 100% !important; height: auto !important; }
        </style></head>`
      );
    }

    // Otherwise, wrap in a minimal clean document
    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <style>
    * { box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      line-height: 1.6;
      color: #1a1a1a;
      padding: 0;
      margin: 0;
      background: white;
      overflow: hidden;
      word-break: break-word;
    }
    img { max-width: 100% !important; height: auto !important; }
    a { color: #2563eb; }
    table { max-width: 100% !important; }
    pre, code { white-space: pre-wrap; word-break: break-all; }
  </style>
</head>
<body>${raw}</body>
</html>`;
  }, [html]);

  // Auto-resize iframe based on content
  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;

    const handleLoad = () => {
      try {
        const doc = iframe.contentDocument || iframe.contentWindow?.document;
        if (doc?.body) {
          const updateHeight = () => {
            const contentHeight = doc.body.scrollHeight;
            if (contentHeight > 0) {
              setHeight(contentHeight + 16);
            }
          };
          updateHeight();
          // Re-check after delays for images
          setTimeout(updateHeight, 500);
          setTimeout(updateHeight, 1500);
        }
      } catch (e) {
        // Silently fail if cross-origin
      }
    };

    iframe.addEventListener('load', handleLoad);
    return () => iframe.removeEventListener('load', handleLoad);
  }, [srcDoc]);

  if (!srcDoc) return null;

  return (
    <iframe
      ref={iframeRef}
      srcDoc={srcDoc}
      sandbox="allow-same-origin allow-popups"
      className={cn('block border-0', className)}
      style={{
        width: '100%',
        height: `${height}px`,
        background: 'white',
        borderRadius: '8px',
      }}
      title="Contenu de l'email"
    />
  );
}
