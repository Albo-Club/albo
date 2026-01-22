import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { differenceInMonths, format } from "date-fns";
import { fr } from "date-fns/locale";
import { cn } from "@/lib/utils";

interface PortfolioCompanyLastNewsProps {
  lastNews: string | null;
  lastNewsUpdatedAt: string | null;
}

export function PortfolioCompanyLastNews({
  lastNews,
  lastNewsUpdatedAt,
}: PortfolioCompanyLastNewsProps) {
  const isOlderThanOneMonth = lastNewsUpdatedAt
    ? differenceInMonths(new Date(), new Date(lastNewsUpdatedAt)) >= 1
    : false;

  const formattedDate = lastNewsUpdatedAt
    ? format(new Date(lastNewsUpdatedAt), "d MMMM yyyy", { locale: fr })
    : null;

  return (
    <Card className="h-full">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">Dernières nouvelles</CardTitle>
          {formattedDate && (
            <span
              className={cn(
                "text-sm",
                isOlderThanOneMonth
                  ? "text-destructive font-medium"
                  : "text-muted-foreground"
              )}
            >
              {formattedDate}
            </span>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {lastNews ? (
          <div className="prose prose-sm dark:prose-invert max-w-none">
            <p className="text-foreground whitespace-pre-wrap">{lastNews}</p>
          </div>
        ) : (
          <p className="text-muted-foreground text-sm">
            Aucune nouvelle enregistrée pour cette entreprise.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
