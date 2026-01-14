import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, TrendingUp, Clock, CheckCircle2, Calendar, Wallet } from "lucide-react";
import { formatAmount, displayCompanyName } from "@/lib/utils";
import { format, formatDistanceToNow, startOfMonth } from "date-fns";
import { fr } from "date-fns/locale";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
} from "recharts";

interface DealStats {
  total: number;
  enCours: number;
  valides: number;
  montantTotal: number;
  ceMois: number;
}

interface RecentActivity {
  id: string;
  company_name: string | null;
  type: "new" | "status_change";
  status?: string;
  created_at: string;
}

interface ChartData {
  name: string;
  deals: number;
}

interface SectorData {
  name: string;
  value: number;
  color: string;
}

interface StageData {
  name: string;
  count: number;
}

const COLORS = ["#10B981", "#3B82F6", "#8B5CF6", "#F59E0B", "#EF4444", "#EC4899", "#14B8A6", "#6366F1"];

export default function Portfolio() {
  const { user } = useAuth();

  const fetchPortfolioData = async () => {
    if (!user?.id || !user?.email) return null;

    const { data: deals, error } = await supabase
      .from("deals")
      .select("*")
      .or(`user_id.eq.${user.id},sender_email.ilike.${user.email}`)
      .neq("is_hidden", true)
      .order("created_at", { ascending: false });

    if (error) throw error;

    const startOfCurrentMonth = startOfMonth(new Date()).toISOString();

    // Calculate stats
    const stats: DealStats = {
      total: deals?.length || 0,
      enCours: deals?.filter((d) => d.status === "analyzing").length || 0,
      valides: deals?.filter((d) => d.status === "completed").length || 0,
      montantTotal: deals
        ?.filter((d) => d.status === "completed" && d.amount_sought)
        .reduce((sum, d) => {
          const amount = parseInt(d.amount_sought?.replace(/[^\d]/g, "") || "0");
          return sum + amount;
        }, 0) || 0,
      ceMois: deals?.filter((d) => d.created_at >= startOfCurrentMonth).length || 0,
    };

    // Recent activities (last 10)
    const activities: RecentActivity[] = (deals || []).slice(0, 10).map((d) => ({
      id: d.id,
      company_name: d.company_name,
      type: "new" as const,
      status: d.status,
      created_at: d.created_at,
    }));

    // Quarterly data (last 4 quarters)
    const quarterlyData: ChartData[] = [];
    const now = new Date();
    for (let i = 3; i >= 0; i--) {
      const quarterStart = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3 - i * 3, 1);
      const quarterEnd = new Date(quarterStart.getFullYear(), quarterStart.getMonth() + 3, 0);
      const quarterLabel = `Q${Math.floor(quarterStart.getMonth() / 3) + 1} ${quarterStart.getFullYear()}`;
      const count = deals?.filter((d) => {
        const date = new Date(d.created_at);
        return date >= quarterStart && date <= quarterEnd;
      }).length || 0;
      quarterlyData.push({ name: quarterLabel, deals: count });
    }

    // Sector distribution
    const sectorCounts: Record<string, number> = {};
    deals?.forEach((d) => {
      const sector = d.sector || "Non défini";
      sectorCounts[sector] = (sectorCounts[sector] || 0) + 1;
    });
    const sectorData: SectorData[] = Object.entries(sectorCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([name, value], index) => ({
        name,
        value,
        color: COLORS[index % COLORS.length],
      }));

    // Stage distribution
    const stageCounts: Record<string, number> = {};
    deals?.forEach((d) => {
      const stage = d.stage || "Non défini";
      stageCounts[stage] = (stageCounts[stage] || 0) + 1;
    });
    const stageData: StageData[] = Object.entries(stageCounts)
      .sort((a, b) => b[1] - a[1])
      .map(([name, count]) => ({ name, count }));

    return { stats, activities, quarterlyData, sectorData, stageData };
  };

  const { data, isLoading } = useQuery({
    queryKey: ["portfolio-stats"],
    enabled: !!user?.id && !!user?.email,
    queryFn: fetchPortfolioData,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const { stats, activities, quarterlyData, sectorData, stageData } = data || {
    stats: { total: 0, enCours: 0, valides: 0, montantTotal: 0, ceMois: 0 },
    activities: [],
    quarterlyData: [],
    sectorData: [],
    stageData: [],
  };

  const getInitials = (name: string | null) => {
    if (!name) return "?";
    return name.charAt(0).toUpperCase();
  };

  const getInitialColor = (name: string | null) => {
    if (!name) return "bg-gray-400";
    const colors = [
      "bg-emerald-500",
      "bg-blue-500",
      "bg-purple-500",
      "bg-amber-500",
      "bg-rose-500",
      "bg-teal-500",
    ];
    return colors[name.charCodeAt(0) % colors.length];
  };

  return (
    <div className="space-y-6 w-full bg-muted/30 min-h-screen -m-6 p-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">Portfolio</h1>
        <p className="text-muted-foreground">Vue d'ensemble de votre activité</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        <Card className="bg-white shadow-sm border">
          <CardContent className="p-4">
            <div className="text-3xl font-bold">{stats.total}</div>
            <p className="text-sm text-muted-foreground">Nombre de deals</p>
          </CardContent>
        </Card>
        <Card className="bg-white shadow-sm border">
          <CardContent className="p-4">
            <div className="text-3xl font-bold">{stats.enCours}</div>
            <p className="text-sm text-muted-foreground">Deals en cours</p>
          </CardContent>
        </Card>
        <Card className="bg-white shadow-sm border">
          <CardContent className="p-4">
            <div className="text-3xl font-bold text-emerald-600">{stats.valides}</div>
            <p className="text-sm text-muted-foreground">Deals validés</p>
          </CardContent>
        </Card>
        <Card className="bg-white shadow-sm border">
          <CardContent className="p-4">
            <div className="text-3xl font-bold">{formatAmount(stats.montantTotal.toString())}</div>
            <p className="text-sm text-muted-foreground">Montant total</p>
          </CardContent>
        </Card>
        <Card className="bg-white shadow-sm border">
          <CardContent className="p-4">
            <div className="text-3xl font-bold">{stats.ceMois}</div>
            <p className="text-sm text-muted-foreground">Deals ce mois</p>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Quarterly Overview */}
        <Card className="lg:col-span-2 bg-white shadow-sm border">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold">Quarterly overview</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={quarterlyData}>
                  <defs>
                    <linearGradient id="colorDeals" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10B981" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#10B981" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" vertical={false} />
                  <XAxis dataKey="name" tickLine={false} axisLine={false} fontSize={12} tick={{ fill: "#6B7280" }} />
                  <YAxis tickLine={false} axisLine={false} fontSize={12} tick={{ fill: "#6B7280" }} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "white",
                      border: "1px solid #E5E7EB",
                      borderRadius: "8px",
                      fontSize: "12px",
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="deals"
                    stroke="#10B981"
                    strokeWidth={2}
                    fill="url(#colorDeals)"
                    dot={{ fill: "#10B981", strokeWidth: 2, r: 4 }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Recent Activities */}
        <Card className="bg-white shadow-sm border">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold">Recent activities</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y max-h-[340px] overflow-y-auto">
              {activities.length === 0 ? (
                <div className="p-4 text-center text-muted-foreground text-sm">Aucune activité récente</div>
              ) : (
                activities.map((activity) => (
                  <div key={activity.id} className="flex items-center gap-3 p-3 hover:bg-muted/50">
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-semibold ${getInitialColor(
                        activity.company_name
                      )}`}
                    >
                      {getInitials(activity.company_name)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">
                        {displayCompanyName(activity.company_name) || "Deal"}
                      </p>
                      <p className="text-xs text-muted-foreground">Nouveau deal</p>
                    </div>
                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                      {formatDistanceToNow(new Date(activity.created_at), { addSuffix: true, locale: fr })}
                    </span>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Bottom Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Sector Distribution */}
        <Card className="bg-white shadow-sm border">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold">Répartition par secteur</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[280px]">
              {sectorData.length === 0 ? (
                <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
                  Aucune donnée
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={sectorData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={100}
                      paddingAngle={2}
                      dataKey="value"
                    >
                      {sectorData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "white",
                        border: "1px solid #E5E7EB",
                        borderRadius: "8px",
                        fontSize: "12px",
                      }}
                      formatter={(value: number, name: string) => [`${value} deals`, name]}
                    />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>
            {/* Legend */}
            <div className="flex flex-wrap gap-2 mt-2 justify-center">
              {sectorData.map((sector, index) => (
                <div key={index} className="flex items-center gap-1.5 text-xs">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: sector.color }} />
                  <span className="text-muted-foreground">{sector.name}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Stage Distribution */}
        <Card className="bg-white shadow-sm border">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold">Répartition par stade</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[280px]">
              {stageData.length === 0 ? (
                <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
                  Aucune donnée
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={stageData} layout="vertical" barCategoryGap={8}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" horizontal={true} vertical={false} />
                    <XAxis type="number" tickLine={false} axisLine={false} fontSize={12} tick={{ fill: "#6B7280" }} />
                    <YAxis
                      type="category"
                      dataKey="name"
                      tickLine={false}
                      axisLine={false}
                      fontSize={12}
                      tick={{ fill: "#6B7280" }}
                      width={80}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "white",
                        border: "1px solid #E5E7EB",
                        borderRadius: "8px",
                        fontSize: "12px",
                      }}
                      formatter={(value: number) => [`${value} deals`, "Nombre"]}
                    />
                    <Bar dataKey="count" fill="#10B981" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
