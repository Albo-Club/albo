import { Loader2 } from "lucide-react";
import { usePortfolioCompanies } from "@/hooks/usePortfolioCompanies";
import { PortfolioStats } from "@/components/portfolio/PortfolioStats";
import { PortfolioTable } from "@/components/portfolio/PortfolioTable";
import { useWorkspace } from "@/contexts/WorkspaceContext";

export default function PortfolioPage() {
  const { workspace, loading: workspaceLoading } = useWorkspace();
  const { data: companies = [], isLoading, error } = usePortfolioCompanies();

  if (workspaceLoading || isLoading) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!workspace) {
    return (
      <div className="flex h-[50vh] flex-col items-center justify-center gap-2">
        <p className="text-muted-foreground">
          Sélectionnez un workspace pour voir le portfolio.
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-[50vh] flex-col items-center justify-center gap-2">
        <p className="text-destructive">
          Erreur lors du chargement du portfolio.
        </p>
        <p className="text-sm text-muted-foreground">{error.message}</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Portfolio</h1>
        <p className="text-muted-foreground">
          Entreprises dans lesquelles le fonds a investi
        </p>
      </div>

      {/* Stats Cards */}
      <PortfolioStats companies={companies} />

      {/* Table */}
      <PortfolioTable data={companies} />
    </div>
  );
}
