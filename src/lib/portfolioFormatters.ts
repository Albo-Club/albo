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

// Format pourcentage depuis décimal (0.008 → 0.80%)
export const formatPercentage = (value: number | null): string => {
  if (value === null || value === undefined) return '-';
  return `${(value * 100).toFixed(2)}%`;
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

// Re-export color utilities for backward compatibility
export { getSectorColors as getSectorColor, getInvestmentTypeColors as getInvestmentTypeColor };

