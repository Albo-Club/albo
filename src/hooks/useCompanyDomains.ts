import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export interface CompanyDomain {
  id: string;
  company_id: string;
  domain: string;
  is_primary: boolean;
  created_at: string;
  created_by: string | null;
}

const GENERIC_DOMAINS = [
  'gmail.com', 'outlook.com', 'hotmail.com', 'yahoo.com', 'icloud.com',
  'live.com', 'msn.com', 'aol.com', 'protonmail.com', 'mail.com',
  'yahoo.fr', 'orange.fr', 'free.fr', 'sfr.fr', 'laposte.net',
];

const N8N_WEBHOOK_URL = 'https://n8n.alboteam.com/webhook/scan-new-domain';

function cleanDomain(input: string): string {
  let d = input.trim().toLowerCase();
  // Extract domain from email address
  if (d.includes('@')) {
    d = d.split('@').pop() || '';
  }
  // Remove protocol
  d = d.replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/.*$/, '');
  return d;
}

export function useCompanyDomains(companyId: string | undefined) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const queryKey = ['company-domains', companyId];

  const { data: domains = [], isLoading } = useQuery({
    queryKey,
    queryFn: async () => {
      if (!companyId) return [];
      const { data, error } = await supabase
        .from('company_domains')
        .select('*')
        .eq('company_id', companyId)
        .order('is_primary', { ascending: false })
        .order('created_at', { ascending: true });
      if (error) throw error;
      return data as CompanyDomain[];
    },
    enabled: !!companyId,
  });

  const addDomainMutation = useMutation({
    mutationFn: async (rawDomain: string) => {
      if (!companyId || !user?.id) throw new Error('Missing context');

      const domain = cleanDomain(rawDomain);
      if (!domain) throw new Error('Domaine invalide');
      if (GENERIC_DOMAINS.includes(domain)) {
        throw new Error(`"${domain}" est un domaine générique et ne peut pas être ajouté`);
      }
      if (domains.some(d => d.domain === domain)) {
        throw new Error(`"${domain}" est déjà ajouté`);
      }

      const isPrimary = domains.length === 0;

      const { data, error } = await supabase
        .from('company_domains')
        .insert({
          company_id: companyId,
          domain,
          is_primary: isPrimary,
          created_by: user.id,
        })
        .select()
        .single();

      if (error) throw error;

      // Fire webhook in background
      fetch(N8N_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ company_id: companyId, domain, user_id: user.id }),
      }).catch(console.error);

      return data as CompanyDomain;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      toast.success('Domaine ajouté — Recherche d\'emails en cours...');
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });

  const removeDomainMutation = useMutation({
    mutationFn: async (domainId: string) => {
      const { error } = await supabase
        .from('company_domains')
        .delete()
        .eq('id', domainId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      toast.success('Domaine supprimé');
    },
    onError: () => {
      toast.error('Erreur lors de la suppression');
    },
  });

  const setPrimaryMutation = useMutation({
    mutationFn: async (domainId: string) => {
      if (!companyId) throw new Error('Missing companyId');
      // Unset all primary
      await supabase
        .from('company_domains')
        .update({ is_primary: false })
        .eq('company_id', companyId);
      // Set new primary
      const { error } = await supabase
        .from('company_domains')
        .update({ is_primary: true })
        .eq('id', domainId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      toast.success('Domaine principal mis à jour');
    },
    onError: () => {
      toast.error('Erreur lors de la mise à jour');
    },
  });

  return {
    domains,
    isLoading,
    addDomain: (domain: string) => addDomainMutation.mutateAsync(domain),
    removeDomain: (domainId: string) => removeDomainMutation.mutateAsync(domainId),
    setPrimaryDomain: (domainId: string) => setPrimaryMutation.mutateAsync(domainId),
    isAdding: addDomainMutation.isPending,
  };
}
