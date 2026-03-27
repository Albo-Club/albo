/**
 * 🎨 OnboardingLayout
 * 
 * Layout commun pour toutes les pages d'onboarding.
 * Affiche le logo, la barre de progression et le contenu de l'étape.
 */

import { ReactNode } from 'react';
import { useOnboardingStatus } from '@/hooks/useOnboardingStatus';
import { OnboardingProgress } from './OnboardingProgress';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface OnboardingLayoutProps {
  children: ReactNode;
  
  /** Afficher la barre de progression */
  showProgress?: boolean;
  
  /** Afficher le bouton "Passer" si l'étape est skippable */
  showSkip?: boolean;
  
  /** Titre personnalisé (sinon utilise celui de l'étape) */
  title?: string;
  
  /** Description personnalisée */
  description?: string;
}

export function OnboardingLayout({
  children,
  showProgress = true,
  showSkip = true,
  title,
  description,
}: OnboardingLayoutProps) {
  const { currentStep, loading, skipCurrentStep } = useOnboardingStatus();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const displayTitle = title || currentStep?.title || 'Bienvenue';
  const displayDescription = description || currentStep?.description;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header avec logo et progression */}
      <header className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="container max-w-3xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            {/* Logo */}
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground font-bold text-lg">
                A
              </div>
              <span className="font-semibold text-lg">Albo</span>
            </div>

            {/* Bouton Passer (si applicable) */}
            {showSkip && currentStep?.skippable && (
              <Button
                variant="ghost"
                size="sm"
                onClick={skipCurrentStep}
                className="text-muted-foreground hover:text-foreground"
              >
                Passer cette étape →
              </Button>
            )}
          </div>

          {/* Barre de progression */}
          {showProgress && currentStep && (
            <div className="mt-4">
              <OnboardingProgress variant="default" showLabels />
            </div>
          )}
        </div>
      </header>

      {/* Contenu principal */}
      <main className="flex-1 flex items-center justify-center p-4 py-8">
        <div className="w-full max-w-lg">
          {/* Titre et description */}
          <div className="text-center mb-8">
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
              {displayTitle}
            </h1>
            {displayDescription && (
              <p className="mt-2 text-muted-foreground">
                {displayDescription}
              </p>
            )}
          </div>

          {/* Contenu de l'étape */}
          <div className="space-y-6">
            {children}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t py-4">
        <div className="container max-w-3xl mx-auto px-4">
          <p className="text-center text-sm text-muted-foreground">
            Besoin d'aide ?{' '}
            <a 
              href="mailto:hello@alboteam.com" 
              className="text-primary hover:underline"
            >
              Contactez-nous
            </a>
          </p>
        </div>
      </footer>
    </div>
  );
}
