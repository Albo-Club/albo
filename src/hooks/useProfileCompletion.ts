import { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export function useProfileCompletion() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [isChecking, setIsChecking] = useState(true);
  const [isComplete, setIsComplete] = useState(true);

  useEffect(() => {
    async function checkProfile() {
      if (!user) {
        setIsChecking(false);
        return;
      }

      // Pages autorisées même avec profil incomplet
      const allowedPaths = ['/complete-profile', '/auth', '/logout', '/login', '/reset-password', '/setup-password', '/invite'];
      if (allowedPaths.some(path => location.pathname.startsWith(path))) {
        setIsChecking(false);
        return;
      }

      const { data: profile, error } = await supabase
        .from('profiles')
        .select('is_complete')
        .eq('id', user.id)
        .maybeSingle();

      if (error || !profile) {
        setIsChecking(false);
        return;
      }

      const profileComplete = profile.is_complete ?? true;
      setIsComplete(profileComplete);
      
      // Redirection forcée si profil incomplet
      if (profileComplete === false) {
        navigate('/complete-profile', { 
          replace: true,
          state: { from: location.pathname }
        });
      }

      setIsChecking(false);
    }

    checkProfile();
  }, [user, location.pathname, navigate]);

  return { isChecking, isComplete };
}
