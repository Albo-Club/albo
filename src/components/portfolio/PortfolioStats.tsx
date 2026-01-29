import { Wallet, Building2, PieChart, TrendingUp } from "lucide-react";
import { CardContent } from "@/components/ui/card";
import { GradientCard, GradientVariant } from "@/components/ui/gradient-card";
import { PortfolioCompany } from "@/hooks/usePortfolioCompanies";
import { formatCurrency } from "@/lib/portfolioFormatters";

interface PortfolioStatsProps {
  companies: PortfolioCompany[];
}

const statVariants: GradientVariant[] = ["orange", "purple", "green", "polar"];

export function PortfolioStats({ companies }: PortfolioStatsProps) {
  const totalInvested = companies.reduce(
    (sum, c) => sum + (c.amount_invested_euros || 0),
    0
  );

  // Collect unique sectors from the multi-sector array
  const uniqueSectors = new Set(
    companies.flatMap((c) => c.sectors || [])
  );

  const averageOwnership =
    companies.length > 0
      ? companies.reduce((sum, c) => sum + (c.ownership_percentage || 0), 0) /
        companies.filter((c) => c.ownership_percentage).length
      : 0;

  const stats = [
    {
      label: "Total investi",
      value: formatCurrency(totalInvested),
      icon: Wallet,
      description: "Montant total des investissements",
    },
    {
      label: "Entreprises",
      value: companies.length.toString(),
      icon: Building2,
      description: "Nombre de participations",
    },
    {
      label: "Secteurs",
      value: uniqueSectors.size.toString(),
      icon: PieChart,
      description: "Secteurs représentés",
    },
    {
      label: "Participation moy.",
      value: averageOwnership ? `${(averageOwnership * 100).toFixed(2)}%` : "-",
      icon: TrendingUp,
      description: "Pourcentage moyen détenu",
    },
  ];

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {stats.map((stat, index) => (
        <GradientCard key={stat.label} variant={statVariants[index % statVariants.length]}>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-background/80">
                <stat.icon className="h-6 w-6 text-foreground" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">{stat.label}</p>
                <p className="text-2xl font-bold">{stat.value}</p>
              </div>
            </div>
          </CardContent>
        </GradientCard>
      ))}
    </div>
  );
}
