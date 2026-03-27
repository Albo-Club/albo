import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let _client: SupabaseClient | null = null;

export const supabase = new Proxy({} as SupabaseClient, {
  get(_target, prop) {
    if (!_client) {
      const url = process.env.SUPABASE_URL;
      const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
      if (!url || !key) {
        throw new Error(`[supabase] SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY manquant (url=${!!url}, key=${!!key})`);
      }
      _client = createClient(url, key);
    }
    return (_client as any)[prop];
  },
});
