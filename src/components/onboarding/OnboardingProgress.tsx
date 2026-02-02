/**
 * 📊 OnboardingProgress
 * 
 * Barre de progression affichant les étapes de l'onboarding.
 * Inspirée de Twenty CRM avec un design moderne.
 */

import { useMemo } from 'react';
import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useOnboardingStatus } from '@/hooks/useOnboardingStatus';
import { 
  OnboardingStatus, 
  ONBOARDING_STEPS,
  OnboardingStep 
} from '@/types/onboarding';

interface OnboardingProgressProps {
  /** Variante d'affichage */
  variant?: 'default' | 'compact';
  
  /** Afficher les labels des étapes */
  showLabels?: boolean;
}

export function OnboardingProgress({ 
  variant = 'default',
  showLabels = true 
}: OnboardingProgressProps) {
  const { status } = useOnboardingStatus();

  // Ordre des étapes (excluant COMPLETED qui n'est pas vraiment une "étape")
  const steps = useMemo(() => {
    const stepOrder: OnboardingStatus[] = [
      OnboardingStatus.PROFILE_PENDING,
      OnboardingStatus.WORKSPACE_PENDING,
      OnboardingStatus.INVITE_TEAM,
      OnboardingStatus.CONNECT_EMAIL,
    ];
    
    return stepOrder.map(s => ONBOARDING_STEPS[s]);
  }, []);

  // Index de l'étape actuelle
  const currentStepIndex = useMemo(() => {
    if (!status) return -1;
    if (status === OnboardingStatus.COMPLETED) return steps.length;
    return steps.findIndex(s => s.id === status);
  }, [status, steps]);

  if (variant === 'compact') {
    return (
      <div className="flex items-center gap-2">
        {steps.map((step, index) => {
          const isCompleted = index < currentStepIndex;
          const isCurrent = index === currentStepIndex;
          
          return (
            <div
              key={step.id}
              className={cn(
                'h-2 flex-1 rounded-full transition-colors',
                isCompleted && 'bg-primary',
                isCurrent && 'bg-primary/50',
                !isCompleted && !isCurrent && 'bg-muted'
              )}
            />
          );
        })}
      </div>
    );
  }

  return (
    <div className="w-full">
      {/* Ligne de connexion */}
      <div className="relative">
        {/* Background line */}
        <div className="absolute left-0 right-0 top-4 h-0.5 bg-muted" />
        
        {/* Progress line */}
        <div 
          className="absolute left-0 top-4 h-0.5 bg-primary transition-all duration-500"
          style={{ 
            width: `${Math.max(0, (currentStepIndex / (steps.length - 1)) * 100)}%` 
          }}
        />

        {/* Étapes */}
        <div className="relative flex justify-between">
          {steps.map((step, index) => {
            const isCompleted = index < currentStepIndex;
            const isCurrent = index === currentStepIndex;
            
            return (
              <StepIndicator
                key={step.id}
                step={step}
                index={index}
                isCompleted={isCompleted}
                isCurrent={isCurrent}
                showLabel={showLabels}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ============================================================
// Sous-composant : Indicateur d'étape
// ============================================================

interface StepIndicatorProps {
  step: OnboardingStep;
  index: number;
  isCompleted: boolean;
  isCurrent: boolean;
  showLabel: boolean;
}

function StepIndicator({ 
  step, 
  index, 
  isCompleted, 
  isCurrent, 
  showLabel 
}: StepIndicatorProps) {
  return (
    <div className="flex flex-col items-center">
      {/* Cercle / Check */}
      <div
        className={cn(
          'flex h-8 w-8 items-center justify-center rounded-full border-2 transition-all duration-300',
          isCompleted && 'border-primary bg-primary text-primary-foreground',
          isCurrent && 'border-primary bg-background text-primary',
          !isCompleted && !isCurrent && 'border-muted bg-background text-muted-foreground'
        )}
      >
        {isCompleted ? (
          <Check className="h-4 w-4" />
        ) : (
          <span className="text-sm font-medium">{index + 1}</span>
        )}
      </div>

      {/* Label */}
      {showLabel && (
        <div className="mt-2 text-center">
          <span
            className={cn(
              'text-xs font-medium transition-colors',
              isCurrent && 'text-foreground',
              isCompleted && 'text-primary',
              !isCompleted && !isCurrent && 'text-muted-foreground'
            )}
          >
            {step.title.split(' ').slice(0, 2).join(' ')}
          </span>
        </div>
      )}
    </div>
  );
}

// ============================================================
// Variante simplifiée pour les petits écrans
// ============================================================

export function OnboardingProgressMobile() {
  const { status } = useOnboardingStatus();
  
  const totalSteps = 4;
  const currentStep = useMemo(() => {
    if (!status) return 0;
    switch (status) {
      case OnboardingStatus.PROFILE_PENDING:
        return 1;
      case OnboardingStatus.WORKSPACE_PENDING:
        return 2;
      case OnboardingStatus.INVITE_TEAM:
        return 3;
      case OnboardingStatus.CONNECT_EMAIL:
        return 4;
      case OnboardingStatus.COMPLETED:
        return totalSteps;
      default:
        return 0;
    }
  }, [status]);

  return (
    <div className="flex items-center gap-1 text-sm text-muted-foreground">
      <span className="font-medium text-foreground">{currentStep}</span>
      <span>/ {totalSteps}</span>
    </div>
  );
}
