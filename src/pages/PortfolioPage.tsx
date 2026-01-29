import { useState } from "react";
import { Loader2, Plus, Upload } from "lucide-react";
import { usePortfolioCompanies } from "@/hooks/usePortfolioCompanies";
import { PortfolioStats } from "@/components/portfolio/PortfolioStats";
import { PortfolioTable } from "@/components/portfolio/PortfolioTable";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { Button } from "@/components/ui/button";
import { AddPortfolioCompanyModal } from "@/components/portfolio/AddPortfolioCompanyModal";
import { ImportPortfolioModal } from "@/components/portfolio/ImportPortfolioModal";

export default function PortfolioPage() {
  const { workspace, loading: workspaceLoading } = useWorkspace();
  const { data: companies = [], isLoading, error } = usePortfolioCompanies();
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [importModalOpen, setImportModalOpen] = useState(false);

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
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="shrink-0 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Portfolio</h1>
          <p className="text-muted-foreground">
            Entreprises dans lesquelles le fonds a investi
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => setImportModalOpen(true)} variant="outline" className="gap-2">
            <Upload className="h-4 w-4" />
            Import CSV
          </Button>
          <Button onClick={() => setAddModalOpen(true)} className="gap-2">
            <Plus className="h-4 w-4" />
            Add Company
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="shrink-0 mt-6">
        <PortfolioStats companies={companies} />
      </div>

      {/* Table - takes remaining space */}
      <div className="flex-1 min-h-0 mt-6">
        <PortfolioTable data={companies} />
      </div>

      {/* Add Company Modal */}
      <AddPortfolioCompanyModal 
        open={addModalOpen} 
        onClose={() => setAddModalOpen(false)} 
      />

      {/* Import CSV Modal */}
      <ImportPortfolioModal
        open={importModalOpen}
        onClose={() => setImportModalOpen(false)}
      />
    </div>
  );
}
