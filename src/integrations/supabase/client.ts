import { createClient } from '@supabase/supabase-js';

// Configuration Supabase externe - AI Deal Lens
// Votre projet Supabase: kpvbcqilzfeitxzwhmou
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://kpvbcqilzfeitxzwhmou.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || '';

if (!SUPABASE_PUBLISHABLE_KEY) {
  console.warn('⚠️ VITE_SUPABASE_PUBLISHABLE_KEY non configurée. Ajoutez-la dans les variables d\'environnement.');
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    storage: localStorage,
    persistSession: true,
    autoRefreshToken: true,
  }
});
