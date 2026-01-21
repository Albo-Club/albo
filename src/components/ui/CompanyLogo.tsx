import { useState } from 'react';
import { Building2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CompanyLogoProps {
  domain: string | null | undefined;
  companyName?: string | null;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const sizeClasses = {
  sm: 'h-6 w-6',
  md: 'h-8 w-8',
  lg: 'h-12 w-12',
};

const iconSizeClasses = {
  sm: 'h-3 w-3',
  md: 'h-4 w-4',
  lg: 'h-6 w-6',
};

const LOGO_DEV_TOKEN = import.meta.env.VITE_LOGO_DEV_TOKEN;

export function CompanyLogo({ domain, companyName, size = 'md', className }: CompanyLogoProps) {
  const [hasError, setHasError] = useState(false);

  // Debug logs temporaires
  console.log('Logo.dev token:', LOGO_DEV_TOKEN ? 'Token présent' : 'Token MANQUANT');
  console.log('Domain:', domain);

  // Si pas de domaine ou erreur de chargement, afficher le fallback
  if (!domain || hasError || !LOGO_DEV_TOKEN) {
    return (
      <div
        className={cn(
          'rounded-md bg-muted flex items-center justify-center shrink-0',
          sizeClasses[size],
          className
        )}
        title={companyName || undefined}
      >
        <Building2 className={cn('text-muted-foreground', iconSizeClasses[size])} />
      </div>
    );
  }

  const logoUrl = `https://img.logo.dev/${domain}?token=${LOGO_DEV_TOKEN}&size=128&format=png`;
  console.log('Logo URL:', logoUrl);

  return (
    <img
      src={logoUrl}
      alt={companyName ? `${companyName} logo` : 'Company logo'}
      className={cn(
        'rounded-md bg-white object-contain shrink-0',
        sizeClasses[size],
        className
      )}
      onError={() => setHasError(true)}
      loading="lazy"
    />
  );
}
