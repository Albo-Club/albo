import { useState, useRef, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn, formatAmount, parseAmount } from "@/lib/utils";
import { Check, CheckCircle2, CircleDashed, Loader2, XCircle } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

interface InlineSelectEditorProps {
  dealId: string;
  field: string;
  value: string | null;
  options: { value: string; label: string; icon?: React.ComponentType<{ className?: string }> }[];
  colorMap?: Record<string, string>;
  onUpdate?: () => void;
}

export function InlineSelectEditor({
  dealId,
  field,
  value,
  options,
  colorMap,
  onUpdate,
}: InlineSelectEditorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const queryClient = useQueryClient();

  const handleSelect = async (newValue: string) => {
    if (newValue === value) {
      setIsOpen(false);
      return;
    }

    setIsUpdating(true);
    try {
      const { error } = await supabase
        .from("deals")
        .update({ [field]: newValue })
        .eq("id", dealId);

      if (error) throw error;

      queryClient.invalidateQueries({ queryKey: ["deals"] });
      toast.success("Modifié avec succès");
      onUpdate?.();
    } catch (error) {
      console.error("Update error:", error);
      toast.error("Erreur lors de la mise à jour");
    } finally {
      setIsUpdating(false);
      setIsOpen(false);
    }
  };

  const currentOption = options.find((o) => o.value === value);
  const displayLabel = currentOption?.label || value || "-";
  const Icon = currentOption?.icon;
  const badgeColor = colorMap?.[value || ""] || "bg-muted text-foreground";

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <button
          onClick={(e) => {
            e.stopPropagation();
            setIsOpen(true);
          }}
          className="cursor-pointer focus:outline-none"
          disabled={isUpdating}
        >
          <Badge
            className={cn(
              "transition-all hover:ring-2 hover:ring-primary/50",
              badgeColor,
              isUpdating && "opacity-50"
            )}
          >
            {Icon && <Icon className="h-3 w-3 mr-1" />}
            {displayLabel}
          </Badge>
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="w-48 p-1 z-50"
        align="start"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex flex-col">
          {options.map((option) => {
            const OptionIcon = option.icon;
            const isSelected = option.value === value;
            const optionColor = colorMap?.[option.value] || "";

            return (
              <button
                key={option.value}
                onClick={() => handleSelect(option.value)}
                className={cn(
                  "flex items-center gap-2 px-3 py-2 text-sm rounded-md text-left transition-colors",
                  "hover:bg-muted",
                  isSelected && "bg-muted"
                )}
              >
                {OptionIcon && (
                  <OptionIcon className="h-4 w-4 text-muted-foreground" />
                )}
                <span className="flex-1">{option.label}</span>
                {isSelected && <Check className="h-4 w-4 text-primary" />}
              </button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}

interface InlineAmountEditorProps {
  dealId: string;
  value: string | null;
  onUpdate?: () => void;
}

export function InlineAmountEditor({
  dealId,
  value,
  onUpdate,
}: InlineAmountEditorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [inputValue, setInputValue] = useState(value || "");
  const [isUpdating, setIsUpdating] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isOpen]);

  useEffect(() => {
    setInputValue(value || "");
  }, [value]);

  const handleSave = async () => {
    const parsedValue = parseAmount(inputValue);
    
    if (parsedValue === value) {
      setIsOpen(false);
      return;
    }

    setIsUpdating(true);
    try {
      const { error } = await supabase
        .from("deals")
        .update({ amount_sought: parsedValue })
        .eq("id", dealId);

      if (error) throw error;

      queryClient.invalidateQueries({ queryKey: ["deals"] });
      toast.success("Modifié avec succès");
      onUpdate?.();
    } catch (error) {
      console.error("Update error:", error);
      toast.error("Erreur lors de la mise à jour");
    } finally {
      setIsUpdating(false);
      setIsOpen(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSave();
    } else if (e.key === "Escape") {
      setInputValue(value || "");
      setIsOpen(false);
    }
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <button
          onClick={(e) => {
            e.stopPropagation();
            setIsOpen(true);
          }}
          className="cursor-pointer focus:outline-none font-medium hover:underline hover:text-primary transition-colors"
          disabled={isUpdating}
        >
          {value ? formatAmount(value) : "-"}
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="w-40 p-2 z-50"
        align="start"
        onClick={(e) => e.stopPropagation()}
      >
        <Input
          ref={inputRef}
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={handleSave}
          placeholder="Ex: 2M, 500k"
          className="h-8 text-sm"
          disabled={isUpdating}
        />
        <p className="text-xs text-muted-foreground mt-1">
          Entrée : 2M, 500k, 1.5M
        </p>
      </PopoverContent>
    </Popover>
  );
}

// Status options with icons for inline editing
export const inlineStatusOptions = [
  { value: "en cours d'analyse", label: "En cours d'analyse", icon: Loader2 },
  { value: "à traiter", label: "À traiter", icon: CircleDashed },
  { value: "analysé", label: "Analysé", icon: CheckCircle2 },
  { value: "refusé", label: "Refusé", icon: XCircle },
];

export const statusColorMap: Record<string, string> = {
  "à traiter": "bg-gray-500/10 text-gray-600 border-gray-500/20",
  "en cours d'analyse": "bg-orange-500/10 text-orange-600 border-orange-500/20",
  "analysé": "bg-green-500/10 text-green-600 border-green-500/20",
  "refusé": "bg-red-500/10 text-red-600 border-red-500/20",
};

// Sector options for inline editing
export const inlineSectorOptions = [
  { value: "HealthTech", label: "HealthTech" },
  { value: "FinTech", label: "FinTech" },
  { value: "FoodTech", label: "FoodTech" },
  { value: "Energy", label: "Energy" },
  { value: "Mobility", label: "Mobility" },
  { value: "PropTech", label: "PropTech" },
  { value: "EdTech", label: "EdTech" },
  { value: "CleanTech", label: "CleanTech" },
  { value: "DeepTech", label: "DeepTech" },
  { value: "SaaS", label: "SaaS" },
  { value: "Marketplace", label: "Marketplace" },
];

// Stage options for inline editing
export const inlineStageOptions = [
  { value: "Pre-seed", label: "Pre-seed" },
  { value: "Seed", label: "Seed" },
  { value: "Series A", label: "Series A" },
  { value: "Series B", label: "Series B" },
  { value: "Growth", label: "Growth" },
];

export const stageColorMap: Record<string, string> = {
  "Pre-seed": "bg-purple-500/10 text-purple-600 border-purple-500/20",
  Seed: "bg-blue-500/10 text-blue-600 border-blue-500/20",
  "Series A": "bg-cyan-500/10 text-cyan-600 border-cyan-500/20",
  "Series B": "bg-teal-500/10 text-teal-600 border-teal-500/20",
  Growth: "bg-green-500/10 text-green-600 border-green-500/20",
};
