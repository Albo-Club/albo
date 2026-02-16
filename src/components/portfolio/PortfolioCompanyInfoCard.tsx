import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DollarSign,
  Wallet,
  PieChart,
  Briefcase,
  Globe,
  Building,
  FileText,
  Users,
  Calendar,
} from "lucide-react";
import { differenceInMonths, format } from "date-fns";
import { fr } from "date-fns/locale";
import { formatAmount, cn } from "@/lib/utils";
import { formatPercentage } from "@/lib/portfolioFormatters";
import { SectorBadges } from "./SectorBadges";
import { getInvestmentTypeColors, getInvestmentTypeDisplayLabel } from "@/types/portfolio";

interface PortfolioCompanyInfoCardProps {
  company: {
    entry_valuation_euros: number | null;
    amount_invested_euros: number | null;
    ownership_percentage: number | null;
    investment_type: string | null;
    domain: string | null;
    sectors: string[] | null;
    investment_date: string | null;
    last_news_updated_at: string | null;
  };
}

export function PortfolioCompanyInfoCard({ company }: PortfolioCompanyInfoCardProps) {
  const isOlderThanOneMonth = company.last_news_updated_at
    ? differenceInMonths(new Date(), new Date(company.last_news_updated_at)) >= 1
    : false;

  const lastNewsDate = company.last_news_updated_at
    ? format(new Date(company.last_news_updated_at), "d MMM yyyy", { locale: fr })
    : null;

  const investmentDate = company.investment_date
    ? format(new Date(company.investment_date), "d MMMM yyyy", { locale: fr })
    : null;

  const investmentTypeColors = company.investment_type
    ? getInvestmentTypeColors(company.investment_type)
    : null;

  const infoItems = [
    {
      icon: DollarSign,
      label: "Valorisation d'entrée",
      value: company.entry_valuation_euros ? formatAmount(String(company.entry_valuation_euros)) : null,
    },
    {
      icon: Wallet,
      label: "Montant investi",
      value: company.amount_invested_euros ? formatAmount(String(company.amount_invested_euros)) : null,
    },
    {
      icon: PieChart,
      label: "Participation",
      value: formatPercentage(company.ownership_percentage),
    },
    {
      icon: Briefcase,
      label: "Type d'investissement",
      value: company.investment_type,
      customRender: company.investment_type && investmentTypeColors ? (
        <Badge
          variant="outline"
          className={cn(
            investmentTypeColors.bg,
            investmentTypeColors.text,
            investmentTypeColors.border,
            "text-xs font-medium"
          )}
        >
          {getInvestmentTypeDisplayLabel(company.investment_type)}
        </Badge>
      ) : null,
    },
    {
      icon: Globe,
      label: "Domaine",
      value: company.domain,
      customRender: company.domain ? (
        <a
          href={`https://${company.domain}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary hover:underline text-sm"
        >
          {company.domain}
        </a>
      ) : null,
    },
  ].filter((item) => item.value || item.customRender);

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">Informations</CardTitle>
          <Button variant="outline" size="sm" disabled>
            <FileText className="h-4 w-4 mr-2" />
            Last Report
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Info Grid */}
        <div className="grid grid-cols-2 gap-4">
          {infoItems.map((item, index) => (
            <div key={index} className="space-y-1">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <item.icon className="h-3.5 w-3.5" />
                <span>{item.label}</span>
              </div>
              {item.customRender ? (
                item.customRender
              ) : (
                <p className="font-medium">{item.value || "-"}</p>
              )}
            </div>
          ))}
        </div>

        {/* Last News Date */}
        {lastNewsDate && (
          <div className="pt-4 border-t">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
              <Calendar className="h-3.5 w-3.5" />
              <span>Dernières nouvelles</span>
            </div>
            <p
              className={cn(
                "font-medium",
                isOlderThanOneMonth ? "text-destructive" : "text-foreground"
              )}
            >
              {lastNewsDate}
            </p>
          </div>
        )}

        {/* Sectors */}
        {company.sectors && company.sectors.length > 0 && (
          <div className="pt-4 border-t">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
              <Building className="h-3.5 w-3.5" />
              <span>Secteurs</span>
            </div>
            <SectorBadges sectors={company.sectors} maxDisplay={5} />
          </div>
        )}

        {/* Co-invest placeholder */}
        <div className="pt-4 border-t">
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
            <Users className="h-3.5 w-3.5" />
            <span>Co-investisseurs</span>
          </div>
          <p className="text-sm text-muted-foreground italic">
            Aucun co-investisseur renseigné
          </p>
        </div>

        {/* Investment Date */}
        {investmentDate && (
          <div className="pt-4 border-t text-xs text-muted-foreground">
            <p>Investissement le: {investmentDate}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
