import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface CompanyNewsItem {
  id: string;
  title: string;
  description: string | null;
  source_name: string | null;
  source_url: string | null;
  image_url: string | null;
  published_at: string | null;
  source_type: string | null;
}

export function useCompanyNews(companyId: string | undefined) {
  return useQuery({
    queryKey: ["company-news", companyId],
    queryFn: async () => {
      if (!companyId) return [];
      const { data, error } = await supabase
        .from("company_news")
        .select("id, title, description, source_name, source_url, image_url, published_at, source_type")
        .eq("company_id", companyId)
        .eq("is_displayed", true)
        .order("published_at", { ascending: false })
        .limit(10);
      if (error) throw error;
      return (data || []) as CompanyNewsItem[];
    },
    enabled: !!companyId,
  });
}
