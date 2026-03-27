import { useTranslation } from 'react-i18next';
import { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export type AppLanguage = 'fr' | 'en';

export function useLanguage() {
  const { i18n, t } = useTranslation();
  const { user } = useAuth();

  const currentLanguage = (i18n.language?.startsWith('en') ? 'en' : 'fr') as AppLanguage;

  const changeLanguage = useCallback(async (lang: AppLanguage) => {
    await i18n.changeLanguage(lang);
    localStorage.setItem('albo-language', lang);

    if (user?.id) {
      const { error } = await supabase
        .from('profiles')
        .update({ preferred_language: lang })
        .eq('id', user.id);

      if (error) {
        console.error('Error saving language preference:', error);
      }
    }

    toast.success(t('notifications.languageChanged'));
  }, [i18n, user, t]);

  const toggleLanguage = useCallback(() => {
    const newLang = currentLanguage === 'fr' ? 'en' : 'fr';
    changeLanguage(newLang);
  }, [currentLanguage, changeLanguage]);

  return {
    currentLanguage,
    changeLanguage,
    toggleLanguage,
    isFrench: currentLanguage === 'fr',
    isEnglish: currentLanguage === 'en',
  };
}
