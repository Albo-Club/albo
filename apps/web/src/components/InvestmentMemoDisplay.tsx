import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  AlertCircle, TrendingUp, Target, Users, DollarSign, Sparkles,
  Lightbulb, BarChart3, Trophy, Zap, ShieldAlert, Calendar,
  LineChart, PieChart, Flag, Award, Briefcase, CheckCircle2
} from "lucide-react";
import { ParsedMemo, parseMemoMarkdown } from "@/utils/memoParser";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface InvestmentMemoDisplayProps {
  memoMarkdown: string;
  dealData?: {
    companyName?: string;
    sector?: string;
    arr?: number;
    yoyGrowth?: number;
  };
  isStreaming?: boolean;
}

export function InvestmentMemoDisplay({
  memoMarkdown,
  dealData,
  isStreaming
}: InvestmentMemoDisplayProps) {
  const parsed: ParsedMemo = parseMemoMarkdown(memoMarkdown);

  const getDecisionColor = (decision?: string) => {
    if (!decision) return "default";
    if (decision === 'GO') return "default";
    if (decision === 'CONDITIONAL') return "secondary";
    if (decision === 'NO-GO') return "destructive";
    return "default";
  };

  const getDecisionLabel = (decision?: string) => {
    if (!decision) return "En analyse";
    if (decision === 'GO') return "GO";
    if (decision === 'CONDITIONAL') return "GO Conditionnel";
    if (decision === 'NO-GO') return "NO-GO";
    return decision;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="space-y-2">
        {parsed.title && (
          <h1 className="text-3xl font-bold tracking-tight">
            {parsed.title}
          </h1>
        )}

        <div className="flex flex-wrap items-center gap-2">
          {parsed.dealSource && (
            <Badge variant="outline">
              {parsed.dealSource}
            </Badge>
          )}

          {parsed.executiveSummary?.decision && (
            <Badge variant={getDecisionColor(parsed.executiveSummary.decision)}>
              {getDecisionLabel(parsed.executiveSummary.decision)}
            </Badge>
          )}

          {isStreaming && (
            <Badge variant="secondary" className="animate-pulse">
              <span className="flex items-center gap-1">
                <Sparkles className="h-3 w-3" />
                Génération en cours
              </span>
            </Badge>
          )}
        </div>
      </div>

      {/* Key Metrics */}
      {parsed.metrics && parsed.metrics.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {parsed.metrics.slice(0, 4).map((metric, idx) => (
            <div key={idx} className="relative group">
              <Card className="overflow-hidden transition-all duration-300 hover:shadow-md">
                <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      {metric.label}
                    </p>
                  </div>
                  <div className="flex items-baseline gap-2">
                    <p className="text-2xl font-bold">
                      {metric.value}
                    </p>
                    {metric.benchmark && (
                      <p className="text-xs text-muted-foreground">
                        Benchmark: {metric.benchmark}
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          ))}
        </div>
      )}

      {/* Executive Summary */}
      {parsed.executiveSummary && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5" />
              Synthèse exécutive
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {parsed.executiveSummary.what && (
              <div>
                <h4 className="font-semibold mb-1">Quoi</h4>
                <p className="text-muted-foreground">{parsed.executiveSummary.what}</p>
              </div>
            )}

            {parsed.executiveSummary.whyItWins && (
              <div>
                <h4 className="font-semibold mb-1">Pourquoi ça gagne</h4>
                <p className="text-muted-foreground">{parsed.executiveSummary.whyItWins}</p>
              </div>
            )}

            {parsed.executiveSummary.proofPoints && parsed.executiveSummary.proofPoints.length > 0 && (
              <div>
                <h4 className="font-semibold mb-1">Preuves</h4>
                <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                  {parsed.executiveSummary.proofPoints.map((point, idx) => (
                    <li key={idx}>{point}</li>
                  ))}
                </ul>
              </div>
            )}

            {parsed.executiveSummary.risks && parsed.executiveSummary.risks.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <ShieldAlert className="h-4 w-4 text-destructive" />
                  <span className="font-semibold">Risques majeurs</span>
                </div>
                <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                  {parsed.executiveSummary.risks.map((risk, idx) => (
                    <li key={idx}>{risk}</li>
                  ))}
                </ul>
              </div>
            )}

            {parsed.executiveSummary.decisionText && (
              <div>
                <h4 className="font-semibold mb-1">Décision</h4>
                <p className="text-muted-foreground whitespace-pre-wrap">
                  {parsed.executiveSummary.decisionText}
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Terms */}
      {parsed.terms && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5" />
              Terms
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {parsed.terms.ticket && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Ticket</span>
                <span className="font-medium">{parsed.terms.ticket}</span>
              </div>
            )}

            {parsed.terms.preMoneyValuation && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Pré-money</span>
                <span className="font-medium">{parsed.terms.preMoneyValuation}</span>
              </div>
            )}

            {parsed.terms.useOfFunds && (
              <div>
                <span className="text-muted-foreground">Usage des fonds</span>
                <p className="mt-1">{parsed.terms.useOfFunds}</p>
              </div>
            )}

            {parsed.terms.milestones && parsed.terms.milestones.length > 0 && (
              <div>
                <span className="text-muted-foreground">Jalons clés</span>
                <ul className="mt-1 list-disc list-inside">
                  {parsed.terms.milestones.map((milestone, idx) => (
                    <li key={idx}>{milestone}</li>
                  ))}
                </ul>
              </div>
            )}

            {parsed.terms.exitScenarios && parsed.terms.exitScenarios.length > 0 && (
              <div>
                <span className="text-muted-foreground">Scénarios de sortie</span>
                <ul className="mt-1 list-disc list-inside">
                  {parsed.terms.exitScenarios.map((scenario, idx) => (
                    <li key={idx}>{scenario}</li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Problem & Solution */}
      {parsed.problemSolution && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lightbulb className="h-5 w-5" />
              Problem & Solution
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {parsed.problemSolution.problem && (
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <AlertCircle className="h-4 w-4 text-destructive" />
                  <span className="font-semibold">Problème adressé</span>
                </div>
                <p className="text-muted-foreground">
                  {parsed.problemSolution.problem}
                </p>
              </div>
            )}

            {parsed.problemSolution.solution && (
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle2 className="h-4 w-4 text-primary" />
                  <span className="font-semibold">Solution proposée</span>
                </div>
                <p className="text-muted-foreground">
                  {parsed.problemSolution.solution}
                </p>
              </div>
            )}

            {parsed.problemSolution.keyPillars && parsed.problemSolution.keyPillars.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Flag className="h-4 w-4" />
                  <span className="font-semibold">Piliers clés</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {parsed.problemSolution.keyPillars.map((pillar, idx) => (
                    <div key={idx} className="flex items-center gap-1 text-sm bg-muted px-2 py-1 rounded">
                      <CheckCircle2 className="h-3 w-3 text-primary" />
                      {pillar}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {parsed.problemSolution.valueProposition && (
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Award className="h-4 w-4" />
                  <span className="font-semibold">Proposition de valeur</span>
                </div>
                <p className="text-muted-foreground">{parsed.problemSolution.valueProposition}</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Market Analysis */}
      {parsed.marketAnalysis && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <PieChart className="h-5 w-5" />
              Analyse du marché
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* TAM/SAM/SOM Grid */}
            {(parsed.marketAnalysis.tam || parsed.marketAnalysis.sam || parsed.marketAnalysis.som) && (
              <div className="grid grid-cols-3 gap-4">
                {parsed.marketAnalysis.tam && (
                  <div className="text-center p-4 rounded-lg bg-muted/50">
                    <p className="text-xs font-medium text-muted-foreground uppercase">TAM</p>
                    <p className="text-lg font-bold">{parsed.marketAnalysis.tam}</p>
                  </div>
                )}

                {parsed.marketAnalysis.sam && (
                  <div className="text-center p-4 rounded-lg bg-muted/50">
                    <p className="text-xs font-medium text-muted-foreground uppercase">SAM</p>
                    <p className="text-lg font-bold">{parsed.marketAnalysis.sam}</p>
                  </div>
                )}

                {parsed.marketAnalysis.som && (
                  <div className="text-center p-4 rounded-lg bg-muted/50">
                    <p className="text-xs font-medium text-muted-foreground uppercase">SOM</p>
                    <p className="text-lg font-bold">{parsed.marketAnalysis.som}</p>
                  </div>
                )}
              </div>
            )}

            {parsed.marketAnalysis.marketTrends && parsed.marketAnalysis.marketTrends.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <TrendingUp className="h-4 w-4" />
                  <span className="font-semibold">Tendances du marché</span>
                </div>
                <ul className="space-y-1">
                  {parsed.marketAnalysis.marketTrends.map((trend, idx) => (
                    <li key={idx} className="flex items-start gap-2 text-muted-foreground">
                      <LineChart className="h-4 w-4 mt-0.5 shrink-0" />
                      {trend}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {parsed.marketAnalysis.growthDrivers && parsed.marketAnalysis.growthDrivers.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Zap className="h-4 w-4" />
                  <span className="font-semibold">Moteurs de croissance</span>
                </div>
                <ul className="space-y-1">
                  {parsed.marketAnalysis.growthDrivers.map((driver, idx) => (
                    <li key={idx} className="flex items-start gap-2 text-muted-foreground">
                      <TrendingUp className="h-4 w-4 mt-0.5 shrink-0" />
                      {driver}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {parsed.marketAnalysis.marketDynamics && (
              <div>
                <p className="font-semibold mb-1">Dynamique du marché</p>
                <p className="text-muted-foreground">{parsed.marketAnalysis.marketDynamics}</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Team */}
      {parsed.team && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Équipe & Exécution
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {parsed.team.founders && parsed.team.founders.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Trophy className="h-4 w-4" />
                  <span className="font-semibold">Fondateurs</span>
                </div>
                <div className="grid gap-3">
                  {parsed.team.founders.map((founder, idx) => (
                    <div key={idx} className="p-3 rounded-lg bg-muted/50">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                          <Users className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <p className="font-medium">{founder.name}</p>
                          {founder.role && (
                            <p className="text-sm text-muted-foreground">{founder.role}</p>
                          )}
                          {founder.background && (
                            <p className="text-sm text-muted-foreground">{founder.background}</p>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {parsed.team.keyHires && parsed.team.keyHires.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Briefcase className="h-4 w-4" />
                  <span className="font-semibold">Recrutements clés</span>
                </div>
                <ul className="space-y-1">
                  {parsed.team.keyHires.map((hire, idx) => (
                    <li key={idx} className="flex items-center gap-2 text-muted-foreground">
                      <CheckCircle2 className="h-3 w-3" />
                      {hire}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {parsed.team.advisors && parsed.team.advisors.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Award className="h-4 w-4" />
                  <span className="font-semibold">Conseillers</span>
                </div>
                <ul className="space-y-1">
                  {parsed.team.advisors.map((advisor, idx) => (
                    <li key={idx} className="flex items-center gap-2 text-muted-foreground">
                      <Users className="h-3 w-3" />
                      {advisor}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {parsed.team.teamStrength && (
              <div>
                <p className="font-semibold mb-1">Forces de l'équipe</p>
                <p className="text-muted-foreground">{parsed.team.teamStrength}</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Business Model */}
      {parsed.businessModel && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Modèle économique
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {parsed.businessModel.revenueStreams && parsed.businessModel.revenueStreams.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <DollarSign className="h-4 w-4" />
                  <span className="font-semibold">Flux de revenus</span>
                </div>
                <ul className="space-y-1">
                  {parsed.businessModel.revenueStreams.map((stream, idx) => (
                    <li key={idx} className="flex items-center gap-2 text-muted-foreground">
                      <CheckCircle2 className="h-3 w-3" />
                      {stream}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Unit Economics Grid */}
            {parsed.businessModel.unitEconomics && (parsed.businessModel.unitEconomics.cac || parsed.businessModel.unitEconomics.ltv || parsed.businessModel.unitEconomics.ltvCacRatio) && (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <LineChart className="h-4 w-4" />
                  <span className="font-semibold">Unit Economics</span>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  {parsed.businessModel.unitEconomics.cac && (
                    <div className="text-center p-4 rounded-lg bg-muted/50">
                      <p className="text-xs font-medium text-muted-foreground uppercase">CAC</p>
                      <p className="text-lg font-bold">{parsed.businessModel.unitEconomics.cac}</p>
                    </div>
                  )}

                  {parsed.businessModel.unitEconomics.ltv && (
                    <div className="text-center p-4 rounded-lg bg-muted/50">
                      <p className="text-xs font-medium text-muted-foreground uppercase">LTV</p>
                      <p className="text-lg font-bold">{parsed.businessModel.unitEconomics.ltv}</p>
                    </div>
                  )}

                  {parsed.businessModel.unitEconomics.ltvCacRatio && (
                    <div className="text-center p-4 rounded-lg bg-muted/50">
                      <p className="text-xs font-medium text-muted-foreground uppercase">LTV/CAC</p>
                      <p className="text-lg font-bold">{parsed.businessModel.unitEconomics.ltvCacRatio}</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {parsed.businessModel.pricingModel && (
              <div>
                <p className="font-semibold mb-1">Modèle de pricing</p>
                <p className="text-muted-foreground">{parsed.businessModel.pricingModel}</p>
              </div>
            )}

            {parsed.businessModel.customerAcquisition && (
              <div>
                <p className="font-semibold mb-1">Acquisition client</p>
                <p className="text-muted-foreground">{parsed.businessModel.customerAcquisition}</p>
              </div>
            )}

            {parsed.businessModel.scalability && (
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <Zap className="h-4 w-4" />
                  <span className="font-semibold">Scalabilité</span>
                </div>
                <p className="text-muted-foreground">{parsed.businessModel.scalability}</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Competitive Landscape */}
      {parsed.competitive && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="h-5 w-5" />
              Paysage concurrentiel
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {parsed.competitive.competitors && parsed.competitive.competitors.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Flag className="h-4 w-4" />
                  <span className="font-semibold">Concurrents principaux</span>
                </div>
                <div className="space-y-2">
                  {parsed.competitive.competitors.map((competitor, idx) => (
                    <div key={idx} className="p-2 rounded bg-muted/50">
                      <p className="font-medium">{competitor.name}</p>
                      {competitor.positioning && (
                        <p className="text-sm text-muted-foreground">{competitor.positioning}</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {parsed.competitive.competitiveAdvantages && parsed.competitive.competitiveAdvantages.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Trophy className="h-4 w-4" />
                  <span className="font-semibold">Avantages concurrentiels</span>
                </div>
                <ul className="space-y-1">
                  {parsed.competitive.competitiveAdvantages.map((advantage, idx) => (
                    <li key={idx} className="flex items-center gap-2 text-muted-foreground">
                      <CheckCircle2 className="h-3 w-3 text-primary" />
                      {advantage}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {parsed.competitive.moat && (
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <ShieldAlert className="h-4 w-4" />
                  <span className="font-semibold">Barrières à l'entrée (Moat)</span>
                </div>
                <p className="text-muted-foreground">{parsed.competitive.moat}</p>
              </div>
            )}

            {parsed.competitive.differentiation && (
              <div>
                <p className="font-semibold mb-1">Différenciation</p>
                <p className="text-muted-foreground">{parsed.competitive.differentiation}</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Traction & Milestones */}
      {parsed.traction && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Traction & Jalons
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {parsed.traction.keyMetrics && parsed.traction.keyMetrics.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <BarChart3 className="h-4 w-4" />
                  <span className="font-semibold">Métriques clés</span>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {parsed.traction.keyMetrics.map((metric, idx) => (
                    <div key={idx} className="p-3 rounded-lg bg-muted/50 text-center">
                      <p className="text-xs text-muted-foreground">{metric.metric}</p>
                      <p className="text-lg font-bold">{metric.value}</p>
                      {metric.trend && (
                        <Badge variant="outline" className="mt-1">
                          {metric.trend}
                        </Badge>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {parsed.traction.milestones && parsed.traction.milestones.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Calendar className="h-4 w-4" />
                  <span className="font-semibold">Jalons atteints</span>
                </div>
                <ul className="space-y-1">
                  {parsed.traction.milestones.map((milestone, idx) => (
                    <li key={idx} className="flex items-center gap-2 text-muted-foreground">
                      <CheckCircle2 className="h-3 w-3 text-primary" />
                      {milestone}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {parsed.traction.partnerships && parsed.traction.partnerships.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Briefcase className="h-4 w-4" />
                  <span className="font-semibold">Partenariats</span>
                </div>
                <ul className="space-y-1">
                  {parsed.traction.partnerships.map((partnership, idx) => (
                    <li key={idx} className="flex items-center gap-2 text-muted-foreground">
                      <Award className="h-3 w-3" />
                      {partnership}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {parsed.traction.customerTestimonials && parsed.traction.customerTestimonials.length > 0 && (
              <div>
                <p className="font-semibold mb-2">Témoignages clients</p>
                <div className="space-y-2">
                  {parsed.traction.customerTestimonials.map((testimonial, idx) => (
                    <blockquote key={idx} className="border-l-2 border-primary pl-4 italic text-muted-foreground">
                      {testimonial}
                    </blockquote>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Financials */}
      {parsed.financials && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5" />
              Finances & Projections
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Revenue Grid */}
            {parsed.financials.revenue && (parsed.financials.revenue.current || parsed.financials.revenue.projected || parsed.financials.revenue.growth) && (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <LineChart className="h-4 w-4" />
                  <span className="font-semibold">Revenus</span>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  {parsed.financials.revenue.current && (
                    <div className="text-center p-4 rounded-lg bg-muted/50">
                      <p className="text-xs font-medium text-muted-foreground uppercase">Actuel</p>
                      <p className="text-lg font-bold">{parsed.financials.revenue.current}</p>
                    </div>
                  )}

                  {parsed.financials.revenue.projected && (
                    <div className="text-center p-4 rounded-lg bg-muted/50">
                      <p className="text-xs font-medium text-muted-foreground uppercase">Projeté</p>
                      <p className="text-lg font-bold">{parsed.financials.revenue.projected}</p>
                    </div>
                  )}

                  {parsed.financials.revenue.growth && (
                    <div className="text-center p-4 rounded-lg bg-muted/50">
                      <p className="text-xs font-medium text-muted-foreground uppercase">Croissance</p>
                      <p className="text-lg font-bold">{parsed.financials.revenue.growth}</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Burn & Runway */}
            {(parsed.financials.burnRate || parsed.financials.runway) && (
              <div className="grid grid-cols-2 gap-4">
                {parsed.financials.burnRate && (
                  <div>
                    <p className="text-sm text-muted-foreground">Burn rate</p>
                    <p className="font-medium">{parsed.financials.burnRate}</p>
                  </div>
                )}

                {parsed.financials.runway && (
                  <div>
                    <p className="text-sm text-muted-foreground">Runway</p>
                    <p className="font-medium">{parsed.financials.runway}</p>
                  </div>
                )}
              </div>
            )}

            {parsed.financials.profitability && (
              <div>
                <p className="font-semibold mb-1">Rentabilité</p>
                <p className="text-muted-foreground">{parsed.financials.profitability}</p>
              </div>
            )}

            {parsed.financials.projections && parsed.financials.projections.length > 0 && (
              <div>
                <p className="font-semibold mb-2">Projections</p>
                <ul className="space-y-1">
                  {parsed.financials.projections.map((projection, idx) => (
                    <li key={idx} className="flex items-start gap-2 text-muted-foreground">
                      <TrendingUp className="h-4 w-4 mt-0.5 shrink-0" />
                      {projection}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Risk Analysis */}
      {parsed.riskAnalysis && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShieldAlert className="h-5 w-5" />
              Analyse des risques
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {parsed.riskAnalysis.executionRisks && parsed.riskAnalysis.executionRisks.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <AlertCircle className="h-4 w-4 text-orange-500" />
                  <span className="font-semibold">Risques d'exécution</span>
                </div>
                <ul className="space-y-1">
                  {parsed.riskAnalysis.executionRisks.map((risk, idx) => (
                    <li key={idx} className="flex items-start gap-2 text-muted-foreground">
                      <AlertCircle className="h-3 w-3 mt-1 shrink-0 text-orange-500" />
                      {risk}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {parsed.riskAnalysis.marketRisks && parsed.riskAnalysis.marketRisks.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <AlertCircle className="h-4 w-4 text-yellow-500" />
                  <span className="font-semibold">Risques de marché</span>
                </div>
                <ul className="space-y-1">
                  {parsed.riskAnalysis.marketRisks.map((risk, idx) => (
                    <li key={idx} className="flex items-start gap-2 text-muted-foreground">
                      <AlertCircle className="h-3 w-3 mt-1 shrink-0 text-yellow-500" />
                      {risk}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {parsed.riskAnalysis.competitiveRisks && parsed.riskAnalysis.competitiveRisks.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <AlertCircle className="h-4 w-4 text-blue-500" />
                  <span className="font-semibold">Risques concurrentiels</span>
                </div>
                <ul className="space-y-1">
                  {parsed.riskAnalysis.competitiveRisks.map((risk, idx) => (
                    <li key={idx} className="flex items-start gap-2 text-muted-foreground">
                      <AlertCircle className="h-3 w-3 mt-1 shrink-0 text-blue-500" />
                      {risk}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {parsed.riskAnalysis.financialRisks && parsed.riskAnalysis.financialRisks.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <AlertCircle className="h-4 w-4 text-red-500" />
                  <span className="font-semibold">Risques financiers</span>
                </div>
                <ul className="space-y-1">
                  {parsed.riskAnalysis.financialRisks.map((risk, idx) => (
                    <li key={idx} className="flex items-start gap-2 text-muted-foreground">
                      <AlertCircle className="h-3 w-3 mt-1 shrink-0 text-red-500" />
                      {risk}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {parsed.riskAnalysis.mitigationStrategies && parsed.riskAnalysis.mitigationStrategies.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle2 className="h-4 w-4 text-primary" />
                  <span className="font-semibold">Stratégies d'atténuation</span>
                </div>
                <ul className="space-y-1">
                  {parsed.riskAnalysis.mitigationStrategies.map((strategy, idx) => (
                    <li key={idx} className="flex items-start gap-2 text-muted-foreground">
                      <CheckCircle2 className="h-3 w-3 mt-1 shrink-0 text-primary" />
                      {strategy}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Remaining generic sections (fallback) */}
      {parsed.sections && parsed.sections.map((section, idx) => (
        <Card key={idx}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5" />
              {section.title}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                h3: ({node, ...props}) => <h3 className="text-lg font-semibold mt-4 mb-2" {...props} />,
                h4: ({node, ...props}) => <h4 className="font-medium mt-3 mb-1" {...props} />,
                p: ({node, ...props}) => <p className="text-muted-foreground mb-2" {...props} />,
                ul: ({node, ...props}) => <ul className="list-disc list-inside space-y-1 mb-2" {...props} />,
                ol: ({node, ...props}) => <ol className="list-decimal list-inside space-y-1 mb-2" {...props} />,
                li: ({node, ...props}) => <li className="text-muted-foreground" {...props} />,
                table: ({node, ...props}) => (
                  <div className="overflow-x-auto my-4">
                    <table className="min-w-full border border-border" {...props} />
                  </div>
                ),
                thead: ({node, ...props}) => <thead className="bg-muted" {...props} />,
                tr: ({node, ...props}) => <tr className="border-b border-border" {...props} />,
                th: ({node, ...props}) => <th className="px-4 py-2 text-left font-semibold" {...props} />,
                td: ({node, ...props}) => <td className="px-4 py-2" {...props} />,
                strong: ({node, ...props}) => <strong className="font-semibold" {...props} />,
                blockquote: ({node, ...props}) => <blockquote className="border-l-2 border-primary pl-4 italic my-2" {...props} />,
              }}
            >
              {section.content}
            </ReactMarkdown>
          </CardContent>
        </Card>
      ))}

      {/* Final Recommendation */}
      {parsed.recommendation && parsed.recommendation.decision && (
        <Card className="border-2 border-primary">
          <CardHeader>
            <CardTitle className="text-xl">
              Recommandation finale
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-4">
              <Badge variant={getDecisionColor(parsed.recommendation.decision)} className="text-lg px-4 py-1">
                {getDecisionLabel(parsed.recommendation.decision)}
              </Badge>
              {parsed.recommendation.ticket && (
                <span className="text-muted-foreground">
                  Ticket recommandé: {parsed.recommendation.ticket}
                </span>
              )}
            </div>

            {parsed.recommendation.rationale && (
              <p className="text-muted-foreground">{parsed.recommendation.rationale}</p>
            )}

            {parsed.recommendation.conditions && parsed.recommendation.conditions.length > 0 && (
              <div>
                <p className="font-semibold mb-2">Conditions DD</p>
                <ul className="list-disc list-inside space-y-1">
                  {parsed.recommendation.conditions.map((condition, idx) => (
                    <li key={idx} className="text-muted-foreground">{condition}</li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
