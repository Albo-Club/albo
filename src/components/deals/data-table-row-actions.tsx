import { Row } from "@tanstack/react-table";
import { MoreHorizontal, Eye, Download, Trash2, FileText } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Deal } from "./columns";

interface DataTableRowActionsProps {
  row: Row<Deal>;
}

export function DataTableRowActions({ row }: DataTableRowActionsProps) {
  const deal = row.original;

  const handleViewDetail = (e: React.MouseEvent) => {
    e.stopPropagation();
    // Navigate to deal detail - will be handled by parent
    window.location.href = `/deals/${deal.id}`;
  };

  const handleViewMemo = (e: React.MouseEvent) => {
    e.stopPropagation();
    // Dispatch custom event to open memo modal
    if (deal.memo_html) {
      window.dispatchEvent(
        new CustomEvent("view-memo", {
          detail: { html: deal.memo_html, companyName: deal.company_name },
        })
      );
    }
  };

  const handleDownloadDeck = (e: React.MouseEvent) => {
    e.stopPropagation();
    window.dispatchEvent(
      new CustomEvent("download-deck", { detail: { deal } })
    );
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    window.dispatchEvent(
      new CustomEvent("delete-deal", { detail: { deal } })
    );
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          className="flex h-8 w-8 p-0 data-[state=open]:bg-muted"
          onClick={(e) => e.stopPropagation()}
        >
          <MoreHorizontal className="h-4 w-4" />
          <span className="sr-only">Menu</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[160px]">
        <DropdownMenuItem onClick={handleViewDetail}>
          <Eye className="mr-2 h-4 w-4" />
          Voir le détail
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={handleViewMemo}
          disabled={!deal.memo_html}
        >
          <FileText className="mr-2 h-4 w-4" />
          Voir le mémo
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={handleDownloadDeck}
          disabled={!deal.hasDeck}
        >
          <Download className="mr-2 h-4 w-4" />
          Télécharger le deck
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={handleDelete}
          className="text-destructive focus:text-destructive"
        >
          <Trash2 className="mr-2 h-4 w-4" />
          Supprimer
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
