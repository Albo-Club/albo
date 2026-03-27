/**
 * 🧭 Hook: useOnboardingNavigation
 * 
 * Gère la redirection automatique basée sur le statut d'onboarding.
 * À utiliser dans les guards et les pages protégées.
 */

import { useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { 
  OnboardingStatus, 
  getOnboardingRoute,
  isOnboardingComplete,
} from '@/types/onboarding';
import { useOnboardingStatus } from './useOnboardingStatus';

// ============================================================
// CONFIGURATION
// ============================================================

/**
 * Routes qui ne nécessitent pas de vérification d'onboarding
 */
const ONBOARDING_EXEMPT_ROUTES = [
  '/auth',
  '/auth/callback',
  '/reset-password',
  '/setup-password',
  '/invite',
  '/logout',
  '/onboarding',
];

/**
 * Routes d'onboarding (où l'utilisateur peut être pendant l'onboarding)
 */
const ONBOARDING_ROUTES = [
  '/onboarding/workspace',
  '/onboarding/profile',
  '/onboarding/invite',
  '/onboarding/import-portfolio',
  '/onboarding/connect-email',
];

// ============================================================
// TYPES
// ============================================================

interface UseOnboardingNavigationOptions {
  /** Activer la redirection automatique */
  autoRedirect?: boolean;
  
  /** Callback appelé après redirection */
  onRedirect?: (from: string, to: string) => void;
}

interface UseOnboardingNavigationReturn {
  /** L'utilisateur est-il sur une page d'onboarding ? */
  isOnOnboardingPage: boolean;
  
  /** L'utilisateur doit-il être redirigé ? */
  shouldRedirect: boolean;
  
  /** Route vers laquelle rediriger */
  redirectTo: string | null;
  
  /** Forcer la navigation vers la bonne étape d'onboarding */
  navigateToCurrentStep: () => void;
  
  /** Vérifier si une route est accessible avec le statut actuel */
  canAccessRoute: (route: string) => boolean;
}

// ============================================================
// HOOK
// ============================================================

export function useOnboardingNavigation(
  options: UseOnboardingNavigationOptions = {}
): UseOnboardingNavigationReturn {
  const { autoRedirect = true, onRedirect } = options;
  
  const navigate = useNavigate();
  const location = useLocation();
  const { status, loading, isComplete } = useOnboardingStatus();

  // --------------------------------------------------------
  // Helpers
  // --------------------------------------------------------
  
  /**
   * Vérifie si la route actuelle est une route d'onboarding
   */
  const isOnOnboardingPage = ONBOARDING_ROUTES.some(
    route => location.pathname.startsWith(route)
  );

  /**
   * Vérifie si la route actuelle est exempte de vérification
   */
  const isExemptRoute = ONBOARDING_EXEMPT_ROUTES.some(
    route => location.pathname.startsWith(route)
  );

  /**
   * Détermine si l'utilisateur peut accéder à une route donnée
   */
  const canAccessRoute = useCallback((route: string): boolean => {
    // Routes exemptées toujours accessibles
    if (ONBOARDING_EXEMPT_ROUTES.some(r => route.startsWith(r))) {
      return true;
    }

    // Si pas de statut, attendre le chargement
    if (!status) return true;

    // Si onboarding terminé, tout est accessible
    if (isOnboardingComplete(status)) {
      return true;
    }

    // Sinon, vérifier si c'est la bonne page d'onboarding
    const expectedRoute = getOnboardingRoute(status);
    return route.startsWith(expectedRoute);
  }, [status]);

  /**
   * Calcule la route de redirection nécessaire
   */
  const getRedirectRoute = useCallback((): string | null => {
    // Pas de redirection si chargement en cours
    if (loading) return null;

    // Pas de redirection pour les routes exemptées
    if (isExemptRoute) return null;

    // Pas de statut = pas de redirection
    if (!status) return null;

    // Si onboarding terminé mais sur une page d'onboarding, aller au dashboard
    if (isComplete && isOnOnboardingPage) {
      return '/dashboard';
    }

    // Si onboarding non terminé et pas sur la bonne page
    if (!isComplete) {
      const expectedRoute = getOnboardingRoute(status);
      
      // Ne pas rediriger si déjà sur la bonne page
      if (location.pathname.startsWith(expectedRoute)) {
        return null;
      }

      // Ne pas rediriger si sur une page d'onboarding
      // (permet de naviguer entre les étapes)
      if (isOnOnboardingPage) {
        return null;
      }

      return expectedRoute;
    }

    return null;
  }, [loading, isExemptRoute, status, isComplete, isOnOnboardingPage, location.pathname]);

  const redirectTo = getRedirectRoute();
  const shouldRedirect = redirectTo !== null;

  // --------------------------------------------------------
  // Effet de redirection automatique
  // --------------------------------------------------------
  useEffect(() => {
    if (!autoRedirect || !shouldRedirect || !redirectTo) {
      return;
    }

    // Appeler le callback si fourni
    if (onRedirect) {
      onRedirect(location.pathname, redirectTo);
    }

    // Effectuer la redirection
    navigate(redirectTo, { replace: true });
  }, [autoRedirect, shouldRedirect, redirectTo, navigate, location.pathname, onRedirect]);

  // --------------------------------------------------------
  // Actions
  // --------------------------------------------------------

  /**
   * Force la navigation vers l'étape d'onboarding actuelle
   */
  const navigateToCurrentStep = useCallback(() => {
    if (!status) return;

    const route = getOnboardingRoute(status);
    navigate(route, { replace: true });
  }, [status, navigate]);

  return {
    isOnOnboardingPage,
    shouldRedirect,
    redirectTo,
    navigateToCurrentStep,
    canAccessRoute,
  };
}

// ============================================================
// COMPOSANT GUARD
// ============================================================

/**
 * Guard qui redirige automatiquement vers la bonne étape d'onboarding
 * 
 * @example
 * ```tsx
 * <OnboardingGuard>
 *   <Dashboard />
 * </OnboardingGuard>
 * ```
 */
export function OnboardingGuard({ children }: { children: React.ReactNode }) {
  const { shouldRedirect } = useOnboardingNavigation({ autoRedirect: true });
  const { loading } = useOnboardingStatus();

  // Pendant le chargement ou la redirection, afficher un loader
  if (loading || shouldRedirect) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return <>{children}</>;
}
