import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Loader2 } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { CompanyLogo } from "@/components/ui/CompanyLogo";

interface DealHeaderProps {
  dealId: string;
  companyName: string;
  status: string;
  oneLiner?: string;
  createdAt: string;
  updatedBy?: string;
  domain?: string | null;
  onStatusChange?: (status: string) => void;
}

const STATUS_OPTIONS = [
  { value: "en cours d'analyse", label: "En cours d'analyse", color: "bg-orange-500/10 text-orange-600 border-orange-500/20" },
  { value: "à traiter", label: "À traiter", color: "bg-gray-500/10 text-gray-600 border-gray-500/20" },
  { value: "analysé", label: "Analysé", color: "bg-green-500/10 text-green-600 border-green-500/20" },
  { value: "refusé", label: "Refusé", color: "bg-red-500/10 text-red-600 border-red-500/20" },
  { value: "nouveau", label: "Nouveau", color: "bg-blue-500/10 text-blue-600 border-blue-500/20" },
  { value: "en revue", label: "En revue", color: "bg-yellow-500/10 text-yellow-600 border-yellow-500/20" },
  { value: "watchlist", label: "Watchlist", color: "bg-cyan-500/10 text-cyan-600 border-cyan-500/20" },
  { value: "investi", label: "Investi", color: "bg-purple-500/10 text-purple-600 border-purple-500/20" },
];

export function DealHeader({
  dealId,
  companyName,
  status,
  oneLiner,
  createdAt,
  updatedBy,
  domain,
  onStatusChange,
}: DealHeaderProps) {
  const navigate = useNavigate();

  const currentStatus = STATUS_OPTIONS.find((s) => s.value === status) || STATUS_OPTIONS[0];

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

        {/* Company Logo */}
        <CompanyLogo 
          domain={domain} 
          companyName={companyName} 
          size="lg" 
          className="w-16 h-16 rounded-lg"
        />

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
                  {status === "en cours d'analyse" && (
                    <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                  )}
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

      </div>
    </div>
  );
}
