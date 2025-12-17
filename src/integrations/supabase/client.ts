import { createClient } from '@supabase/supabase-js';

// Configuration Supabase externe - AI Deal Lens
// Projet: hello@alboteam.com's Project (Organization Albote)
const SUPABASE_URL = 'https://kpvbcqilzfeitxzwhmou.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtwdmJjcWlsemZlaXR4endobW91Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU5NTg1MzQsImV4cCI6MjA4MTUzNDUzNH0.3am-RD8EWk9RtgeHyWYS9HFa9CQGnZzZ-ro6QRKD0f8';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: localStorage,
    persistSession: true,
    autoRefreshToken: true,
  }
});
