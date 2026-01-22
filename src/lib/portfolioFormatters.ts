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

// Couleurs des secteurs
export const sectorColors: Record<string, string> = {
  'Health & Wellness': 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400',
  'Climate': 'bg-sky-100 text-sky-800 dark:bg-sky-900/30 dark:text-sky-400',
  'Fintech': 'bg-violet-100 text-violet-800 dark:bg-violet-900/30 dark:text-violet-400',
  'SaaS': 'bg-violet-100 text-violet-800 dark:bg-violet-900/30 dark:text-violet-400',
  'Food': 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400',
  'Real Estate': 'bg-slate-100 text-slate-800 dark:bg-slate-900/30 dark:text-slate-400',
  'Retail': 'bg-pink-100 text-pink-800 dark:bg-pink-900/30 dark:text-pink-400',
  'Media': 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
  'Education': 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-400',
  'Mobility': 'bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-400',
};

// Couleurs des types d'investissement
export const investmentTypeColors: Record<string, string> = {
  'Share': 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  'BSA Air': 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
  'Royalties': 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400',
  'SPV': 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  'Obligations': 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400',
};

export const getSectorColor = (sector: string | null): string => {
  if (!sector) return 'bg-muted text-muted-foreground';
  return sectorColors[sector] || 'bg-muted text-muted-foreground';
};

export const getInvestmentTypeColor = (type: string | null): string => {
  if (!type) return 'bg-muted text-muted-foreground';
  return investmentTypeColors[type] || 'bg-muted text-muted-foreground';
};
