import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, Share2, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { toast } from "sonner";

interface ShareDealsDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ShareDealsDialog({ isOpen, onClose }: ShareDealsDialogProps) {
  const { user } = useAuth();
  const { allWorkspaces, workspace: currentWorkspace } = useWorkspace();
  const [selectedWorkspaces, setSelectedWorkspaces] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<{ total: number; shared: number } | null>(null);

  // Workspaces disponibles (exclure le workspace actuel)
  const availableWorkspaces = allWorkspaces.filter(
    (ws) => ws.id !== currentWorkspace?.id
  );

  const toggleWorkspace = (workspaceId: string) => {
    setSelectedWorkspaces((prev) =>
      prev.includes(workspaceId)
        ? prev.filter((id) => id !== workspaceId)
        : [...prev, workspaceId]
    );
  };

  const handleShare = async () => {
    if (!user?.id || selectedWorkspaces.length === 0) return;

    setLoading(true);
    setResults(null);

    try {
      // 1. Récupérer tous les deals de l'utilisateur
      const { data: userDeals, error: dealsError } = await supabase
        .from("deals")
        .select("id")
        .eq("user_id", user.id)
        .neq("is_hidden", true);

      if (dealsError) throw dealsError;

      if (!userDeals || userDeals.length === 0) {
        toast.info("Vous n'avez aucun deal à partager");
        setLoading(false);
        return;
      }

      const dealIds = userDeals.map((d) => d.id);
      let totalShared = 0;

      // 2. Partager vers chaque workspace sélectionné
      for (const workspaceId of selectedWorkspaces) {
        const { data, error } = await supabase.rpc("share_deals_to_workspace", {
          _deal_ids: dealIds,
          _target_workspace_id: workspaceId,
          _user_id: user.id,
        });

        if (error) {
          console.error("Error sharing to workspace:", workspaceId, error);
          continue;
        }

        // Compter les succès
        const successes = (data || []).filter((r: any) => r.success).length;
        totalShared += successes;
      }

      setResults({ total: dealIds.length * selectedWorkspaces.length, shared: totalShared });

      if (totalShared > 0) {
        toast.success(`${totalShared} deal(s) partagé(s) avec succès !`);
      } else {
        toast.info("Tous les deals sont déjà partagés dans ces workspaces");
      }
    } catch (error: any) {
      console.error("Error sharing deals:", error);
      toast.error(error.message || "Erreur lors du partage");
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setSelectedWorkspaces([]);
    setResults(null);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Share2 className="h-5 w-5" />
            Partager mes deals
          </DialogTitle>
          <DialogDescription>
            Sélectionnez les workspaces vers lesquels partager vos deals.
            Les deals partagés seront visibles par tous les membres.
          </DialogDescription>
        </DialogHeader>

        {availableWorkspaces.length === 0 ? (
          <div className="py-6 text-center">
            <p className="text-sm text-muted-foreground">
              Vous n'avez pas d'autres workspaces. Créez-en un ou rejoignez une équipe.
            </p>
          </div>
        ) : (
          <ScrollArea className="max-h-[300px] pr-4">
            <div className="space-y-3">
              {availableWorkspaces.map((ws) => (
                <div
                  key={ws.id}
                  className="flex items-center space-x-3 p-3 rounded-lg border hover:bg-accent/50 cursor-pointer transition-colors"
                  onClick={() => toggleWorkspace(ws.id)}
                >
                  <Checkbox
                    id={ws.id}
                    checked={selectedWorkspaces.includes(ws.id)}
                    onCheckedChange={() => toggleWorkspace(ws.id)}
                  />
                  <div className="flex-1 min-w-0">
                    <Label htmlFor={ws.id} className="font-medium cursor-pointer">
                      {ws.name}
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      Rôle : {ws.userRole}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}

        {results && (
          <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
            <Check className="h-4 w-4 text-green-500" />
            <span className="text-sm">
              {results.shared} deal(s) partagé(s) sur {results.total} tentative(s)
            </span>
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={handleClose}>
            Fermer
          </Button>
          <Button
            onClick={handleShare}
            disabled={loading || selectedWorkspaces.length === 0 || availableWorkspaces.length === 0}
          >
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Partager
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
