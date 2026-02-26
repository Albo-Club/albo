/**
 * SenderAvatar – Affiche le logo de l'entreprise basé sur le domaine de l'email,
 * avec fallback sur les initiales colorées.
 */
import { useState } from 'react';
import { cn } from '@/lib/utils';

// Logos locaux pour les domaines connus
import aircallLogo from '@/assets/logos/aircall.svg';
import alanLogo from '@/assets/logos/alan.svg';
import swileLogo from '@/assets/logos/swile.svg';
import pennylaneLogo from '@/assets/logos/pennylane.svg';
import notionLogo from '@/assets/logos/notion.svg';
import docsendLogo from '@/assets/logos/docsend.svg';
import googledriveLogo from '@/assets/logos/googledrive.svg';

/** Map domain keywords to local logo assets */
const KNOWN_LOGOS: Record<string, string> = {
  'aircall': aircallLogo,
  'alan': alanLogo,
  'swile': swileLogo,
  'pennylane': pennylaneLogo,
  'notion': notionLogo,
  'docsend': docsendLogo,
  'googledrive': googledriveLogo,
  'google': googledriveLogo,
};

const LOGO_DEV_TOKEN = import.meta.env.VITE_LOGO_DEV_TOKEN;

function extractDomain(email: string): string | null {
  const match = email.match(/@([^>]+)/);
  return match ? match[1].trim().toLowerCase() : null;
}

function matchKnownLogo(domain: string): string | null {
  for (const [keyword, logo] of Object.entries(KNOWN_LOGOS)) {
    if (domain.includes(keyword)) return logo;
  }
  return null;
}

function hashColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue}, 55%, 45%)`;
}

function getInitials(name: string): string {
  if (!name) return '?';
  if (name.includes('@')) return name[0].toUpperCase();
  return name
    .split(' ')
    .map((w) => w[0])
    .filter(Boolean)
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

interface SenderAvatarProps {
  senderName: string;
  senderEmail: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const sizeClasses = {
  sm: 'h-6 w-6 text-[10px]',
  md: 'h-9 w-9 text-xs',
  lg: 'h-10 w-10 text-sm',
};

export function SenderAvatar({
  senderName,
  senderEmail,
  size = 'md',
  className,
}: SenderAvatarProps) {
  const [imgError, setImgError] = useState(false);
  const domain = extractDomain(senderEmail);

  // 1. Try known local logos
  const knownLogo = domain ? matchKnownLogo(domain) : null;

  // 2. Try logo.dev API for any domain
  const logoDevUrl =
    domain && LOGO_DEV_TOKEN && !knownLogo
      ? `https://img.logo.dev/${domain}?token=${LOGO_DEV_TOKEN}&size=64&format=png`
      : null;

  const logoSrc = knownLogo || (imgError ? null : logoDevUrl);

  if (logoSrc) {
    return (
      <img
        src={logoSrc}
        alt={senderName}
        className={cn(
          'rounded-full object-contain bg-white shrink-0',
          sizeClasses[size],
          className
        )}
        onError={() => setImgError(true)}
        loading="lazy"
      />
    );
  }

  // Fallback: colored initials
  return (
    <div
      className={cn(
        'rounded-full flex items-center justify-center font-medium text-white shrink-0',
        sizeClasses[size],
        className
      )}
      style={{ backgroundColor: hashColor(senderName || senderEmail) }}
    >
      {getInitials(senderName || senderEmail)}
    </div>
  );
}
