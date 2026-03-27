/**
 * Step: Load Domains
 *
 * Appelle la RPC get_user_portfolio_domains pour récupérer
 * tous les domaines du portfolio de l'utilisateur.
 * Retourne une Map<domain, {company_id, workspace_id}[]>
 */

import { supabase } from "../../lib/supabase.js";

export interface DomainMatch {
  company_id: string;
  workspace_id: string;
}

export type DomainsMap = Map<string, DomainMatch[]>;

export async function loadDomains(userId: string): Promise<DomainsMap> {
  const { data, error } = await supabase.rpc("get_user_portfolio_domains", {
    p_user_id: userId,
  });

  if (error) {
    throw new Error(`get_user_portfolio_domains failed: ${error.message}`);
  }

  const map: DomainsMap = new Map();

  for (const row of data || []) {
    const domain = (row.domain as string)?.toLowerCase();
    if (!domain) continue;

    const existing = map.get(domain) || [];
    existing.push({
      company_id: row.company_id,
      workspace_id: row.workspace_id,
    });
    map.set(domain, existing);
  }

  console.log(`[load-domains] ${map.size} domaines chargés pour user ${userId}`);
  return map;
}
