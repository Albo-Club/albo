import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ExternalLink, Download, Globe, MapPin, Building, DollarSign, Briefcase, Calendar, Eye } from "lucide-react";
import { formatAmount } from "@/lib/utils";
import { useTranslation } from "react-i18next";

interface DealInfoCardProps {
  deal: {
    sector?: string | null;
    sub_sector?: string | null;
    stage?: string | null;
    investment_amount_eur?: number | null;
    funding_type?: string | null;
    source?: string | null;
    sender_email?: string | null;
    created_at: string;
    analyzed_at?: string | null;
  };
  onDownloadDeck?: () => void;
  onViewDeck?: () => void;
  hasDeck?: boolean;
}

export function DealInfoCard({ deal, onDownloadDeck, onViewDeck, hasDeck }: DealInfoCardProps) {
  const { t, i18n } = useTranslation();
  const dateLocaleStr = i18n.language === 'fr' ? 'fr-FR' : 'en-US';
  const displayAmount = deal.investment_amount_eur
    ? formatAmount(String(deal.investment_amount_eur))
    : null;

  const infoItems = [
    { icon: Building, label: t('dealsPage.info.sector'), value: deal.sector },
    { icon: Briefcase, label: t('dealsPage.info.subSector'), value: deal.sub_sector },
    { icon: Calendar, label: t('dealsPage.info.stage'), value: deal.stage },
    { icon: DollarSign, label: t('dealsPage.info.amountSought'), value: displayAmount },
    { icon: Briefcase, label: t('dealsPage.info.fundingType'), value: deal.funding_type },
    { icon: Globe, label: t('dealsPage.info.source'), value: deal.source === "email" ? t('dealsPage.info.sourceEmail') : t('dealsPage.info.sourceForm') },
  ].filter((item) => item.value);

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">{t('dealsPage.info.title')}</CardTitle>
          {hasDeck && (
            <div className="flex items-center gap-2">
              {onViewDeck && (
                <Button variant="outline" size="sm" onClick={onViewDeck}>
                  <Eye className="h-4 w-4 mr-2" />
                  Voir
                </Button>
              )}
              <Button variant="outline" size="sm" onClick={onDownloadDeck}>
                <Download className="h-4 w-4 mr-2" />
                {t('dealsPage.info.downloadDeck')}
              </Button>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
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

        {deal.sender_email && (
          <div className="pt-4 border-t">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
              <MapPin className="h-3.5 w-3.5" />
              <span>{t('dealsPage.info.senderEmail')}</span>
            </div>
            <a href={`mailto:${deal.sender_email}`} className="text-primary hover:underline text-sm">
              {deal.sender_email}
            </a>
          </div>
        )}

        <div className="pt-4 border-t">
          <p className="text-sm text-muted-foreground mb-2">{t('dealsPage.info.tags')}</p>
          <div className="flex flex-wrap gap-2">
            {deal.sector && <Badge variant="secondary">{deal.sector}</Badge>}
            {deal.stage && <Badge variant="secondary">{deal.stage}</Badge>}
            {deal.funding_type && <Badge variant="secondary">{deal.funding_type}</Badge>}
          </div>
        </div>

        <div className="pt-4 border-t text-xs text-muted-foreground space-y-1">
          <p>
            {t('dealsPage.info.createdAt')}{" "}
            {new Date(deal.created_at).toLocaleDateString(dateLocaleStr, { day: "numeric", month: "long", year: "numeric" })}
          </p>
          {deal.analyzed_at && (
            <p>
              {t('dealsPage.info.analyzedAt')}{" "}
              {new Date(deal.analyzed_at).toLocaleDateString(dateLocaleStr, { day: "numeric", month: "long", year: "numeric" })}
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
