import { useState } from "react";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Copy, FileX, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

interface ArchiveReportDialogProps {
  isOpen: boolean;
  onClose: () => void;
  reportId: string;
  reportPeriod: string | null;
  companyId: string;
}

type ArchiveReason = "duplicate" | "incomplete";

export function ArchiveReportDialog({
  isOpen,
  onClose,
  reportId,
  reportPeriod,
  companyId,
}: ArchiveReportDialogProps) {
  const [selectedReason, setSelectedReason] = useState<ArchiveReason | null>(null);
  const [isArchiving, setIsArchiving] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  const handleArchive = async () => {
    if (!selectedReason) return;

    setIsArchiving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();

      const { error } = await supabase
        .from("company_reports")
        .update({
          is_archived: true,
          archive_reason: selectedReason,
          archived_at: new Date().toISOString(),
          archived_by: user?.id || null,
        })
        .eq("id", reportId);

      if (error) throw error;

      queryClient.invalidateQueries({ queryKey: ["company-reports", companyId] });

      const reasonLabel = selectedReason === "duplicate"
        ? t('companyDetail.reports.duplicate')
        : t('companyDetail.reports.incomplete');

      toast({
        title: t('companyDetail.reports.archived'),
        description: t('companyDetail.reports.archiveSuccess', {
          period: reportPeriod || "",
          reason: reasonLabel.toLowerCase(),
        }),
      });

      onClose();
    } catch (err) {
      console.error("Archive error:", err);
      toast({
        title: t('common.error'),
        description: t('companyDetail.reports.archiveError'),
        variant: "destructive",
      });
    } finally {
      setIsArchiving(false);
      setSelectedReason(null);
    }
  };

  const handleClose = () => {
    setSelectedReason(null);
    onClose();
  };

  const reasons: { value: ArchiveReason; labelKey: string; icon: typeof Copy }[] = [
    { value: "duplicate", labelKey: "companyDetail.reports.duplicate", icon: Copy },
    { value: "incomplete", labelKey: "companyDetail.reports.incomplete", icon: FileX },
  ];

  return (
    <AlertDialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {t('companyDetail.reports.archiveTitle')}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {t('companyDetail.reports.archiveDesc')}
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="flex gap-3 my-2">
          {reasons.map((reason) => {
            const Icon = reason.icon;
            const isSelected = selectedReason === reason.value;
            return (
              <button
                key={reason.value}
                type="button"
                onClick={() => setSelectedReason(reason.value)}
                className={`flex-1 flex flex-col items-center gap-2 p-4 rounded-lg border-2 transition-all cursor-pointer ${
                  isSelected
                    ? "border-primary bg-primary/5 text-primary"
                    : "border-border hover:border-muted-foreground/30 text-muted-foreground"
                }`}
              >
                <Icon className="h-5 w-5" />
                <span className="text-sm font-medium">
                  {t(reason.labelKey)}
                </span>
              </button>
            );
          })}
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel>
            {t('common.cancel')}
          </AlertDialogCancel>
          <Button
            variant="destructive"
            disabled={!selectedReason || isArchiving}
            onClick={handleArchive}
          >
            {isArchiving && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
            {t('companyDetail.reports.archiveBtn')}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
