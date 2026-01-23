import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MessageSquareQuote, Sparkles } from "lucide-react";
import { differenceInMonths, format } from "date-fns";
import { fr } from "date-fns/locale";
import { cn } from "@/lib/utils";

interface PortfolioCompanyLastNewsProps {
  headline: string | null;
  keyHighlights: string[] | null;
  reportPeriod: string | null;
  lastNewsUpdatedAt: string | null;
}

export function PortfolioCompanyLastNews({
  headline,
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
    <div className="relative">
      {/* Headline Bubble - dépasse du rectangle */}
      {headline && (
        <div className="relative z-10 -mb-4">
          <div className="mx-4">
            <div className="bg-primary/10 border border-primary/20 rounded-xl p-4 shadow-sm">
              <div className="flex items-start gap-3">
                <MessageSquareQuote className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                <p className="text-sm font-medium text-foreground leading-relaxed">
                  {headline}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main Card */}
      <Card className={cn("h-full", headline && "pt-6")}>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              <CardTitle className="text-lg">
                Points clés {reportPeriod && `- ${reportPeriod}`}
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
                <div key={index} className="flex items-start gap-3">
                  <Badge
                    variant="secondary"
                    className="h-6 w-6 rounded-full p-0 flex items-center justify-center text-xs flex-shrink-0"
                  >
                    {index + 1}
                  </Badge>
                  <p className="text-sm text-foreground leading-relaxed">
                    {highlight}
                  </p>
                </div>
              ))}
            </div>
          ) : !headline ? (
            <p className="text-muted-foreground text-sm">
              Aucun report reçu pour cette entreprise.
            </p>
          ) : (
            <p className="text-muted-foreground text-sm">
              Pas de points clés détaillés dans le dernier report.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
