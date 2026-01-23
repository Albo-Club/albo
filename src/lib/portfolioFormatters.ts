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

// Format metric date with day (e.g., "15 Jan 2025")
export const formatMetricDate = (date: string | null | undefined): string => {
  if (!date) return '';
  return new Date(date).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
};

// Format metric key to human-readable label
export const formatMetricLabel = (key: string): string => {
  // Special cases
  const specialCases: Record<string, string> = {
    mrr: 'MRR',
    arr: 'ARR',
    aum: 'AuM',
    ebitda: 'EBITDA',
    yoy: '(YoY)',
    mrr_growth_yoy: 'MRR (YoY)',
    arr_growth_yoy: 'ARR (YoY)',
    aum_growth_yoy: 'AuM (YoY)',
    revenue_growth_yoy: 'Revenue (YoY)',
    employees_growth_yoy: 'Employés (YoY)',
  };

  if (specialCases[key]) return specialCases[key];

  // Remove _cents suffix and format
  let formatted = key.replace(/_cents$/i, '');
  
  // Replace underscores with spaces
  formatted = formatted.replace(/_/g, ' ');
  
  // Handle growth_yoy suffix
  if (formatted.includes('growth yoy')) {
    formatted = formatted.replace(' growth yoy', ' (YoY)');
  }
  
  // Capitalize each word
  formatted = formatted
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
  
  return formatted;
};

// Format metric value based on its type
export const formatMetricValue = (
  value: string | null | undefined,
  metricType: string,
  metricKey: string
): string => {
  if (value === null || value === undefined || value === '') return '-';
  
  const numValue = parseFloat(value);
  if (isNaN(numValue)) return value;
  
  switch (metricType) {
    case 'currency':
      // Check if the key contains "cents" - divide by 100
      if (metricKey.toLowerCase().includes('cents')) {
        return formatNumberCompact(numValue / 100, '€');
      }
      return formatNumberCompact(numValue, '€');
    
    case 'percentage':
      // If stored as decimal (0.15), multiply by 100
      if (Math.abs(numValue) < 10) {
        return `${(numValue * 100).toFixed(1).replace('.', ',')}%`;
      }
      return `${numValue.toFixed(1).replace('.', ',')}%`;
    
    case 'number':
      return numValue.toLocaleString('fr-FR');
    
    case 'months':
      return `${numValue} mois`;
    
    default:
      return value;
  }
};

// Get the icon name for a metric key
export const getMetricIconName = (key: string): string => {
  const iconMap: Record<string, string> = {
    mrr: 'BarChart3',
    arr: 'BarChart3',
    revenue: 'TrendingUp',
    customers: 'Users',
    aum: 'Wallet',
    ebitda: 'PiggyBank',
    cash_position: 'Banknote',
    runway_months: 'Clock',
    employees: 'Users',
    default: 'Activity',
  };
  
  return iconMap[key] || iconMap.default;
};

// Parse report period strings like "November 2025" or "Q4 2025" to Date
export const parseReportPeriod = (period: string | null | undefined): Date | null => {
  if (!period) return null;
  
  const directParse = new Date(period);
  if (!isNaN(directParse.getTime())) return directParse;
  
  // "November 2025" → Date
  const monthYearMatch = period.match(/^(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{4})$/i);
  if (monthYearMatch) {
    const monthNames = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];
    const monthIndex = monthNames.indexOf(monthYearMatch[1].toLowerCase());
    return new Date(parseInt(monthYearMatch[2]), monthIndex, 1);
  }
  
  // "Q4 2025" → Date (Q1=Jan, Q2=Apr, Q3=Jul, Q4=Oct)
  const quarterMatch = period.match(/^Q([1-4])\s+(\d{4})$/i);
  if (quarterMatch) {
    const quarter = parseInt(quarterMatch[1]);
    return new Date(parseInt(quarterMatch[2]), (quarter - 1) * 3, 1);
  }
  
  return null;
};

// Format report period - returns the original string if already well-formatted
export const formatReportPeriod = (period: string | null | undefined): string | null => {
  if (!period) return null;
  if (/^(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{4}$/i.test(period)) return period;
  if (/^Q[1-4]\s+\d{4}$/i.test(period)) return period;
  return period;
};

// Re-export color utilities for backward compatibility
export { getSectorColors as getSectorColor, getInvestmentTypeColors as getInvestmentTypeColor };

