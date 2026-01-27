import { useState, useEffect } from "react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { Loader2, FileText, Download, Save, StickyNote, Plus } from "lucide-react";
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
import { Deal, statuses, stages, sectors, fundingTypes } from "./columns";
import { formatAmount, parseAmount, displayCompanyName } from "@/lib/utils";
import { CompanyLogo } from "@/components/ui/CompanyLogo";
import { AddNewOptionDialog } from "./AddNewOptionDialog";

interface DealSidePanelProps {
  deal: Deal | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDealUpdated: () => void;
  onViewMemo: (html: string, companyName: string) => void;
  onDownloadDeck: (deal: Deal) => void;
}

type OptionType = { value: string; label: string };

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

  // Local custom options state
  const [customSectors, setCustomSectors] = useState<OptionType[]>([]);
  const [customStages, setCustomStages] = useState<OptionType[]>([]);
  const [customStatuses, setCustomStatuses] = useState<OptionType[]>([]);
  const [customFundingTypes, setCustomFundingTypes] = useState<OptionType[]>([]);

  // Dialog state
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [addDialogType, setAddDialogType] = useState<"sector" | "stage" | "status" | "funding_type">("sector");

  useEffect(() => {
    if (deal) {
      const amount = deal.investment_amount_eur ? String(deal.investment_amount_eur) : "";
      setRawAmount(amount);
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

  // Auto-save function for dropdowns
  const handleFieldAutoSave = async (field: string, value: string, label: string) => {
    if (!deal) return;

    try {
      const { error } = await supabase
        .from("deals")
        .update({ [field]: value || null })
        .eq("id", deal.id);

      if (error) throw error;

      await queryClient.invalidateQueries({ queryKey: ["deals"] });
      toast.success(`${label} mis à jour`);
    } catch (error: any) {
      console.error(`Error updating ${field}:`, error);
      toast.error(error.message || `Erreur lors de la mise à jour`);
    }
  };

  const handleStatusChange = (value: string) => {
    setFormData((prev) => ({ ...prev, status: value }));
    handleFieldAutoSave("status", value, "Statut");
  };

  const handleSectorChange = (value: string) => {
    setFormData((prev) => ({ ...prev, sector: value }));
    handleFieldAutoSave("sector", value, "Secteur");
  };

  const handleStageChange = (value: string) => {
    setFormData((prev) => ({ ...prev, stage: value }));
    handleFieldAutoSave("stage", value, "Stade");
  };

  const handleFundingTypeChange = (value: string) => {
    setFormData((prev) => ({ ...prev, funding_type: value }));
    handleFieldAutoSave("funding_type", value, "Type de financement");
  };

  const handleSave = async () => {
    if (!deal) return;

    setSaving(true);
    try {
      const updates = {
        sector: formData.sector || null,
        stage: formData.stage || null,
        status: formData.status || null,
        investment_amount_eur: rawAmount ? parseFloat(rawAmount) : null,
        funding_type: formData.funding_type || null,
        user_notes: formData.user_notes || null,
      };

      console.log("Updating deal:", deal.id, updates); // DEBUG

      const { data, error, count } = await supabase
        .from("deals")
        .update(updates)
        .eq("id", deal.id)
        .select(); // Ajoute .select() pour voir ce qui est retourné

      console.log("Update result:", { data, error, count }); // DEBUG

      if (error) throw error;

      if (!data || data.length === 0) {
        throw new Error("Aucune ligne mise à jour - vérifiez les RLS policies");
      }

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

  const openAddDialog = (type: "sector" | "stage" | "status" | "funding_type") => {
    setAddDialogType(type);
    setAddDialogOpen(true);
  };

  const handleAddNewOption = (value: string) => {
    const newOption = { value, label: value };
    
    switch (addDialogType) {
      case "sector":
        setCustomSectors((prev) => [...prev, newOption]);
        setFormData((prev) => ({ ...prev, sector: value }));
        handleFieldAutoSave("sector", value, "Secteur");
        break;
      case "stage":
        setCustomStages((prev) => [...prev, newOption]);
        setFormData((prev) => ({ ...prev, stage: value }));
        handleFieldAutoSave("stage", value, "Stade");
        break;
      case "status":
        setCustomStatuses((prev) => [...prev, newOption]);
        setFormData((prev) => ({ ...prev, status: value }));
        handleFieldAutoSave("status", value, "Statut");
        break;
      case "funding_type":
        setCustomFundingTypes((prev) => [...prev, newOption]);
        setFormData((prev) => ({ ...prev, funding_type: value }));
        handleFieldAutoSave("funding_type", value, "Type de financement");
        break;
    }
  };

  const getDialogTitle = () => {
    switch (addDialogType) {
      case "sector":
        return "Nouveau secteur";
      case "stage":
        return "Nouveau stade";
      case "status":
        return "Nouveau statut";
      case "funding_type":
        return "Nouveau type de financement";
    }
  };

  // Get truncated notes preview
  const getNotesPreview = () => {
    if (!deal?.user_notes) return null;
    const notes = deal.user_notes;
    const lines = notes.split("\n").slice(0, 3).join("\n");
    const preview = lines.length > 150 ? lines.substring(0, 150) : lines;
    const isTruncated = notes.length > preview.length;
    return isTruncated ? `${preview}...` : preview;
  };

  if (!deal) return null;

  const createdDate = deal.created_at
    ? format(new Date(deal.created_at), "d MMM yyyy", { locale: fr })
    : null;

  const notesPreview = getNotesPreview();

  // Combine base options with custom options
  const allSectors = [...sectors, ...customSectors];
  const allStages = [...stages, ...customStages];
  const allStatuses = [...statuses.map((s) => ({ value: s.value, label: s.label })), ...customStatuses];
  const allFundingTypes = [...fundingTypes, ...customFundingTypes];

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          <SheetHeader className="space-y-1 pr-8">
            <div className="flex items-start gap-3">
              <CompanyLogo 
                domain={deal.domain} 
                companyName={deal.company_name} 
                size="md" 
              />
              <div className="flex-1 min-w-0">
                <SheetTitle className="text-xl font-bold truncate">
                  {displayCompanyName(deal.company_name) || "Analyse en cours..."}
                </SheetTitle>
                {deal.one_liner && (
                  <SheetDescription className="mt-1 line-clamp-2">
                    {deal.one_liner}
                  </SheetDescription>
                )}
                {notesPreview && (
                  <p className="mt-2 text-xs text-muted-foreground italic line-clamp-3">
                    {notesPreview}
                  </p>
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
                  <Select value={formData.status} onValueChange={handleStatusChange}>
                    <SelectTrigger id="status" className="h-9">
                      <SelectValue placeholder="Sélectionner un statut" />
                    </SelectTrigger>
                    <SelectContent>
                      {allStatuses.map((status) => (
                        <SelectItem key={status.value} value={status.value}>
                          {status.label}
                        </SelectItem>
                      ))}
                      <SelectItem
                        value="__add_new__"
                        className="text-muted-foreground italic"
                        onPointerDown={(e) => {
                          e.preventDefault();
                          openAddDialog("status");
                        }}
                      >
                        <span className="flex items-center gap-1">
                          <Plus className="h-3 w-3" />
                          Ajouter nouveau...
                        </span>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="sector">Secteur</Label>
                  <Select value={formData.sector} onValueChange={handleSectorChange}>
                    <SelectTrigger id="sector" className="h-9">
                      <SelectValue placeholder="Sélectionner un secteur" />
                    </SelectTrigger>
                    <SelectContent>
                      {allSectors.map((sector) => (
                        <SelectItem key={sector.value} value={sector.value}>
                          {sector.label}
                        </SelectItem>
                      ))}
                      <SelectItem
                        value="__add_new__"
                        className="text-muted-foreground italic"
                        onPointerDown={(e) => {
                          e.preventDefault();
                          openAddDialog("sector");
                        }}
                      >
                        <span className="flex items-center gap-1">
                          <Plus className="h-3 w-3" />
                          Ajouter nouveau...
                        </span>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="stage">Stade</Label>
                  <Select value={formData.stage} onValueChange={handleStageChange}>
                    <SelectTrigger id="stage" className="h-9">
                      <SelectValue placeholder="Sélectionner un stade" />
                    </SelectTrigger>
                    <SelectContent>
                      {allStages.map((stage) => (
                        <SelectItem key={stage.value} value={stage.value}>
                          {stage.label}
                        </SelectItem>
                      ))}
                      <SelectItem
                        value="__add_new__"
                        className="text-muted-foreground italic"
                        onPointerDown={(e) => {
                          e.preventDefault();
                          openAddDialog("stage");
                        }}
                      >
                        <span className="flex items-center gap-1">
                          <Plus className="h-3 w-3" />
                          Ajouter nouveau...
                        </span>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="funding_type">Type de financement</Label>
                  <Select value={formData.funding_type} onValueChange={handleFundingTypeChange}>
                    <SelectTrigger id="funding_type" className="h-9">
                      <SelectValue placeholder="Sélectionner un type" />
                    </SelectTrigger>
                    <SelectContent>
                      {allFundingTypes.map((type) => (
                        <SelectItem key={type.value} value={type.value}>
                          {type.label}
                        </SelectItem>
                      ))}
                      <SelectItem
                        value="__add_new__"
                        className="text-muted-foreground italic"
                        onPointerDown={(e) => {
                          e.preventDefault();
                          openAddDialog("funding_type");
                        }}
                      >
                        <span className="flex items-center gap-1">
                          <Plus className="h-3 w-3" />
                          Ajouter nouveau...
                        </span>
                      </SelectItem>
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

      <AddNewOptionDialog
        open={addDialogOpen}
        onOpenChange={setAddDialogOpen}
        title={getDialogTitle()}
        onAdd={handleAddNewOption}
      />
    </>
  );
}
