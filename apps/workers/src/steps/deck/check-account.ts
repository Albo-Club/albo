/**
 * Step: Check Account
 * Vérifie si l'expéditeur a un compte dans la table profiles.
 * Si non, le pipeline envoie un email d'invitation au lieu du mémo.
 */

import { supabase } from "../../lib/supabase";

export interface AccountCheck {
  hasAccount: boolean;
  profileId: string | null;
  email: string;
  preferredLanguage: string;
}

export async function checkAccount(senderEmail: string): Promise<AccountCheck> {
  const email = senderEmail.toLowerCase().trim();
  console.log(`[check-account] Checking profile for: ${email}`);

  const { data, error } = await supabase
    .from("profiles")
    .select("id, email, preferred_language")
    .eq("email", email)
    .limit(1);

  if (error) {
    console.error(`[check-account] Supabase error: ${error.message}`);
    return { hasAccount: false, profileId: null, email, preferredLanguage: "fr" };
  }

  if (data && data.length > 0) {
    const lang = data[0].preferred_language || "fr";
    console.log(`[check-account] Found profile: ${data[0].id} (lang: ${lang})`);
    return { hasAccount: true, profileId: data[0].id, email, preferredLanguage: lang };
  }

  console.log(`[check-account] No profile found for ${email}`);
  return { hasAccount: false, profileId: null, email, preferredLanguage: "fr" };
}
