import { Newspaper } from "lucide-react";
import { differenceInMonths, format } from "date-fns";
import { fr } from "date-fns/locale";
import { cn } from "@/lib/utils";

interface PortfolioCompanyLastNewsProps {
  keyHighlights: string[] | null;
  reportPeriod: string | null;
  lastNewsUpdatedAt: string | null;
}

export function PortfolioCompanyLastNews({
  keyHighlights,
  reportPeriod,
  lastNewsUpdatedAt,
}: PortfolioCompanyLastNewsProps) {
  const isOlderThanOneMonth = lastNewsUpdatedAt
    ? differenceInMonths(new Date(), new Date(lastNewsUpdatedAt)) >= 1
    : false;

  const formattedDate = lastNewsUpdatedAt
    ? format(new Date(lastNewsUpdatedAt), "d MMMM yyyy", { locale: fr })
    : null;

  // Use reportPeriod if available, otherwise formatted date
  const displayDate = reportPeriod || formattedDate;

  return (
    <div className="space-y-4">
      {/* Minimalist Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Newspaper className="h-4 w-4 text-muted-foreground" />
          <span className="text-xs font-medium tracking-wider uppercase text-muted-foreground">
            Key Highlights
          </span>
        </div>
        {displayDate && (
          <span
            className={cn(
              "text-xs",
              isOlderThanOneMonth
                ? "text-amber-600 font-medium"
                : "text-muted-foreground"
            )}
          >
            {displayDate}
          </span>
        )}
      </div>

      {/* Key Highlights */}
      {keyHighlights && keyHighlights.length > 0 ? (
        <div className="space-y-1">
          {keyHighlights.map((highlight, index) => (
            <div
              key={index}
              className="group border-l-2 border-primary/50 pl-4 py-3 hover:border-primary hover:bg-muted/30 transition-all rounded-r-md cursor-default"
            >
              <p className="text-sm text-foreground/85 leading-relaxed group-hover:text-foreground transition-colors">
                {highlight}
              </p>
            </div>
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <Newspaper className="h-8 w-8 text-muted-foreground/40 mb-3" />
          <p className="text-sm text-muted-foreground">
            Aucun report reçu pour cette entreprise.
          </p>
        </div>
      )}
    </div>
  );
}
