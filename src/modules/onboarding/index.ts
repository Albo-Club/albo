/**
 * 📦 Module Onboarding - Index
 * 
 * Point d'entrée principal pour le système d'onboarding.
 * Exporte tous les hooks, composants et types.
 */

// ============================================================
// TYPES
// ============================================================

export {
  OnboardingStatus,
  ONBOARDING_STEPS,
  getNextOnboardingStatus,
  getPreviousOnboardingStatus,
  isOnboardingComplete,
  getOnboardingProgress,
  getOnboardingRoute,
} from '@/types/onboarding';

export type {
  OnboardingStep,
  OnboardingUserData,
} from '@/types/onboarding';

// ============================================================
// HOOKS
// ============================================================

export { useOnboardingStatus } from '@/hooks/useOnboardingStatus';
export { 
  useOnboardingNavigation, 
  OnboardingGuard 
} from '@/hooks/useOnboardingNavigation';

// ============================================================
// COMPONENTS
// ============================================================

export { OnboardingLayout } from '@/components/onboarding/OnboardingLayout';
export { 
  OnboardingProgress, 
  OnboardingProgressMobile 
} from '@/components/onboarding/OnboardingProgress';
