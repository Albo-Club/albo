import { useState, useRef, useCallback } from "react";
import { useTranslation } from 'react-i18next';
import { Upload, X, FileText, Table, Image as ImageIcon, Loader2, Sparkles } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useReportUpload } from "@/hooks/useReportUpload";
import { toast } from "sonner";

interface UploadReportModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  companyId: string;
  companyName: string;
}

const ACCEPTED_TYPES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-excel",
  "application/vnd.ms-excel.sheet.macroEnabled.12",
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/gif",
  "image/webp",
];

const ACCEPTED_EXTENSIONS = ".pdf,.xlsx,.xls,.xlsm,.png,.jpg,.jpeg,.gif,.webp";
const MAX_TOTAL_SIZE = 50 * 1024 * 1024; // 50MB

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getFileIcon(mime: string) {
  if (mime === "application/pdf") return <FileText className="h-4 w-4 text-destructive" />;
  if (mime.includes("spreadsheet") || mime.includes("excel"))
    return <Table className="h-4 w-4 text-green-600" />;
  if (mime.startsWith("image/")) return <ImageIcon className="h-4 w-4 text-blue-500" />;
  return <FileText className="h-4 w-4 text-muted-foreground" />;
}

export function UploadReportModal({ open, onOpenChange, companyId, companyName }: UploadReportModalProps) {
  const { t } = useTranslation();
  const [files, setFiles] = useState<File[]>([]);
  const [reportPeriod, setReportPeriod] = useState("");
  const [additionalContext, setAdditionalContext] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const { submit, isSubmitting } = useReportUpload({
    companyId,
    companyName,
    onSuccess: () => {
      setFiles([]);
      setReportPeriod("");
      setAdditionalContext("");
      onOpenChange(false);
    },
  });

  const totalSize = files.reduce((sum, f) => sum + f.size, 0);
  const canSubmit = files.length > 0 || additionalContext.trim().length > 0;

  const addFiles = useCallback((newFiles: FileList | File[]) => {
    const incoming = Array.from(newFiles);
    const valid = incoming.filter((f) => {
      const ext = '.' + f.name.split('.').pop()?.toLowerCase();
      return ACCEPTED_TYPES.includes(f.type) || ACCEPTED_EXTENSIONS.split(',').includes(ext);
    });
    if (valid.length < incoming.length) {
      toast.error("Certains fichiers ont été ignorés (formats non supportés)");
    }

    setFiles((prev) => {
      const combined = [...prev, ...valid];
      const combinedSize = combined.reduce((sum, f) => sum + f.size, 0);
      if (combinedSize > MAX_TOTAL_SIZE) {
        toast.error(`Taille totale max : ${formatFileSize(MAX_TOTAL_SIZE)}`);
        return prev;
      }
      return combined;
    });
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

  const handleClose = (open: boolean) => {
    if (!isSubmitting) {
      if (!open) {
        setFiles([]);
        setReportPeriod("");
        setAdditionalContext("");
      }
      onOpenChange(open);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t('modals.uploadReport.title')}</DialogTitle>
          <DialogDescription>
            {t('modals.uploadReport.desc')}
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
            {t('modals.uploadReport.dragDrop')}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            PDF, Excel (.xlsx, .xls, .xlsm), Images (PNG, JPG, GIF, WebP) — max 50 MB
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
                <span className="text-xs text-muted-foreground flex-shrink-0">
                  {formatFileSize(file.size)}
                </span>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    removeFile(i);
                  }}
                  className="text-muted-foreground hover:text-destructive transition-colors"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
            <p className="text-xs text-muted-foreground text-right px-1">
              Total : {formatFileSize(totalSize)}
            </p>
          </div>
        )}

        {/* Report period */}
        <div className="space-y-2">
          <Label className="text-sm text-muted-foreground">
            {t('modals.uploadReport.reportPeriod', 'Période du report (optionnel)')}
          </Label>
          <Input
            placeholder="ex: January 2026, Q4 2025, November - December 2025"
            value={reportPeriod}
            onChange={(e) => setReportPeriod(e.target.value)}
          />
        </div>

        {/* Text area */}
        <div className="space-y-2">
          <Label className="text-sm text-muted-foreground">
            {t('modals.uploadReport.additionalContext')}
          </Label>
          <Textarea
            placeholder={t('modals.uploadReport.contextPlaceholder')}
            value={additionalContext}
            onChange={(e) => setAdditionalContext(e.target.value)}
            className="resize-y min-h-[120px]"
          />
        </div>

        {/* Submit */}
        <Button
          onClick={() => submit(files, additionalContext, reportPeriod || undefined)}
          disabled={!canSubmit || isSubmitting}
          className="w-full gap-2"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              {t('modals.uploadReport.analyzing')}
            </>
          ) : (
            <>
              <Sparkles className="h-4 w-4" />
              {t('modals.uploadReport.analyze')}
            </>
          )}
        </Button>
      </DialogContent>
    </Dialog>
  );
}
