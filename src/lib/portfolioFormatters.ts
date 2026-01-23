import { getSectorColors, getInvestmentTypeColors } from '@/types/portfolio';

// Format montant en euros depuis les centimes
export const formatCurrency = (cents: number | null): string => {
  if (!cents) return '-';
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(cents / 100);
};

// Format pourcentage depuis décimal (0.00156 → 0.156%)
export const formatPercentage = (value: number | null): string => {
  if (value === null || value === undefined) return '-';
  return `${(value * 100).toFixed(3)}%`;
};

// Format ownership percentage with 3 decimal places (0.00156 → 0.156%)
export const formatOwnership = (value: number | null): string => {
  if (value === null || value === undefined) return '0.000%';
  return `${(value * 100).toFixed(3)}%`;
};

// Format date en français
export const formatDate = (date: string | null): string => {
  if (!date) return '-';
  return new Date(date).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
};

// Format number with French locale (space as thousands separator) + € suffix
export const formatNumber = (value: number | string | null | undefined, suffix: string = '€'): string => {
  if (value === null || value === undefined) return '-';
  const num = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(num)) return '-';
  return num.toLocaleString('fr-FR') + (suffix ? ` ${suffix}` : '');
};

// Format number compactly for large values (M, k) with proper French styling
export const formatNumberCompact = (value: number | null | undefined, suffix: string = '€'): string => {
  if (value === null || value === undefined) return '-';
  const absValue = Math.abs(value);
  const sign = value < 0 ? '-' : '';
  
  if (absValue >= 1_000_000_000) {
    return `${sign}${(absValue / 1_000_000_000).toFixed(1).replace('.', ',')}Md${suffix}`;
  }
  if (absValue >= 1_000_000) {
    return `${sign}${(absValue / 1_000_000).toFixed(1).replace('.', ',')}M${suffix}`;
  }
  if (absValue >= 10_000) {
    return `${sign}${(absValue / 1_000).toFixed(0)}k${suffix}`;
  }
  return `${sign}${absValue.toLocaleString('fr-FR')} ${suffix}`;
};

// Format short date for metrics (e.g., "nov. 2025")
export const formatShortDate = (date: string | null | undefined): string => {
  if (!date) return '';
  return new Date(date).toLocaleDateString('fr-FR', {
    month: 'short',
    year: 'numeric',
  });
};

// Re-export color utilities for backward compatibility
export { getSectorColors as getSectorColor, getInvestmentTypeColors as getInvestmentTypeColor };

