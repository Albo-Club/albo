import { useState, useEffect } from "react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { Loader2, FileText, Download, Save } from "lucide-react";
import { toast } from "sonner";

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { supabase } from "@/integrations/supabase/client";
import { Deal, statuses, stages, sectors } from "./columns";
import { formatAmount, parseAmount, displayCompanyName } from "@/lib/utils";

interface DealSidePanelProps {
  deal: Deal | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDealUpdated: () => void;
  onViewMemo: (html: string, companyName: string) => void;
  onDownloadDeck: (deal: Deal) => void;
}

export function DealSidePanel({
  deal,
  open,
  onOpenChange,
  onDealUpdated,
  onViewMemo,
  onDownloadDeck,
}: DealSidePanelProps) {
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    sector: "",
    stage: "",
    status: "",
    amount_sought: "",
    funding_type: "",
  });

  useEffect(() => {
    if (deal) {
      setFormData({
        sector: deal.sector || "",
        stage: deal.stage || "",
        status: deal.status || "",
        amount_sought: deal.investment_amount_eur
          ? formatAmount(deal.investment_amount_eur.toString())
          : deal.amount_sought
          ? formatAmount(deal.amount_sought)
          : "",
        funding_type: deal.funding_type || "",
      });
    }
  }, [deal]);

  const handleSave = async () => {
    if (!deal) return;

    setSaving(true);
    try {
      const parsedAmount = parseAmount(formData.amount_sought);

      const { error } = await supabase
        .from("deals")
        .update({
          sector: formData.sector || null,
          stage: formData.stage || null,
          status: formData.status,
          amount_sought: formData.amount_sought || null,
          investment_amount_eur: parsedAmount,
          funding_type: formData.funding_type || null,
        })
        .eq("id", deal.id);

      if (error) throw error;

      toast.success("Modifications enregistrées");
      onDealUpdated();
    } catch (error: any) {
      console.error("Error saving deal:", error);
      toast.error(error.message || "Erreur lors de la sauvegarde");
    } finally {
      setSaving(false);
    }
  };

  if (!deal) return null;

  const createdDate = deal.created_at
    ? format(new Date(deal.created_at), "d MMM yyyy", { locale: fr })
    : null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader className="space-y-1 pr-8">
          <div className="flex items-start justify-between">
            <div className="flex-1 min-w-0">
              <SheetTitle className="text-xl font-bold truncate">
                {displayCompanyName(deal.company_name) || "Analyse en cours..."}
              </SheetTitle>
              {deal.one_liner && (
                <SheetDescription className="mt-1 line-clamp-2">
                  {deal.one_liner}
                </SheetDescription>
              )}
            </div>
          </div>
          {createdDate && (
            <p className="text-xs text-muted-foreground">
              Reçu le {createdDate}
            </p>
          )}
        </SheetHeader>

        <div className="mt-6 space-y-6">
          {/* Actions */}
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                deal.memo_html &&
                onViewMemo(deal.memo_html, deal.company_name || "")
              }
              disabled={!deal.memo_html}
            >
              <FileText className="h-4 w-4 mr-2" />
              Voir le mémo
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onDownloadDeck(deal)}
              disabled={!deal.hasDeck}
            >
              <Download className="h-4 w-4 mr-2" />
              Télécharger le deck
            </Button>
          </div>

          <Separator />

          {/* Edit Form */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
              Informations
            </h3>

            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="status">Statut</Label>
                <Select
                  value={formData.status}
                  onValueChange={(value) =>
                    setFormData((prev) => ({ ...prev, status: value }))
                  }
                >
                  <SelectTrigger id="status">
                    <SelectValue placeholder="Sélectionner un statut" />
                  </SelectTrigger>
                  <SelectContent>
                    {statuses.map((status) => (
                      <SelectItem key={status.value} value={status.value}>
                        <div className="flex items-center gap-2">
                          <status.icon className="h-4 w-4" />
                          {status.label}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="sector">Secteur</Label>
                <Select
                  value={formData.sector}
                  onValueChange={(value) =>
                    setFormData((prev) => ({ ...prev, sector: value }))
                  }
                >
                  <SelectTrigger id="sector">
                    <SelectValue placeholder="Sélectionner un secteur" />
                  </SelectTrigger>
                  <SelectContent>
                    {sectors.map((sector) => (
                      <SelectItem key={sector.value} value={sector.value}>
                        {sector.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="stage">Stade</Label>
                <Select
                  value={formData.stage}
                  onValueChange={(value) =>
                    setFormData((prev) => ({ ...prev, stage: value }))
                  }
                >
                  <SelectTrigger id="stage">
                    <SelectValue placeholder="Sélectionner un stade" />
                  </SelectTrigger>
                  <SelectContent>
                    {stages.map((stage) => (
                      <SelectItem key={stage.value} value={stage.value}>
                        {stage.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="amount">Montant recherché</Label>
                <Input
                  id="amount"
                  placeholder="Ex: 500k€, 1.5M€"
                  value={formData.amount_sought}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      amount_sought: e.target.value,
                    }))
                  }
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="funding_type">Type de financement</Label>
                <Input
                  id="funding_type"
                  placeholder="Ex: Equity, SAFE, Convertible"
                  value={formData.funding_type}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      funding_type: e.target.value,
                    }))
                  }
                />
              </div>
            </div>

            <Button onClick={handleSave} disabled={saving} className="w-full">
              {saving ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              Sauvegarder
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
