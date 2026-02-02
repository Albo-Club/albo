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
