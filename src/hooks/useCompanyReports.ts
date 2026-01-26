import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface ReportFile {
  id: string;
  file_name: string;
  storage_path: string;
  mime_type: string;
  file_type: string;
}

export interface CompanyReport {
  id: string;
  company_id: string;
  report_period: string | null;
  report_date: string | null;
  report_type: string | null;
  processing_status: string | null;
  headline: string | null;
  key_highlights: string[] | null;
  metrics: Record<string, any> | null;
  cleaned_content: string | null;
  created_at: string;
  files: ReportFile[];
}

export function useCompanyReports(companyId: string | undefined) {
  return useQuery({
    queryKey: ['company-reports', companyId],
    queryFn: async () => {
      if (!companyId) return [];

      // Fetch reports with their files
      const { data: reports, error: reportsError } = await supabase
        .from('company_reports')
        .select('*')
        .eq('company_id', companyId)
        .order('report_date', { ascending: false, nullsFirst: false });

      if (reportsError) throw reportsError;
      if (!reports || reports.length === 0) return [];

      // Fetch files for all reports
      const reportIds = reports.map(r => r.id);
      const { data: files, error: filesError } = await supabase
        .from('report_files')
        .select('*')
        .in('report_id', reportIds);

      if (filesError) throw filesError;

      // Map files to their reports
      const filesMap = new Map<string, ReportFile[]>();
      (files || []).forEach(file => {
        const reportFiles = filesMap.get(file.report_id) || [];
        reportFiles.push({
          id: file.id,
          file_name: file.file_name,
          storage_path: file.storage_path,
          mime_type: file.mime_type || 'application/pdf',
          file_type: file.file_type || 'report',
        });
        filesMap.set(file.report_id, reportFiles);
      });

      // Combine reports with their files
      const reportsWithFiles: CompanyReport[] = reports.map(report => ({
        id: report.id,
        company_id: report.company_id,
        report_period: report.report_period,
        report_date: report.report_date,
        report_type: report.report_type,
        processing_status: report.processing_status,
        headline: report.headline,
        key_highlights: report.key_highlights,
        metrics: report.metrics as Record<string, any> | null,
        cleaned_content: report.cleaned_content,
        created_at: report.created_at,
        files: filesMap.get(report.id) || [],
      }));

      return reportsWithFiles;
    },
    enabled: !!companyId,
  });
}
