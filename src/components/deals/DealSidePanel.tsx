import { useState, useEffect } from "react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { Loader2, FileText, Download, Save, StickyNote } from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

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
import { Textarea } from "@/components/ui/textarea";
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
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [showNotes, setShowNotes] = useState(false);
  const [rawAmount, setRawAmount] = useState("");
  const [formData, setFormData] = useState({
    sector: "",
    stage: "",
    status: "",
    funding_type: "",
    user_notes: "",
  });

  useEffect(() => {
    if (deal) {
      const amount = deal.amount_sought || "";
      setRawAmount(parseAmount(amount) || amount.replace(/[^\d]/g, ""));
      setFormData({
        sector: deal.sector || "",
        stage: deal.stage || "",
        status: deal.status || "",
        funding_type: deal.funding_type || "",
        user_notes: deal.user_notes || "",
      });
      setShowNotes(false);
    }
  }, [deal]);

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/[^\d]/g, "");
    setRawAmount(value);
  };

  const handleSave = async () => {
    if (!deal) return;

    setSaving(true);
    try {
      const updates = {
        sector: formData.sector || null,
        stage: formData.stage || null,
        status: formData.status || null,
        amount_sought: rawAmount || null,
        funding_type: formData.funding_type || null,
        user_notes: formData.user_notes || null,
      };

      const { error } = await supabase.from("deals").update(updates).eq("id", deal.id);

      if (error) throw error;

      // Force refresh of the DataTable after successful save
      await queryClient.invalidateQueries({ queryKey: ["deals"] });

      toast.success("Succès");
      onDealUpdated();
      onOpenChange(false);
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
          <div className="flex gap-2 flex-wrap">
            <Button
              variant="ghost"
              size="sm"
              className="h-8"
              onClick={() =>
                deal.memo_html &&
                onViewMemo(deal.memo_html, deal.company_name || "")
              }
              disabled={!deal.memo_html}
            >
              <FileText className="h-4 w-4 mr-1.5" />
              Mémo
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-8"
              onClick={() => onDownloadDeck(deal)}
              disabled={!deal.hasDeck}
            >
              <Download className="h-4 w-4 mr-1.5" />
              Deck
            </Button>
            <Button
              variant={showNotes ? "secondary" : "ghost"}
              size="sm"
              className="h-8"
              onClick={() => setShowNotes(!showNotes)}
            >
              <StickyNote className="h-4 w-4 mr-1.5" />
              Notes
            </Button>
          </div>

          {showNotes && (
            <div className="space-y-1.5">
              <Label htmlFor="notes">Notes personnelles</Label>
              <Textarea
                id="notes"
                placeholder="Ajoutez vos notes sur ce deal..."
                className="min-h-[150px] resize-none"
                value={formData.user_notes}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, user_notes: e.target.value }))
                }
              />
            </div>
          )}

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
                  <SelectTrigger id="status" className="h-9">
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
                  <SelectTrigger id="sector" className="h-9">
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
                  <SelectTrigger id="stage" className="h-9">
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
                <div className="flex items-center gap-2">
                  <Input
                    id="amount"
                    type="text"
                    inputMode="numeric"
                    placeholder="Ex: 500000"
                    className="h-9"
                    value={rawAmount}
                    onChange={handleAmountChange}
                  />
                  {rawAmount && (
                    <span className="text-sm font-medium text-primary whitespace-nowrap">
                      {formatAmount(rawAmount)}
                    </span>
                  )}
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="funding_type">Type de financement</Label>
                <Input
                  id="funding_type"
                  placeholder="Ex: Equity, SAFE, Convertible"
                  className="h-9"
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

            <Button onClick={handleSave} disabled={saving} size="sm" className="w-full h-9">
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
