import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Newspaper } from "lucide-react";
import { differenceInMonths, format } from "date-fns";
import { fr } from "date-fns/locale";
import { cn } from "@/lib/utils";
import React from "react";

interface PortfolioCompanyLastNewsProps {
  keyHighlights: string[] | null;
  reportPeriod: string | null;
  lastNewsUpdatedAt: string | null;
}

// Fonction pour mettre en gras les chiffres clés dans le texte
const highlightNumbers = (text: string): React.ReactNode => {
  // Regex pour détecter : montants €, pourcentages, multiplicateurs, grands nombres
  const regex = /(\d+[,.\s]?\d*\s?[MkK]?€|\d+[,.]?\d*\s?%|x\d+[,.]?\d*|\d{1,3}(?:[\s,]\d{3})+(?:[,.]\d+)?|\d+[,.]?\d*\s?(?:M€|k€|K€))/g;
  
  const parts = text.split(regex);
  const matches = text.match(regex) || [];
  
  const result: React.ReactNode[] = [];
  let matchIndex = 0;
  
  parts.forEach((part, i) => {
    if (part) {
      result.push(part);
    }
    if (matchIndex < matches.length && i < parts.length - 1) {
      result.push(
        <strong key={`match-${i}`} className="font-semibold text-foreground">
          {matches[matchIndex]}
        </strong>
      );
      matchIndex++;
    }
  });
  
  return result;
};

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
    <Card className="h-full">
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
                <p className="text-muted-foreground text-sm leading-relaxed">
                  {highlightNumbers(highlight)}
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
