/**
 * 🎯 Onboarding Types for Albo
 * 
 * Inspiré du système Twenty CRM, adapté pour Albo.
 * Ce fichier définit tous les statuts possibles d'onboarding d'un utilisateur.
 */

// ============================================================
// ENUM: Statuts d'Onboarding
// ============================================================

/**
 * Représente les différentes étapes du processus d'onboarding.
 * Chaque utilisateur a un statut qui détermine où il en est.
 * 
 * IMPORTANT: L'ordre des valeurs correspond à la progression naturelle.
 */
export enum OnboardingStatus {
  // 🔐 Authentification terminée mais profil non complété
  PROFILE_PENDING = 'profile_pending',
  
  // 👤 Profil complété, doit créer/rejoindre un workspace
  WORKSPACE_PENDING = 'workspace_pending',
  
  // 🏢 Workspace créé/rejoint, peut inviter l'équipe (optionnel)
  INVITE_TEAM = 'invite_team',
  
  // 📧 Équipe invitée, peut connecter un email (optionnel)
  CONNECT_EMAIL = 'connect_email',
  
  // ✅ Onboarding terminé, accès complet à l'app
  COMPLETED = 'completed',
}

// ============================================================
// TYPES: Configuration des étapes
// ============================================================

/**
 * Configuration d'une étape d'onboarding
 */
export interface OnboardingStep {
  /** Identifiant unique de l'étape */
  id: OnboardingStatus;
  
  /** Titre affiché */
  title: string;
  
  /** Description courte */
  description: string;
  
  /** Route de la page correspondante */
  path: string;
  
  /** Numéro de l'étape (pour la progress bar) */
  stepNumber: number;
  
  /** L'étape peut-elle être ignorée ? */
  skippable: boolean;
  
  /** Icône (nom Lucide) */
  icon: string;
}

/**
 * Mapping complet des étapes d'onboarding
 */
export const ONBOARDING_STEPS: Record<OnboardingStatus, OnboardingStep> = {
  [OnboardingStatus.PROFILE_PENDING]: {
    id: OnboardingStatus.PROFILE_PENDING,
    title: 'Create your profile',
    description: 'Tell us about yourself',
    path: '/onboarding/profile',
    stepNumber: 2,
    skippable: false,
    icon: 'User',
  },
  [OnboardingStatus.WORKSPACE_PENDING]: {
    id: OnboardingStatus.WORKSPACE_PENDING,
    title: 'Create your workspace',
    description: 'A shared environment for your team',
    path: '/onboarding/workspace',
    stepNumber: 1,
    skippable: false,
    icon: 'Building2',
  },
  [OnboardingStatus.INVITE_TEAM]: {
    id: OnboardingStatus.INVITE_TEAM,
    title: 'Invite your team',
    description: 'Get your team onboarded quickly',
    path: '/onboarding/invite',
    stepNumber: 3,
    skippable: true,
    icon: 'Users',
  },
  [OnboardingStatus.CONNECT_EMAIL]: {
    id: OnboardingStatus.CONNECT_EMAIL,
    title: 'Connect your email',
    description: 'Link your inbox to manage communications',
    path: '/onboarding/connect-email',
    stepNumber: 4,
    skippable: true,
    icon: 'Mail',
  },
  [OnboardingStatus.COMPLETED]: {
    id: OnboardingStatus.COMPLETED,
    title: 'Welcome to Albo!',
    description: 'You are ready to manage your deals.',
    path: '/dashboard',
    stepNumber: 5,
    skippable: false,
    icon: 'CheckCircle',
  },
};

// ============================================================
// TYPES: Données utilisateur liées à l'onboarding
// ============================================================

/**
 * Données d'onboarding stockées dans le profil utilisateur
 */
export interface OnboardingUserData {
  /** Statut actuel de l'onboarding */
  onboarding_status: OnboardingStatus;
  
  /** Date de début de l'onboarding */
  onboarding_started_at: string | null;
  
  /** Date de fin de l'onboarding (quand completed) */
  onboarding_completed_at: string | null;
  
  /** Étapes ignorées par l'utilisateur */
  skipped_steps: OnboardingStatus[];
}

// ============================================================
// HELPERS: Fonctions utilitaires
// ============================================================

/**
 * Retourne l'étape suivante dans le flux d'onboarding
 */
export function getNextOnboardingStatus(
  currentStatus: OnboardingStatus
): OnboardingStatus | null {
  const statusOrder: OnboardingStatus[] = [
    OnboardingStatus.PROFILE_PENDING,
    OnboardingStatus.WORKSPACE_PENDING,
    OnboardingStatus.INVITE_TEAM,
    OnboardingStatus.CONNECT_EMAIL,
    OnboardingStatus.COMPLETED,
  ];
  
  const currentIndex = statusOrder.indexOf(currentStatus);
  
  if (currentIndex === -1 || currentIndex >= statusOrder.length - 1) {
    return null; // Déjà à la dernière étape ou statut invalide
  }
  
  return statusOrder[currentIndex + 1];
}

/**
 * Retourne l'étape précédente dans le flux d'onboarding
 */
export function getPreviousOnboardingStatus(
  currentStatus: OnboardingStatus
): OnboardingStatus | null {
  const statusOrder: OnboardingStatus[] = [
    OnboardingStatus.PROFILE_PENDING,
    OnboardingStatus.WORKSPACE_PENDING,
    OnboardingStatus.INVITE_TEAM,
    OnboardingStatus.CONNECT_EMAIL,
    OnboardingStatus.COMPLETED,
  ];
  
  const currentIndex = statusOrder.indexOf(currentStatus);
  
  if (currentIndex <= 0) {
    return null; // Déjà à la première étape ou statut invalide
  }
  
  return statusOrder[currentIndex - 1];
}

/**
 * Vérifie si l'onboarding est terminé
 */
export function isOnboardingComplete(status: OnboardingStatus): boolean {
  return status === OnboardingStatus.COMPLETED;
}

/**
 * Retourne le pourcentage de progression de l'onboarding
 */
export function getOnboardingProgress(status: OnboardingStatus): number {
  const step = ONBOARDING_STEPS[status];
  const totalSteps = Object.keys(ONBOARDING_STEPS).length;
  return Math.round((step.stepNumber / totalSteps) * 100);
}

/**
 * Retourne la route correspondant à un statut d'onboarding
 */
export function getOnboardingRoute(status: OnboardingStatus): string {
  return ONBOARDING_STEPS[status].path;
}
