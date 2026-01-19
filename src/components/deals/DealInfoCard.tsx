import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ExternalLink, Download, Globe, MapPin, Building, DollarSign, Briefcase, Calendar } from "lucide-react";
import { formatAmount } from "@/lib/utils";

interface DealInfoCardProps {
  deal: {
    sector?: string | null;
    sub_sector?: string | null;
    stage?: string | null;
    amount_sought?: string | null;
    investment_amount_eur?: number | null;
    funding_type?: string | null;
    source?: string | null;
    sender_email?: string | null;
    created_at: string;
    analyzed_at?: string | null;
  };
  onDownloadDeck?: () => void;
  hasDeck?: boolean;
}

export function DealInfoCard({ deal, onDownloadDeck, hasDeck }: DealInfoCardProps) {
  const displayAmount = deal.investment_amount_eur
    ? formatAmount(String(deal.investment_amount_eur))
    : deal.amount_sought
    ? formatAmount(deal.amount_sought)
    : null;

  const infoItems = [
    { icon: Building, label: "Secteur", value: deal.sector },
    { icon: Briefcase, label: "Sous-secteur", value: deal.sub_sector },
    { icon: Calendar, label: "Stade", value: deal.stage },
    { icon: DollarSign, label: "Montant recherché", value: displayAmount },
    { icon: Briefcase, label: "Type de financement", value: deal.funding_type },
    { icon: Globe, label: "Source", value: deal.source === "email" ? "Email" : "Formulaire" },
  ].filter((item) => item.value);

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">Informations</CardTitle>
          {hasDeck && (
            <Button variant="outline" size="sm" onClick={onDownloadDeck}>
              <Download className="h-4 w-4 mr-2" />
              Télécharger le deck
            </Button>
          )}
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
              <p className="font-medium">{item.value}</p>
            </div>
          ))}
        </div>

        {/* Sender Email */}
        {deal.sender_email && (
          <div className="pt-4 border-t">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
              <MapPin className="h-3.5 w-3.5" />
              <span>Email expéditeur</span>
            </div>
            <a
              href={`mailto:${deal.sender_email}`}
              className="text-primary hover:underline text-sm"
            >
              {deal.sender_email}
            </a>
          </div>
        )}

        {/* Keywords/Tags placeholder */}
        <div className="pt-4 border-t">
          <p className="text-sm text-muted-foreground mb-2">Tags</p>
          <div className="flex flex-wrap gap-2">
            {deal.sector && (
              <Badge variant="secondary">{deal.sector}</Badge>
            )}
            {deal.stage && (
              <Badge variant="secondary">{deal.stage}</Badge>
            )}
            {deal.funding_type && (
              <Badge variant="secondary">{deal.funding_type}</Badge>
            )}
          </div>
        </div>

        {/* Dates */}
        <div className="pt-4 border-t text-xs text-muted-foreground space-y-1">
          <p>
            Créé le:{" "}
            {new Date(deal.created_at).toLocaleDateString("fr-FR", {
              day: "numeric",
              month: "long",
              year: "numeric",
            })}
          </p>
          {deal.analyzed_at && (
            <p>
              Analysé le:{" "}
              {new Date(deal.analyzed_at).toLocaleDateString("fr-FR", {
                day: "numeric",
                month: "long",
                year: "numeric",
              })}
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
