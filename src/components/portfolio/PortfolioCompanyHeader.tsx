import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { CompanyLogo } from "@/components/ui/CompanyLogo";
import { SectorBadges } from "./SectorBadges";

interface PortfolioCompanyHeaderProps {
  companyName: string;
  domain?: string | null;
  preview?: string | null;
  sectors?: string[] | null;
  investmentDate?: string | null;
}

export function PortfolioCompanyHeader({
  companyName,
  domain,
  preview,
  sectors,
  investmentDate,
}: PortfolioCompanyHeaderProps) {
  const navigate = useNavigate();

  const formattedDate = investmentDate
    ? new Date(investmentDate).toLocaleDateString("fr-FR", {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : null;

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-4">
        {/* Back Button */}
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate("/portfolio")}
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
            {sectors && sectors.length > 0 && (
              <SectorBadges sectors={sectors} maxDisplay={3} />
            )}
          </div>

          {/* Preview/Description */}
          {preview && (
            <p className="text-muted-foreground mt-1 line-clamp-2">{preview}</p>
          )}

          {/* Metadata */}
          <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
            {formattedDate && (
              <span>Investi le: {formattedDate}</span>
            )}
            {domain && (
              <a
                href={`https://${domain}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline"
              >
                {domain}
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
