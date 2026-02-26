import { useState, useRef, useCallback } from "react";
import { Upload, X, FileText, FileSpreadsheet, Image, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

interface UploadReportModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  companyId: string;
}

const ACCEPTED_TYPES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-excel",
  "image/png",
  "image/jpeg",
  "image/jpg",
];

const ACCEPTED_EXTENSIONS = ".pdf,.xlsx,.xls,.png,.jpg,.jpeg";

function getFileIcon(mime: string) {
  if (mime === "application/pdf") return <FileText className="h-4 w-4 text-destructive" />;
  if (mime.includes("spreadsheet") || mime.includes("excel"))
    return <FileSpreadsheet className="h-4 w-4 text-green-600" />;
  if (mime.startsWith("image/")) return <Image className="h-4 w-4 text-blue-500" />;
  return <FileText className="h-4 w-4 text-muted-foreground" />;
}

export function UploadReportModal({ open, onOpenChange, companyId }: UploadReportModalProps) {
  const { user } = useAuth();
  const { workspace } = useWorkspace();
  const queryClient = useQueryClient();

  const [files, setFiles] = useState<File[]>([]);
  const [additionalContext, setAdditionalContext] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const canSubmit = files.length > 0 || additionalContext.trim().length > 0;

  const addFiles = useCallback((newFiles: FileList | File[]) => {
    const valid = Array.from(newFiles).filter((f) =>
      ACCEPTED_TYPES.includes(f.type)
    );
    if (valid.length < Array.from(newFiles).length) {
      toast.error("Certains fichiers ont été ignorés (formats non supportés)");
    }
    setFiles((prev) => [...prev, ...valid]);
  }, []);

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      if (e.dataTransfer.files.length) addFiles(e.dataTransfer.files);
    },
    [addFiles]
  );

  const handleSubmit = async () => {
    if (!canSubmit || !user) return;
    setIsSubmitting(true);

    const toastId = toast.loading("Création du report en cours…");

    try {
      // 1. Create company_report row
      const { data: report, error: reportError } = await supabase
        .from("company_reports")
        .insert({
          company_id: companyId,
          processing_status: "pending",
          report_source: "frontend_upload",
        })
        .select("id")
        .single();

      if (reportError || !report) throw reportError || new Error("Failed to create report");

      const reportId = report.id;

      // 2. Upload files to storage & insert report_files rows
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
          file_type: "report",
        });
      }

      // 3. Call N8N webhook with multipart/form-data
      const formData = new FormData();
      formData.append("company_id", companyId);
      formData.append("workspace_id", workspace?.id || "");
      formData.append("user_email", user.email || "");
      formData.append("report_id", reportId);
      formData.append("additional_context", additionalContext);

      for (const file of files) {
        formData.append("files", file);
      }

      fetch("https://n8n.alboteam.com/webhook/upload_report_frontend", {
        method: "POST",
        body: formData,
      }).catch((err) => console.error("N8N webhook error:", err));

      toast.success("Report envoyé pour analyse !", { id: toastId, duration: 5000 });

      // Reset & close
      setFiles([]);
      setAdditionalContext("");
      onOpenChange(false);

      // Refresh reports
      queryClient.invalidateQueries({ queryKey: ["company-reports", companyId] });
    } catch (err: any) {
      console.error("Upload report error:", err);
      toast.error("Erreur lors de l'envoi du report", { id: toastId, duration: 8000 });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = (open: boolean) => {
    if (!isSubmitting) {
      if (!open) {
        setFiles([]);
        setAdditionalContext("");
      }
      onOpenChange(open);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Ajouter un report</DialogTitle>
          <DialogDescription>
            Uploadez les fichiers du report et ajoutez du contexte si nécessaire.
          </DialogDescription>
        </DialogHeader>

        {/* Drop zone */}
        <div
          className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
            isDragging
              ? "border-primary bg-primary/5"
              : "border-border hover:border-primary/50"
          }`}
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          onClick={() => inputRef.current?.click()}
        >
          <Upload className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
          <p className="text-sm font-medium">
            Glissez vos fichiers ici ou cliquez pour sélectionner
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            PDF, Excel (.xlsx, .xls), Images (.png, .jpg)
          </p>
          <input
            ref={inputRef}
            type="file"
            multiple
            accept={ACCEPTED_EXTENSIONS}
            className="hidden"
            onChange={(e) => {
              if (e.target.files) addFiles(e.target.files);
              e.target.value = "";
            }}
          />
        </div>

        {/* File list */}
        {files.length > 0 && (
          <div className="space-y-1.5 max-h-40 overflow-y-auto">
            {files.map((file, i) => (
              <div
                key={`${file.name}-${i}`}
                className="flex items-center gap-2 px-3 py-2 rounded-md bg-muted/50 text-sm"
              >
                {getFileIcon(file.type)}
                <span className="flex-1 truncate">{file.name}</span>
                <button
                  type="button"
                  onClick={() => removeFile(i)}
                  className="text-muted-foreground hover:text-destructive transition-colors"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Text area */}
        <Textarea
          placeholder="Collez ici le contenu du mail reçu ou ajoutez des informations complémentaires sur ce report..."
          value={additionalContext}
          onChange={(e) => setAdditionalContext(e.target.value)}
          rows={4}
          className="resize-y"
        />

        {/* Submit */}
        <Button
          onClick={handleSubmit}
          disabled={!canSubmit || isSubmitting}
          className="w-full gap-2"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Analyse en cours…
            </>
          ) : (
            <>
              <Upload className="h-4 w-4" />
              Analyser le report
            </>
          )}
        </Button>
      </DialogContent>
    </Dialog>
  );
}