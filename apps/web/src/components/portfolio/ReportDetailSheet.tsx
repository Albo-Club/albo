import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  CheckCircle2,
  FileText,
  Sheet as SheetIcon,
  Image,
  Download,
  Trash2,
  ChevronDown,
  Loader2,
  Mail,
} from "lucide-react";
import { format } from "date-fns";
import { fr as frLocale } from "date-fns/locale";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";

const SUPABASE_URL = "https://kpvbcqilzfeitxzwhmou.supabase.co";

interface ReportDetailSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  reportId: string | null;
}

interface ReportFile {
  id: string;
  file_name: string;
  original_file_name: string | null;
  storage_path: string;
  mime_type: string | null;
  file_size_bytes: number | null;
  original_text_report: string | null;
}

function formatFileSize(bytes: number | null): string {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getFileIcon(mime: string | null) {
  if (!mime) return FileText;
  if (mime.includes("pdf")) return FileText;
  if (mime.includes("sheet") || mime.includes("excel") || mime.includes("csv")) return SheetIcon;
  if (mime.includes("image")) return Image;
  return FileText;
}

export function ReportDetailSheet({ open, onOpenChange, reportId }: ReportDetailSheetProps) {
  const queryClient = useQueryClient();
  const [deletingFileId, setDeletingFileId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const { data: report, isLoading: reportLoading } = useQuery({
    queryKey: ["report-detail-sheet", reportId],
    queryFn: async () => {
      if (!reportId) return null;
      const { data, error } = await supabase
        .from("company_reports")
        .select("id, report_title, email_subject, email_from, email_date, report_period, report_type, headline, key_highlights, cleaned_content, raw_content")
        .eq("id", reportId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!reportId && open,
  });

  const { data: files = [] } = useQuery({
    queryKey: ["report-detail-sheet-files", reportId],
    queryFn: async () => {
      if (!reportId) return [];
      const { data, error } = await supabase
        .from("report_files")
        .select("id, file_name, original_file_name, storage_path, mime_type, file_size_bytes, original_text_report")
        .eq("report_id", reportId);
      if (error) throw error;
      return (data || []) as ReportFile[];
    },
    enabled: !!reportId && open,
  });

  const handleDeleteFile = async () => {
    const file = files.find((f) => f.id === deletingFileId);
    if (!file) return;
    setIsDeleting(true);
    try {
      if (file.storage_path) {
        await supabase.storage.from("report-files").remove([file.storage_path]);
      }
      const { error } = await supabase.from("report_files").delete().eq("id", file.id);
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ["report-detail-sheet-files", reportId] });
      queryClient.invalidateQueries({ queryKey: ["company-reports"] });
      toast.success("Fichier supprimé");
    } catch (e: any) {
      console.error("Delete file error:", e);
      toast.error(e?.message || "Erreur lors de la suppression du fichier");
    } finally {
      setIsDeleting(false);
      setDeletingFileId(null);
    }
  };

  const title = report?.report_title || report?.email_subject || "Report";

  return (
    <>
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-xl p-0 flex flex-col">
        <SheetHeader className="px-6 pt-6 pb-2">
          <SheetTitle className="text-base font-semibold leading-tight pr-8">{reportLoading ? "…" : title}</SheetTitle>
          <SheetDescription className="sr-only">Détails du rapport</SheetDescription>
        </SheetHeader>

        <ScrollArea className="flex-1 px-6 pb-6">
          {reportLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : report ? (
            <div className="space-y-6">
              {/* Section 1 — Header + Highlights */}
              <div className="space-y-3">
                <div className="flex flex-wrap gap-1.5">
                  {report.report_period && (
                    <Badge variant="secondary" className="text-xs">{report.report_period}</Badge>
                  )}
                  {report.report_type && (
                    <Badge variant="outline" className="text-xs">{report.report_type}</Badge>
                  )}
                </div>

                {(report.email_from || report.email_date) && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Mail className="h-3.5 w-3.5 shrink-0" />
                    <span>
                      {report.email_from && <span>{report.email_from}</span>}
                      {report.email_from && report.email_date && <span> · </span>}
                      {report.email_date && (
                        <span>{format(new Date(report.email_date), "d MMM yyyy", { locale: frLocale })}</span>
                      )}
                    </span>
                  </div>
                )}

                {report.headline && (
                  <p className="text-sm italic text-muted-foreground">{report.headline}</p>
                )}

                {report.key_highlights && report.key_highlights.length > 0 && (
                  <ul className="space-y-1.5">
                    {report.key_highlights.map((h: string, i: number) => (
                      <li key={i} className="flex items-start gap-2 text-sm">
                        <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500 mt-0.5" />
                        <span>{h}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {/* Section 2 — Attached files */}
              {files.length > 0 && (
                <>
                  <Separator />
                  <div className="space-y-2">
                    <h3 className="text-sm font-semibold">Fichiers joints</h3>
                    <div className="space-y-2">
                      {files.map((f) => {
                        const Icon = getFileIcon(f.mime_type);
                        const displayName = f.original_file_name || f.file_name;
                        const downloadUrl = `${SUPABASE_URL}/storage/v1/object/public/report-files/${f.storage_path}`;

                        return (
                          <div key={f.id} className="space-y-1">
                            <div className="flex items-center gap-2 p-2 rounded-md border bg-muted/30">
                              <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                              <span className="text-sm truncate flex-1">{displayName}</span>
                              {f.file_size_bytes && (
                                <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                                  {formatFileSize(f.file_size_bytes)}
                                </span>
                              )}
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 px-2"
                                asChild
                              >
                                <a href={downloadUrl} target="_blank" rel="noopener noreferrer">
                                  <Download className="h-3.5 w-3.5" />
                                </a>
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 px-2 text-destructive hover:text-destructive"
                                onClick={() => setDeletingFileId(f.id)}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>

                            {f.original_text_report && (
                              <Collapsible>
                                <CollapsibleTrigger className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
                                  <ChevronDown className="h-3 w-3 transition-transform [[data-state=closed]_&]:-rotate-90" />
                                  Voir texte extrait
                                </CollapsibleTrigger>
                                <CollapsibleContent>
                                  <pre className="mt-1 p-3 rounded-md bg-muted text-xs font-mono whitespace-pre-wrap max-h-[300px] overflow-y-auto">
                                    {f.original_text_report}
                                  </pre>
                                </CollapsibleContent>
                              </Collapsible>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </>
              )}

              {/* Section 3 — Raw content / Notes */}
              {report.raw_content && (
                <>
                  <Separator />
                  <div className="space-y-2">
                    <h3 className="text-sm font-semibold">Notes / Contenu brut</h3>
                    <pre className="p-3 rounded-md bg-muted text-xs font-mono whitespace-pre-wrap max-h-[300px] overflow-y-auto">
                      {report.raw_content}
                    </pre>
                  </div>
                </>
              )}

              {/* Section 4 — Original email */}
              <Separator />
              <div className="space-y-2">
                <h3 className="text-sm font-semibold">Email original</h3>
                {report.cleaned_content ? (
                  <iframe
                    srcDoc={report.cleaned_content}
                    sandbox=""
                    className="w-full min-h-[400px] border rounded-md bg-background"
                    title="Email original"
                  />
                ) : (
                  <p className="text-sm text-muted-foreground">Email non disponible</p>
                )}
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground py-8 text-center">Rapport non trouvé</p>
          )}
        </ScrollArea>
      </SheetContent>
    </Sheet>

    <AlertDialog open={!!deletingFileId} onOpenChange={(o) => !o && setDeletingFileId(null)}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Supprimer ce fichier ?</AlertDialogTitle>
          <AlertDialogDescription>
            Cette action est irréversible. Le fichier sera définitivement supprimé.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isDeleting}>Annuler</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDeleteFile}
            disabled={isDeleting}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {isDeleting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Supprimer
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
    </>
  );
}
