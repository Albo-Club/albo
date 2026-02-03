import { useRef, useEffect, useState, useMemo } from 'react';
import { cn } from '@/lib/utils';

interface EmailBodyFrameProps {
  html: string;
  className?: string;
}

export function EmailBodyFrame({ html, className }: EmailBodyFrameProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [height, setHeight] = useState(400);

  // Wrapper le HTML dans un document complet avec styles de base
  const srcDoc = useMemo(() => {
    const raw = (html ?? '').trim();
    if (!raw) return '';

    const lower = raw.trimStart().toLowerCase();
    const isFullDoc = lower.startsWith('<!doctype') || lower.includes('<html');

    if (isFullDoc) {
      // Injecter un style reset dans le doc existant
      return raw.replace(
        '</head>',
        `<style>
          body { margin: 0; overflow-x: hidden; }
          img { max-width: 100% !important; height: auto !important; }
          * { box-sizing: border-box; }
        </style></head>`
      );
    }

    // Wrapper dans un document minimal propre
    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <style>
    * { box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      font-size: 14px;
      line-height: 1.6;
      color: #1a1a1a;
      padding: 0;
      margin: 0;
      background: white;
      overflow-x: hidden;
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

  // Auto-resize l'iframe selon le contenu
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
              setHeight(Math.max(contentHeight + 24, 200));
            }
          };
          updateHeight();
          // Re-check après délai (images qui chargent)
          setTimeout(updateHeight, 300);
          setTimeout(updateHeight, 1000);
        }
      } catch (e) {
        // Silently fail si cross-origin
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
      sandbox="allow-same-origin allow-popups allow-popups-to-escape-sandbox"
      className={cn('w-full border-0 block bg-white rounded-lg', className)}
      style={{ height: `${height}px`, minHeight: '200px' }}
      title="Contenu de l'email"
    />
  );
}
