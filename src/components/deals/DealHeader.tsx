import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Building2, Eye, Plus, Sparkles } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { useAIPanel } from "@/contexts/AIPanelContext";

interface DealHeaderProps {
  dealId: string;
  companyName: string;
  status: string;
  oneLiner?: string;
  createdAt: string;
  updatedBy?: string;
  onStatusChange?: (status: string) => void;
}

const STATUS_OPTIONS = [
  { value: "new", label: "Nouveau", color: "bg-blue-500/10 text-blue-600 border-blue-500/20" },
  { value: "reviewing", label: "En revue", color: "bg-yellow-500/10 text-yellow-600 border-yellow-500/20" },
  { value: "watching", label: "Watchlist", color: "bg-green-500/10 text-green-600 border-green-500/20" },
  { value: "passed", label: "Passé", color: "bg-red-500/10 text-red-600 border-red-500/20" },
  { value: "invested", label: "Investi", color: "bg-purple-500/10 text-purple-600 border-purple-500/20" },
];

export function DealHeader({
  dealId,
  companyName,
  status,
  oneLiner,
  createdAt,
  updatedBy,
  onStatusChange,
}: DealHeaderProps) {
  const navigate = useNavigate();
  const { openPanel } = useAIPanel();

  const currentStatus = STATUS_OPTIONS.find((s) => s.value === status) || STATUS_OPTIONS[0];

  const handleDueDiligence = () => {
    openPanel(dealId, { companyName });
  };

  return (
    <div className="space-y-4">
      {/* Top Row */}
      <div className="flex items-start gap-4">
        {/* Back Button */}
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate("/dashboard")}
          className="shrink-0 mt-1"
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>

        {/* Logo Placeholder */}
        <div className="w-16 h-16 rounded-lg bg-muted flex items-center justify-center shrink-0">
          <Building2 className="h-8 w-8 text-muted-foreground" />
        </div>

        {/* Company Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-bold truncate">{companyName}</h1>
            
            {/* Status Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Badge
                  className={cn(
                    "cursor-pointer hover:opacity-80 transition-opacity",
                    currentStatus.color
                  )}
                >
                  {currentStatus.label}
                </Badge>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                {STATUS_OPTIONS.map((option) => (
                  <DropdownMenuItem
                    key={option.value}
                    onClick={() => onStatusChange?.(option.value)}
                    className={cn(
                      option.value === status && "bg-accent"
                    )}
                  >
                    <Badge className={cn("mr-2", option.color)} variant="outline">
                      {option.label}
                    </Badge>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* One-liner */}
          {oneLiner && (
            <p className="text-muted-foreground mt-1 line-clamp-2">{oneLiner}</p>
          )}

          {/* Metadata */}
          <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
            {updatedBy && (
              <span>Mis à jour par: {updatedBy}</span>
            )}
            <span>
              Date d'entrée:{" "}
              {new Date(createdAt).toLocaleDateString("fr-FR", {
                day: "numeric",
                month: "short",
                year: "numeric",
              })}
            </span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 shrink-0">
          <Button variant="outline" size="sm" onClick={handleDueDiligence}>
            <Sparkles className="h-4 w-4 mr-2" />
            Due Diligence
          </Button>
          <Button variant="outline" size="icon">
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
