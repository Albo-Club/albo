import { useEffect, useState, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';

export function useProfileCompletion() {
  const navigate = useNavigate();
  const location = useLocation();
  const [isChecking, setIsChecking] = useState(true);
  const [isComplete, setIsComplete] = useState(true);

  const checkProfile = useCallback(async () => {
    // Récupérer l'utilisateur connecté
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      setIsChecking(false);
      return;
    }

    // Pages autorisées même avec profil incomplet (inclut tout le flux d'onboarding)
    const allowedPaths = [
      '/auth', 
      '/auth/callback',
      '/logout', 
      '/login', 
      '/reset-password', 
      '/setup-password', 
      '/invite',
      '/onboarding'
    ];
    const isAllowedPath = allowedPaths.some(path => location.pathname.startsWith(path));
    
    if (isAllowedPath) {
      setIsChecking(false);
      return;
    }

    // Vérifier si le profil est complet
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('is_complete')
      .eq('id', user.id)
      .maybeSingle();

    if (error) {
      console.error('Erreur vérification profil:', error);
      setIsChecking(false);
      return;
    }

    const profileIsComplete = profile?.is_complete ?? true;
    setIsComplete(profileIsComplete);
    
    // Redirection forcée si profil incomplet -> vers le nouveau flow d'onboarding
    if (!profileIsComplete) {
      navigate('/onboarding/workspace', { 
        replace: true,
        state: { from: location.pathname }
      });
    }

    setIsChecking(false);
  }, [location.pathname, navigate]);

  useEffect(() => {
    checkProfile();

    // Écouter les changements d'auth
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_IN') {
        setTimeout(() => {
          checkProfile();
        }, 0);
      }
    });

    return () => subscription.unsubscribe();
  }, [checkProfile]);

  return { isChecking, isComplete };
}
