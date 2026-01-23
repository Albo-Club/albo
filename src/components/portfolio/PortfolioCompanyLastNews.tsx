import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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

  return (
    <Card className="h-auto">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Newspaper className="h-4 w-4 text-primary" />
            <CardTitle className="text-lg">
              Last news {reportPeriod && `- ${reportPeriod}`}
            </CardTitle>
          </div>
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
        {keyHighlights && keyHighlights.length > 0 ? (
          <div className="space-y-3">
            {keyHighlights.map((highlight, index) => (
              <div
                key={index}
                className="bg-muted/50 border-l-4 border-primary rounded-md p-4"
              >
                <p className="font-semibold text-foreground/80 text-sm leading-relaxed">
                  {highlight}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-muted-foreground text-sm">
            Aucun report reçu pour cette entreprise.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
