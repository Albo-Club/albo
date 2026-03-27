import { useLanguage } from '@/hooks/useLanguage';
import { Button } from '@/components/ui/button';
import { Globe } from 'lucide-react';

interface LanguageSwitcherProps {
  variant?: 'default' | 'ghost' | 'outline';
  showLabel?: boolean;
  size?: 'default' | 'sm' | 'lg' | 'icon';
  className?: string;
}

export function LanguageSwitcher({
  variant = 'ghost',
  showLabel = true,
  size = 'sm',
  className,
}: LanguageSwitcherProps) {
  const { currentLanguage, toggleLanguage } = useLanguage();

  return (
    <Button variant={variant} size={size} onClick={toggleLanguage} className={className}>
      <Globe className="h-4 w-4" />
      {showLabel && (
        <span className="ml-1.5">{currentLanguage === 'fr' ? 'EN' : 'FR'}</span>
      )}
    </Button>
  );
}
