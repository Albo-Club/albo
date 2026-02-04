import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { Button } from "@/components/ui/button";
import { Plus, BarChart3, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { MemoModal } from "@/components/MemoModal";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { displayCompanyName } from "@/lib/utils";
import { DataTable } from "@/components/deals/data-table";
import { columns, Deal } from "@/components/deals/columns";
import { DealSidePanel } from "@/components/deals/DealSidePanel";

import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { UserProfileModal } from "@/components/UserProfileModal";

export default function Dashboard() {
  const [selectedMemo, setSelectedMemo] = useState<{ html: string; companyName: string; deal: Deal } | null>(null);
  const [downloadingDeck, setDownloadingDeck] = useState<string | null>(null);
  const [dealToDelete, setDealToDelete] = useState<Deal | null>(null);
  const [deletingDeal, setDeletingDeal] = useState(false);
  const [selectedDeal, setSelectedDeal] = useState<Deal | null>(null);
  const [profileToView, setProfileToView] = useState<{
    userId: string | null;
    name?: string | null;
    email?: string | null;
  } | null>(null);

  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { workspace, isPersonalMode } = useWorkspace();

  const fetchDeals = async (): Promise<Deal[]> => {
    if (!user?.id || !user?.email) return [];

    let dealsData: any[] = [];

    if (isPersonalMode) {
      // Personal mode: only deals created by the current user
      const { data, error } = await supabase
        .from("deals")
        .select(`
          *,
          owner:profiles!deals_user_id_fkey(id, name, email, avatar_url)
        `)
        .eq("user_id", user.id)
        .neq("is_hidden", true)
        .order("created_at", { ascending: false });

      if (error) throw error;
      dealsData = data || [];
    } else if (workspace?.id) {
      // Utilise la fonction RPC pour récupérer les deals du workspace
      // Elle retourne maintenant toutes les données y compris owner info
      const { data, error } = await supabase
        .rpc('get_workspace_deals', { p_workspace_id: workspace.id });

      if (error) throw error;

      // La fonction RPC retourne toutes les données directement
      dealsData = (data || []).map((deal: any) => ({
        ...deal,
        owner: {
          id: deal.owner_id,
          name: deal.owner_name,
          email: deal.owner_email,
          avatar_url: deal.owner_avatar_url
        }
      }));
    } else {
      // Fallback: deals de l'utilisateur sans workspace
      const { data, error } = await supabase
        .from("deals")
        .select(`
          *,
          owner:profiles!deals_user_id_fkey(id, name, email, avatar_url)
        `)
        .or(`user_id.eq.${user.id},sender_email.ilike.${user.email}`)
        .neq("is_hidden", true)
        .order("created_at", { ascending: false });

      if (error) throw error;
      dealsData = data || [];
    }

    // Ajouter le statut du deck et le nom du propriétaire
    const dealsWithDeckStatus = await Promise.all(
      dealsData.map(async (deal: any) => {
        let { data: deckFile } = await supabase
          .from("deck_files")
          .select("id, storage_path, base64_content")
          .eq("deal_id", deal.id)
          .limit(1)
          .maybeSingle();

        if (!deckFile && deal.sender_email) {
          const { data } = await supabase
            .from("deck_files")
            .select("id, storage_path, base64_content")
            .eq("sender_email", deal.sender_email)
            .limit(1)
            .maybeSingle();
          deckFile = data;
        }

        const hasDeck = !!(deckFile && (deckFile.storage_path || deckFile.base64_content));
        return {
          ...deal,
          hasDeck,
          ownerName: deal.owner?.name || deal.owner?.email || "Inconnu"
        } as Deal;
      })
    );

    return dealsWithDeckStatus;
  };

  const {
    data: deals = [],
    isLoading: loading,
  } = useQuery({
    queryKey: ["deals", workspace?.id, isPersonalMode],
    enabled: !!user?.id && !!user?.email,
    queryFn: fetchDeals,
    retry: 1,
    meta: { errorMessage: "Échec du chargement des deals" },
  });

  // Realtime refresh
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel("deals-updates")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "deals",
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["deals"] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, queryClient]);

  // Event listeners for row actions
  useEffect(() => {
    const handleViewMemo = (e: CustomEvent) => {
      const deal = e.detail.deal as Deal;
      setSelectedMemo({
        html: e.detail.html,
        companyName: displayCompanyName(e.detail.companyName) || "Sans nom",
        deal,
      });
    };

    const handleDownloadDeck = async (e: CustomEvent) => {
      const deal = e.detail.deal as Deal;
      await downloadDeck(deal);
    };

    const handleDeleteDeal = (e: CustomEvent) => {
      setDealToDelete(e.detail.deal);
    };

    const handleOpenDealPanel = (e: CustomEvent) => {
      setSelectedDeal(e.detail.deal);
    };

    const handleViewProfile = (e: CustomEvent) => {
      setProfileToView({
        userId: e.detail.userId,
        name: e.detail.name,
        email: e.detail.email,
      });
    };

    window.addEventListener("view-memo", handleViewMemo as EventListener);
    window.addEventListener("download-deck", handleDownloadDeck as EventListener);
    window.addEventListener("delete-deal", handleDeleteDeal as EventListener);
    window.addEventListener("open-deal-panel", handleOpenDealPanel as EventListener);
    window.addEventListener("view-profile", handleViewProfile as EventListener);

    return () => {
      window.removeEventListener("view-memo", handleViewMemo as EventListener);
      window.removeEventListener("download-deck", handleDownloadDeck as EventListener);
      window.removeEventListener("delete-deal", handleDeleteDeal as EventListener);
      window.removeEventListener("open-deal-panel", handleOpenDealPanel as EventListener);
      window.removeEventListener("view-profile", handleViewProfile as EventListener);
    };
  }, []);

  const handleInvalidateDeals = async () => {
    await queryClient.invalidateQueries({ queryKey: ["deals"] });
  };

  const downloadDeck = async (deal: Deal) => {
    setDownloadingDeck(deal.id);

    try {
      let { data: deckFile } = await supabase
        .from("deck_files")
        .select("file_name, storage_path, base64_content, mime_type")
        .eq("deal_id", deal.id)
        .maybeSingle();

      if (!deckFile && deal.sender_email) {
        const { data } = await supabase
          .from("deck_files")
          .select("file_name, storage_path, base64_content, mime_type")
          .eq("sender_email", deal.sender_email)
          .order("uploaded_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        deckFile = data;
      }

      if (!deckFile) {
        toast.error("Aucun deck trouvé pour ce deal");
        return;
      }

      if (deckFile.storage_path) {
        const { data: signedUrlData, error: signedUrlError } = await supabase.storage
          .from("deck-files")
          .createSignedUrl(deckFile.storage_path, 60 * 60);

        if (signedUrlError) throw signedUrlError;

        if (signedUrlData?.signedUrl) {
          window.open(signedUrlData.signedUrl, "_blank", "noopener");
          toast.success("Deck ouvert dans un nouvel onglet");
        }
      } else if (deckFile.base64_content) {
        const byteCharacters = atob(deckFile.base64_content);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        const blob = new Blob([byteArray], { type: deckFile.mime_type || "application/pdf" });

        const url = window.URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = deckFile.file_name || "pitch-deck.pdf";
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
        toast.success("Deck téléchargé !");
      } else {
        toast.error("Contenu du deck non disponible");
      }
    } catch (error: any) {
      console.error("Error downloading deck:", error);
      toast.error("Erreur lors du téléchargement");
    } finally {
      setDownloadingDeck(null);
    }
  };

  const handleHideDeal = async () => {
    if (!dealToDelete) return;

    setDeletingDeal(true);

    try {
      const { error } = await supabase.from("deals").update({ is_hidden: true }).eq("id", dealToDelete.id);

      if (error) throw error;

      toast.success("Deal archivé");
      setDealToDelete(null);
      await handleInvalidateDeals();
    } catch (error: any) {
      console.error("Error hiding deal:", error);
      toast.error(error.message || "Erreur lors de l'archivage");
    } finally {
      setDeletingDeal(false);
    }
  };

  const handleViewMemo = (html: string, companyName: string) => {
    // Find the deal from our list
    const deal = deals.find(d => d.company_name === companyName) || null;
    setSelectedMemo({
      html,
      companyName: displayCompanyName(companyName) || "Sans nom",
      deal: deal as Deal,
    });
  };

  const handleDownloadDeckFromMemo = async () => {
    if (selectedMemo?.deal) {
      await downloadDeck(selectedMemo.deal);
    }
  };

  const handleDownloadDeckFromPanel = async (deal: Deal) => {
    await downloadDeck(deal);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full w-full">
      <div className="shrink-0 flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold">Deals</h1>
          <p className="text-muted-foreground">
            {deals.length > 0 ? `${deals.length} deal${deals.length > 1 ? "s" : ""}` : "Suivez et analysez vos opportunités d'investissement"}
          </p>
        </div>
        <Button onClick={() => navigate("/submit")}
        >
          <Plus className="mr-2 h-4 w-4" />
          Soumettre un Deal
        </Button>
      </div>

      {deals.length === 0 ? (
        <Card className="shrink-0 text-center py-12 mt-6">
          <CardContent>
            <BarChart3 className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">Aucun deal</h3>
            <p className="text-muted-foreground mb-4">Commencez par soumettre votre premier pitch deck pour analyse</p>
            <Button onClick={() => navigate("/submit")}
            >
              <Plus className="mr-2 h-4 w-4" />
              Soumettre un Deal
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="flex-1 min-h-0 mt-6">
          <DataTable columns={columns} data={deals} />
        </div>
      )}

      <DealSidePanel
        deal={selectedDeal}
        open={!!selectedDeal}
        onOpenChange={(open) => !open && setSelectedDeal(null)}
        onDealUpdated={handleInvalidateDeals}
        onViewMemo={handleViewMemo}
        onDownloadDeck={handleDownloadDeckFromPanel}
      />

      <MemoModal
        open={!!selectedMemo}
        onOpenChange={() => setSelectedMemo(null)}
        memoHtml={selectedMemo?.html || ""}
        companyName={selectedMemo?.companyName || ""}
        hasDeck={selectedMemo?.deal?.hasDeck}
        onDownloadDeck={handleDownloadDeckFromMemo}
      />

      <AlertDialog open={!!dealToDelete} onOpenChange={() => setDealToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer ce deal ?</AlertDialogTitle>
            <AlertDialogDescription>
              Le deal "{displayCompanyName(dealToDelete?.company_name) || "Sans nom"}" sera archivé et n'apparaîtra plus dans votre liste.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleHideDeal}
              disabled={deletingDeal}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deletingDeal ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <UserProfileModal
        isOpen={!!profileToView}
        onClose={() => setProfileToView(null)}
        userId={profileToView?.userId || null}
        initialName={profileToView?.name}
        initialEmail={profileToView?.email}
      />
    </div>
  );
}
