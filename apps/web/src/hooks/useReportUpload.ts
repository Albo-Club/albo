import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

function sanitizeFileName(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');
}

interface UseReportUploadOptions {
  companyId: string;
  companyName: string;
  onSuccess?: () => void;
}

export function useReportUpload({ companyId, companyName, onSuccess }: UseReportUploadOptions) {
  const { user } = useAuth();
  const { workspace } = useWorkspace();
  const queryClient = useQueryClient();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const submit = async (files: File[], additionalContext: string, reportPeriod?: string) => {
    if (!user) return;

    const workspaceId = workspace?.id || "";
    const userEmail = user.email || "";

    setIsSubmitting(true);
    const toastId = toast.loading("Envoi du report en cours...");

    try {
      // 1. Upload each file to storage and collect paths
      const timestamp = Date.now();
      const storagePaths: Array<{ path: string; file_name: string; mime_type: string }> = [];

      for (const file of files) {
        const sanitizedName = sanitizeFileName(file.name);
        const storagePath = `${companyId}/imports/${timestamp}_${sanitizedName}`;

        const { error: uploadError } = await supabase.storage
          .from("report-files")
          .upload(storagePath, file, {
            cacheControl: "no-cache",
            upsert: false,
          });

        if (uploadError) {
          console.error("Erreur upload fichier report:", file.name, uploadError);
          continue;
        }

        storagePaths.push({
          path: storagePath,
          file_name: file.name,
          mime_type: file.type || "application/octet-stream",
        });
      }

      if (storagePaths.length === 0 && files.length > 0) {
        throw new Error("Aucun fichier n'a pu être uploadé");
      }

      // 2. Trigger edge function
      const { data: triggerData, error: triggerError } = await supabase.functions.invoke('report-import', {
        body: {
          company_id: companyId,
          company_name: companyName,
          workspace_id: workspaceId,
          user_email: userEmail,
          storage_paths: storagePaths,
          additional_context: additionalContext || undefined,
          report_period: reportPeriod || undefined,
        },
      });

      if (triggerError) {
        console.error('Trigger error:', triggerError);
        throw new Error(triggerError.message || "Erreur lors du lancement de l'analyse");
      }

      console.log('Report import triggered, runId:', triggerData?.runId);

      toast.success("Report envoyé ! L'analyse est en cours, vous recevrez un email quand ce sera terminé.", {
        id: toastId,
        duration: 5000,
      });

      queryClient.invalidateQueries({ queryKey: ["company-reports", companyId] });
      onSuccess?.();
    } catch (err: any) {
      console.error("Upload report error:", err);
      toast.error(err.message || "Erreur lors de l'envoi du report", { id: toastId, duration: 8000 });
    } finally {
      setIsSubmitting(false);
    }
  };

  return { submit, isSubmitting };
}
