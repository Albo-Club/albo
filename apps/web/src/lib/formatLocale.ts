import i18n from '@/i18n/config';

export function formatCurrency(amountCents: number): string {
  const amount = amountCents / 100;
  const locale = i18n.language === 'en' ? 'en-US' : 'fr-FR';
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatNumber(value: number): string {
  const locale = i18n.language === 'en' ? 'en-US' : 'fr-FR';
  return new Intl.NumberFormat(locale).format(value);
}

export function formatDate(date: string | Date): string {
  const locale = i18n.language === 'en' ? 'en-US' : 'fr-FR';
  return new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(new Date(date));
}
