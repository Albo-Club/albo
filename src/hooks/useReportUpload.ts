import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

const N8N_REPORT_WEBHOOK = "https://n8n.alboteam.com/webhook/reporting-front-end";

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

  const submit = async (files: File[], additionalContext: string) => {
    if (!user) return;

    const workspaceId = workspace?.id || "";
    const userEmail = user.email || "";

    setIsSubmitting(true);
    const toastId = toast.loading("Envoi du report en cours...");

    try {
      // 1. Create company_report row
      const { data: report, error: reportError } = await supabase
        .from("company_reports")
        .insert({
          company_id: companyId,
          report_source: "frontend_upload",
          processing_status: "pending",
          has_attachments: files.length > 0,
        })
        .select("id")
        .single();

      if (reportError || !report) throw reportError || new Error("Failed to create report");

      const reportId = report.id;

      // 2. Upload each file to storage + insert report_files
      for (const file of files) {
        const storagePath = `${companyId}/${reportId}/${file.name}`;

        const { error: uploadError } = await supabase.storage
          .from("report-files")
          .upload(storagePath, file, { upsert: true });

        if (uploadError) {
          console.error("Upload error for", file.name, uploadError);
          continue;
        }

        await supabase.from("report_files").insert({
          report_id: reportId,
          file_name: file.name,
          original_file_name: file.name,
          storage_path: storagePath,
          mime_type: file.type,
          file_size_bytes: file.size,
          file_type: "report",
        });
      }

      // 3. Send everything to N8N webhook
      const formData = new FormData();

      files.forEach((file, index) => {
        formData.append(`file_${index}`, file);
      });

      formData.append("company_id", companyId);
      formData.append("company_name", companyName);
      formData.append("workspace_id", workspaceId);
      formData.append("user_email", userEmail);
      formData.append("report_id", reportId);
      formData.append("additional_context", additionalContext || "");
      formData.append("file_count", String(files.length));

      console.log("📤 Sending report to N8N:", {
        webhook: N8N_REPORT_WEBHOOK,
        company_id: companyId,
        company_name: companyName,
        workspace_id: workspaceId,
        report_id: reportId,
        file_count: files.length,
        files: files.map((f) => ({ name: f.name, type: f.type, size: f.size })),
      });

      const response = await fetch(N8N_REPORT_WEBHOOK, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`Webhook failed: ${response.status}`);
      }

      toast.success("Report envoyé ! L'analyse est en cours et sera disponible dans quelques minutes.", {
        id: toastId,
        duration: 5000,
      });

      queryClient.invalidateQueries({ queryKey: ["company-reports", companyId] });
      onSuccess?.();
    } catch (err: any) {
      console.error("Upload report error:", err);
      toast.error("Erreur lors de l'envoi du report", { id: toastId, duration: 8000 });
    } finally {
      setIsSubmitting(false);
    }
  };

  return { submit, isSubmitting };
}
