import React from 'react';
import { useTranslation } from 'react-i18next';
import { useLanguage } from '@/hooks/useLanguage';
import { Globe } from 'lucide-react';

interface OnboardingModalProps {
  children: React.ReactNode;
  title: string;
  subtitle: string;
}

export function OnboardingModal({ children, title, subtitle }: OnboardingModalProps) {
  const { t } = useTranslation();
  const { toggleLanguage } = useLanguage();

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl shadow-2xl p-8 w-full max-w-md relative">
        {/* Language switch button */}
        <button
          type="button"
          onClick={toggleLanguage}
          className="absolute top-4 right-4 flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-600 transition-colors"
        >
          <Globe className="h-3.5 w-3.5" />
          {t('onboarding.languageSwitch')}
        </button>

        <h1 className="text-2xl font-semibold text-center text-gray-900">
          {title}
        </h1>
        <p className="text-gray-500 text-center mt-2 mb-8 text-sm">
          {subtitle}
        </p>
        {children}
      </div>
    </div>
  );
}
