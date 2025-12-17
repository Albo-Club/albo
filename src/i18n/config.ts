import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

const resources = {
  fr: {
    translation: {
      common: {
        loading: 'Chargement...',
        error: 'Une erreur est survenue',
        success: 'Succès',
        cancel: 'Annuler',
        save: 'Enregistrer',
        delete: 'Supprimer',
        edit: 'Modifier',
        view: 'Voir',
        back: 'Retour',
        next: 'Suivant',
        previous: 'Précédent',
        submit: 'Soumettre',
        search: 'Rechercher',
      },
      auth: {
        signIn: 'Se connecter',
        signUp: 'S\'inscrire',
        signOut: 'Se déconnecter',
        email: 'Email',
        password: 'Mot de passe',
        name: 'Nom complet',
        forgotPassword: 'Mot de passe oublié ?',
        resetPassword: 'Réinitialiser le mot de passe',
        continueWithGoogle: 'Continuer avec Google',
        orContinueWith: 'Ou continuer avec',
      },
      dashboard: {
        title: 'Mes Deals',
        subtitle: 'Suivez et analysez vos opportunités d\'investissement',
        submitDeal: 'Soumettre un Deal',
        searchPlaceholder: 'Rechercher une entreprise...',
        noDeals: 'Aucun deal trouvé',
      },
      deal: {
        status: {
          pending: 'En cours',
          completed: 'Analysé',
          error: 'Erreur',
        },
      },
    },
  },
  en: {
    translation: {
      common: {
        loading: 'Loading...',
        error: 'An error occurred',
        success: 'Success',
        cancel: 'Cancel',
        save: 'Save',
        delete: 'Delete',
        edit: 'Edit',
        view: 'View',
        back: 'Back',
        next: 'Next',
        previous: 'Previous',
        submit: 'Submit',
        search: 'Search',
      },
      auth: {
        signIn: 'Sign In',
        signUp: 'Sign Up',
        signOut: 'Sign Out',
        email: 'Email',
        password: 'Password',
        name: 'Full Name',
        forgotPassword: 'Forgot password?',
        resetPassword: 'Reset Password',
        continueWithGoogle: 'Continue with Google',
        orContinueWith: 'Or continue with',
      },
      dashboard: {
        title: 'My Deals',
        subtitle: 'Track and analyze your investment opportunities',
        submitDeal: 'Submit Deal',
        searchPlaceholder: 'Search company...',
        noDeals: 'No deals found',
      },
      deal: {
        status: {
          pending: 'Pending',
          completed: 'Analyzed',
          error: 'Error',
        },
      },
    },
  },
};

i18n.use(initReactI18next).init({
  resources,
  lng: 'fr',
  fallbackLng: 'fr',
  interpolation: {
    escapeValue: false,
  },
});

export default i18n;
