/**
 * 🎣 Hook: useOnboardingStatus
 * 
 * Hook principal pour gérer le statut d'onboarding d'un utilisateur.
 * Gère la lecture, la mise à jour et les transitions entre étapes.
 */

import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { 
  OnboardingStatus, 
  getNextOnboardingStatus, 
  getOnboardingRoute,
  isOnboardingComplete,
  ONBOARDING_STEPS,
  OnboardingStep 
} from '@/types/onboarding';

// ============================================================
// TYPES
// ============================================================

interface UseOnboardingStatusReturn {
  /** Statut actuel de l'onboarding */
  status: OnboardingStatus | null;
  
  /** Étape actuelle avec ses métadonnées */
  currentStep: OnboardingStep | null;
  
  /** En cours de chargement */
  loading: boolean;
  
  /** Erreur éventuelle */
  error: string | null;
  
  /** L'onboarding est-il terminé ? */
  isComplete: boolean;
  
  /** Passer à l'étape suivante */
  goToNextStep: () => Promise<void>;
  
  /** Sauter l'étape actuelle (si skippable) */
  skipCurrentStep: () => Promise<void>;
  
  /** Mettre à jour le statut manuellement */
  setOnboardingStatus: (newStatus: OnboardingStatus) => Promise<void>;
  
  /** Marquer l'onboarding comme terminé */
  completeOnboarding: () => Promise<void>;
  
  /** Rafraîchir le statut depuis la DB */
  refreshStatus: () => Promise<void>;
}

// ============================================================
// HOOK
// ============================================================

export function useOnboardingStatus(): UseOnboardingStatusReturn {
  const { user } = useAuth();
  const navigate = useNavigate();
  
  const [status, setStatus] = useState<OnboardingStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // --------------------------------------------------------
  // Charger le statut depuis la base de données
  // --------------------------------------------------------
  const loadStatus = useCallback(async () => {
    if (!user?.id) {
      setStatus(null);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('is_complete, onboarding_status')
        .eq('id', user.id)
        .maybeSingle();

      if (profileError) {
        throw profileError;
      }

      // Si le profil n'existe pas, c'est un nouveau utilisateur
      if (!profile) {
        setStatus(OnboardingStatus.PROFILE_PENDING);
        setLoading(false);
        return;
      }

      // Déterminer le statut basé sur les données du profil
      if (profile.onboarding_status) {
        // Si on a un statut explicite, l'utiliser
        setStatus(profile.onboarding_status as OnboardingStatus);
      } else if (!profile.is_complete) {
        // Si le profil n'est pas complet, rester sur PROFILE_PENDING
        setStatus(OnboardingStatus.PROFILE_PENDING);
      } else {
        // Vérifier si l'utilisateur a un workspace
        const { data: workspaces } = await supabase
          .from('workspace_members')
          .select('workspace_id')
          .eq('user_id', user.id)
          .limit(1);

        if (!workspaces || workspaces.length === 0) {
          setStatus(OnboardingStatus.WORKSPACE_PENDING);
        } else {
          // L'utilisateur a un workspace, onboarding terminé
          setStatus(OnboardingStatus.COMPLETED);
        }
      }
    } catch (err: any) {
      console.error('Error loading onboarding status:', err);
      setError(err.message || 'Erreur lors du chargement du statut');
      setStatus(OnboardingStatus.PROFILE_PENDING);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  // Charger le statut au montage et quand l'utilisateur change
  useEffect(() => {
    loadStatus();
  }, [loadStatus]);

  // --------------------------------------------------------
  // Mettre à jour le statut dans la DB
  // --------------------------------------------------------
  const updateStatusInDB = useCallback(async (newStatus: OnboardingStatus) => {
    if (!user?.id) return;

    const updates: Record<string, any> = {
      onboarding_status: newStatus,
    };

    // Si on passe à COMPLETED, enregistrer la date
    if (newStatus === OnboardingStatus.COMPLETED) {
      updates.onboarding_completed_at = new Date().toISOString();
    }

    const { error: updateError } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', user.id);

    if (updateError) {
      throw updateError;
    }
  }, [user?.id]);

  // --------------------------------------------------------
  // Actions publiques
  // --------------------------------------------------------

  /**
   * Passer à l'étape suivante
   */
  const goToNextStep = useCallback(async () => {
    if (!status) return;

    const nextStatus = getNextOnboardingStatus(status);
    
    if (!nextStatus) {
      // Déjà à la dernière étape
      return;
    }

    try {
      await updateStatusInDB(nextStatus);
      setStatus(nextStatus);
      
      // Naviguer vers la nouvelle page
      const nextRoute = getOnboardingRoute(nextStatus);
      navigate(nextRoute);
    } catch (err: any) {
      console.error('Error advancing to next step:', err);
      setError(err.message);
    }
  }, [status, updateStatusInDB, navigate]);

  /**
   * Sauter l'étape actuelle (si possible)
   */
  const skipCurrentStep = useCallback(async () => {
    if (!status) return;

    const currentStep = ONBOARDING_STEPS[status];
    
    if (!currentStep.skippable) {
      console.warn('Cette étape ne peut pas être sautée');
      return;
    }

    // Passer à l'étape suivante
    await goToNextStep();
  }, [status, goToNextStep]);

  /**
   * Mettre à jour le statut manuellement
   */
  const setOnboardingStatus = useCallback(async (newStatus: OnboardingStatus) => {
    try {
      await updateStatusInDB(newStatus);
      setStatus(newStatus);
    } catch (err: any) {
      console.error('Error setting onboarding status:', err);
      setError(err.message);
    }
  }, [updateStatusInDB]);

  /**
   * Marquer l'onboarding comme terminé
   */
  const completeOnboarding = useCallback(async () => {
    try {
      await updateStatusInDB(OnboardingStatus.COMPLETED);
      setStatus(OnboardingStatus.COMPLETED);
      navigate('/dashboard');
    } catch (err: any) {
      console.error('Error completing onboarding:', err);
      setError(err.message);
    }
  }, [updateStatusInDB, navigate]);

  /**
   * Rafraîchir le statut depuis la DB
   */
  const refreshStatus = useCallback(async () => {
    await loadStatus();
  }, [loadStatus]);

  // --------------------------------------------------------
  // Valeurs dérivées
  // --------------------------------------------------------
  const currentStep = status ? ONBOARDING_STEPS[status] : null;
  const isComplete = status ? isOnboardingComplete(status) : false;

  return {
    status,
    currentStep,
    loading,
    error,
    isComplete,
    goToNextStep,
    skipCurrentStep,
    setOnboardingStatus,
    completeOnboarding,
    refreshStatus,
  };
}
