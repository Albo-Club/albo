import { useState, useRef, useCallback } from "react";
import { Upload, X, FileText, Table, Image, Loader2, Sparkles, Mail } from "lucide-react";
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
  "image/png",
  "image/jpeg",
  "image/jpg",
];

const ACCEPTED_EXTENSIONS = ".pdf,.xlsx,.xls,.png,.jpg,.jpeg";

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getFileIcon(mime: string) {
  if (mime === "application/pdf") return <FileText className="h-4 w-4 text-destructive" />;
  if (mime.includes("spreadsheet") || mime.includes("excel"))
    return <Table className="h-4 w-4 text-green-600" />;
  if (mime.startsWith("image/")) return <Image className="h-4 w-4 text-blue-500" />;
  return <FileText className="h-4 w-4 text-muted-foreground" />;
}

export function UploadReportModal({ open, onOpenChange, companyId, companyName }: UploadReportModalProps) {
  const [files, setFiles] = useState<File[]>([]);
  const [additionalContext, setAdditionalContext] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const { submit, isSubmitting } = useReportUpload({
    companyId,
    companyName,
    onSuccess: () => {
      setFiles([]);
      setAdditionalContext("");
      onOpenChange(false);
    },
  });

  const canSubmit = files.length > 0 || additionalContext.trim().length > 0;

  const addFiles = useCallback((newFiles: FileList | File[]) => {
    const valid = Array.from(newFiles).filter((f) => ACCEPTED_TYPES.includes(f.type));
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
            Importez les documents du reporting et ajoutez le contexte du mail reçu
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
            Formats acceptés : PDF, Excel (.xlsx, .xls), Images (.png, .jpg)
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
          </div>
        )}

        {/* Text area */}
        <div className="space-y-2">
          <Label className="text-sm text-muted-foreground">
            Contexte additionnel (optionnel)
          </Label>
          <Textarea
            placeholder="Collez ici le contenu du mail reçu ou ajoutez des informations complémentaires sur ce report..."
            value={additionalContext}
            onChange={(e) => setAdditionalContext(e.target.value)}
            className="resize-y min-h-[120px]"
          />
        </div>

        {/* Email info box */}
        <div className="bg-muted/50 rounded-lg p-3 flex items-start gap-2">
          <Mail className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
          <p className="text-sm text-muted-foreground">
            Vous pouvez aussi envoyer vos reports directement par email à{" "}
            <a
              href="mailto:report@alboteam.com"
              className="font-medium text-foreground hover:underline"
            >
              report@alboteam.com
            </a>{" "}
            — ils seront automatiquement analysés et rattachés à la bonne entreprise.
          </p>
        </div>

        {/* Submit */}
        <Button
          onClick={() => submit(files, additionalContext)}
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
              <Sparkles className="h-4 w-4" />
              Analyser le report
            </>
          )}
        </Button>
      </DialogContent>
    </Dialog>
  );
}
