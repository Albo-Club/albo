export function formatEmailDate(dateString: string): string {
  if (!dateString) return '';
  const date = new Date(dateString);
  const now = new Date();
  
  const isToday = date.toDateString() === now.toDateString();
  if (isToday) {
    return date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  }

  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString()) {
    return 'Hier';
  }

  const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays < 7) {
    return date.toLocaleDateString('fr-FR', { weekday: 'short' });
  }

  if (date.getFullYear() === now.getFullYear()) {
    return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
  }

  return date.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export function formatEmailDateFull(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function getInitials(name: string): string {
  if (!name || name === 'Inconnu') return '?';
  // Si c'est un email, prendre la première lettre
  if (name.includes('@')) return name[0].toUpperCase();
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
}

export function getDisplayName(attendee: { display_name: string; identifier: string }): string {
  if (!attendee) return 'Inconnu';
  if (attendee.display_name && attendee.display_name !== 'Inconnu' && !attendee.display_name.includes('@')) {
    return attendee.display_name;
  }
  if (attendee.identifier && attendee.identifier.includes('@')) {
    // Extraire le nom de l'email : "mael.chafa" → "Mael Chafa"
    const localPart = attendee.identifier.split('@')[0];
    return localPart.split(/[._-]/).map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  }
  return attendee.display_name || 'Inconnu';
}

export function sanitizeEmailHtml(html: string): string {
  if (!html) return '';
  
  // Encapsuler dans un document HTML complet pour l'iframe
  // avec styles de base pour la lisibilité
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1">
      <style>
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          font-size: 14px;
          line-height: 1.6;
          color: #333;
          margin: 0;
          padding: 0;
          word-wrap: break-word;
          overflow-wrap: break-word;
        }
        img { max-width: 100%; height: auto; }
        a { color: #2563eb; }
        table { max-width: 100%; }
        pre, code { white-space: pre-wrap; word-wrap: break-word; }
        blockquote {
          border-left: 3px solid #e5e7eb;
          margin: 8px 0;
          padding: 4px 12px;
          color: #6b7280;
        }
      </style>
    </head>
    <body>${html}</body>
    </html>
  `;
}

export function formatFileSize(bytes: number): string {
  if (!bytes || bytes === 0) return '0 B';
  const units = ['B', 'Ko', 'Mo', 'Go'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return (bytes / Math.pow(1024, i)).toFixed(i > 0 ? 1 : 0) + ' ' + units[i];
}
