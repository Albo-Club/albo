// Liste complète des 21 secteurs avec couleurs
export const SECTOR_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  'Agriculture': { bg: 'bg-lime-100 dark:bg-lime-900/30', text: 'text-lime-800 dark:text-lime-400', border: 'border-lime-300 dark:border-lime-700' },
  'B2C': { bg: 'bg-pink-100 dark:bg-pink-900/30', text: 'text-pink-800 dark:text-pink-400', border: 'border-pink-300 dark:border-pink-700' },
  'Beauty': { bg: 'bg-fuchsia-100 dark:bg-fuchsia-900/30', text: 'text-fuchsia-800 dark:text-fuchsia-400', border: 'border-fuchsia-300 dark:border-fuchsia-700' },
  'Biodiversity': { bg: 'bg-emerald-100 dark:bg-emerald-900/30', text: 'text-emerald-800 dark:text-emerald-400', border: 'border-emerald-300 dark:border-emerald-700' },
  'Biotech': { bg: 'bg-purple-100 dark:bg-purple-900/30', text: 'text-purple-800 dark:text-purple-400', border: 'border-purple-300 dark:border-purple-700' },
  'Childhood': { bg: 'bg-amber-100 dark:bg-amber-900/30', text: 'text-amber-800 dark:text-amber-400', border: 'border-amber-300 dark:border-amber-700' },
  'Circularity': { bg: 'bg-teal-100 dark:bg-teal-900/30', text: 'text-teal-800 dark:text-teal-400', border: 'border-teal-300 dark:border-teal-700' },
  'Climate': { bg: 'bg-sky-100 dark:bg-sky-900/30', text: 'text-sky-800 dark:text-sky-400', border: 'border-sky-300 dark:border-sky-700' },
  'Deep-Tech': { bg: 'bg-indigo-100 dark:bg-indigo-900/30', text: 'text-indigo-800 dark:text-indigo-400', border: 'border-indigo-300 dark:border-indigo-700' },
  'Education': { bg: 'bg-blue-100 dark:bg-blue-900/30', text: 'text-blue-800 dark:text-blue-400', border: 'border-blue-300 dark:border-blue-700' },
  'Fintech': { bg: 'bg-violet-100 dark:bg-violet-900/30', text: 'text-violet-800 dark:text-violet-400', border: 'border-violet-300 dark:border-violet-700' },
  'Food': { bg: 'bg-orange-100 dark:bg-orange-900/30', text: 'text-orange-800 dark:text-orange-400', border: 'border-orange-300 dark:border-orange-700' },
  'Furnitures & Leisure': { bg: 'bg-stone-100 dark:bg-stone-900/30', text: 'text-stone-800 dark:text-stone-400', border: 'border-stone-300 dark:border-stone-700' },
  'Health & Wellness': { bg: 'bg-green-100 dark:bg-green-900/30', text: 'text-green-800 dark:text-green-400', border: 'border-green-300 dark:border-green-700' },
  'Industrial': { bg: 'bg-slate-100 dark:bg-slate-900/30', text: 'text-slate-800 dark:text-slate-400', border: 'border-slate-300 dark:border-slate-700' },
  'Real Estate': { bg: 'bg-gray-100 dark:bg-gray-900/30', text: 'text-gray-800 dark:text-gray-400', border: 'border-gray-300 dark:border-gray-700' },
  'Retail': { bg: 'bg-rose-100 dark:bg-rose-900/30', text: 'text-rose-800 dark:text-rose-400', border: 'border-rose-300 dark:border-rose-700' },
  'SaaS': { bg: 'bg-cyan-100 dark:bg-cyan-900/30', text: 'text-cyan-800 dark:text-cyan-400', border: 'border-cyan-300 dark:border-cyan-700' },
  'Silver Economy': { bg: 'bg-zinc-100 dark:bg-zinc-900/30', text: 'text-zinc-800 dark:text-zinc-400', border: 'border-zinc-300 dark:border-zinc-700' },
  'Social': { bg: 'bg-yellow-100 dark:bg-yellow-900/30', text: 'text-yellow-800 dark:text-yellow-400', border: 'border-yellow-300 dark:border-yellow-700' },
  'Sport & Leisure': { bg: 'bg-red-100 dark:bg-red-900/30', text: 'text-red-800 dark:text-red-400', border: 'border-red-300 dark:border-red-700' },
};

export const SECTORS_LIST = [
  'Agriculture', 'B2C', 'Beauty', 'Biodiversity', 'Biotech', 'Childhood',
  'Circularity', 'Climate', 'Deep-Tech', 'Education', 'Fintech', 'Food',
  'Furnitures & Leisure', 'Health & Wellness', 'Industrial', 'Real Estate',
  'Retail', 'SaaS', 'Silver Economy', 'Social', 'Sport & Leisure',
];

// Types d'investissement avec couleurs harmonisées
export const INVESTMENT_TYPE_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  'Share': { bg: 'bg-blue-100 dark:bg-blue-900/30', text: 'text-blue-800 dark:text-blue-400', border: 'border-blue-300 dark:border-blue-700' },
  'SPV Share': { bg: 'bg-emerald-100 dark:bg-emerald-900/30', text: 'text-emerald-800 dark:text-emerald-400', border: 'border-emerald-300 dark:border-emerald-700' },
  'BSA Air': { bg: 'bg-amber-100 dark:bg-amber-900/30', text: 'text-amber-800 dark:text-amber-400', border: 'border-amber-300 dark:border-amber-700' },
  'Royalties': { bg: 'bg-purple-100 dark:bg-purple-900/30', text: 'text-purple-800 dark:text-purple-400', border: 'border-purple-300 dark:border-purple-700' },
  'Obligation': { bg: 'bg-slate-100 dark:bg-slate-900/30', text: 'text-slate-800 dark:text-slate-400', border: 'border-slate-300 dark:border-slate-700' },
  'OCA': { bg: 'bg-orange-100 dark:bg-orange-900/30', text: 'text-orange-800 dark:text-orange-400', border: 'border-orange-300 dark:border-orange-700' },
  'SPV SAFE': { bg: 'bg-teal-100 dark:bg-teal-900/30', text: 'text-teal-800 dark:text-teal-400', border: 'border-teal-300 dark:border-teal-700' },
};

export const INVESTMENT_TYPES_LIST = [
  'Share',
  'SPV Share',
  'BSA Air',
  'Royalties',
  'Obligation',
  'OCA',
  'SPV SAFE',
];

export const getSectorColors = (sector: string) => {
  return SECTOR_COLORS[sector] || { 
    bg: 'bg-muted', 
    text: 'text-muted-foreground', 
    border: 'border-muted' 
  };
};

export const getInvestmentTypeColors = (type: string) => {
  return INVESTMENT_TYPE_COLORS[type] || { 
    bg: 'bg-muted', 
    text: 'text-muted-foreground', 
    border: 'border-muted' 
  };
};
