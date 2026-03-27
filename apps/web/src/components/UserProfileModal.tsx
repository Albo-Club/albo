import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Mail, Phone, Linkedin, Globe, Target, Wallet, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface UserProfile {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  country: string | null;
  linkedin_url: string | null;
  investment_focus: string[] | null;
  check_size_min: number | null;
  check_size_max: number | null;
}

interface UserProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string | null;
  initialName?: string | null;
  initialEmail?: string | null;
}

export function UserProfileModal({ 
  isOpen, 
  onClose, 
  userId,
  initialName,
  initialEmail 
}: UserProfileModalProps) {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen && userId) {
      loadProfile();
    }
  }, [isOpen, userId]);

  const loadProfile = async () => {
    if (!userId) return;
    
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .single();

      if (error) throw error;
      setProfile(data);
    } catch (error) {
      console.error("Error loading profile:", error);
      // Utiliser les données initiales si disponibles
      setProfile({
        id: userId,
        name: initialName || null,
        email: initialEmail || null,
        phone: null,
        country: null,
        linkedin_url: null,
        investment_focus: null,
        check_size_min: null,
        check_size_max: null,
      });
    } finally {
      setLoading(false);
    }
  };

  const getInitials = (name: string | null) => {
    if (!name) return "?";
    return name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);
  };

  const formatCheckSize = (min: number | null, max: number | null) => {
    if (!min && !max) return null;
    const formatNum = (n: number) => {
      if (n >= 1000000) return `${n / 1000000}M€`;
      if (n >= 1000) return `${n / 1000}k€`;
      return `${n}€`;
    };
    if (min && max) return `${formatNum(min)} - ${formatNum(max)}`;
    if (min) return `À partir de ${formatNum(min)}`;
    if (max) return `Jusqu'à ${formatNum(max)}`;
    return null;
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Profil du membre</DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : profile ? (
          <div className="space-y-6">
            {/* Header avec Avatar */}
            <div className="flex items-center gap-4">
              <Avatar className="h-16 w-16">
                <AvatarFallback className="text-lg bg-primary/10 text-primary">
                  {getInitials(profile.name)}
                </AvatarFallback>
              </Avatar>
              <div>
                <h3 className="text-lg font-semibold">
                  {profile.name || "Utilisateur"}
                </h3>
                {profile.country && (
                  <div className="flex items-center gap-1 text-sm text-muted-foreground">
                    <Globe className="h-3 w-3" />
                    {profile.country}
                  </div>
                )}
              </div>
            </div>

            {/* Informations de contact */}
            <div className="space-y-3">
              {profile.email && (
                <div className="flex items-center gap-3 text-sm">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  {profile.email}
                </div>
              )}
              
              {profile.phone && (
                <div className="flex items-center gap-3 text-sm">
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  {profile.phone}
                </div>
              )}
              
              {profile.linkedin_url && (
                <a
                  href={profile.linkedin_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 text-sm text-primary hover:underline"
                >
                  <Linkedin className="h-4 w-4" />
                  Profil LinkedIn
                </a>
              )}
            </div>

            {/* Focus d'investissement */}
            {profile.investment_focus && profile.investment_focus.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                  <Target className="h-4 w-4" />
                  Focus d'investissement
                </div>
                <div className="flex flex-wrap gap-2">
                  {profile.investment_focus.map((focus, i) => (
                    <Badge key={i} variant="secondary">
                      {focus}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Ticket */}
            {(profile.check_size_min || profile.check_size_max) && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                  <Wallet className="h-4 w-4" />
                  Ticket d'investissement
                </div>
                <p className="text-sm">
                  {formatCheckSize(profile.check_size_min, profile.check_size_max)}
                </p>
              </div>
            )}
          </div>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            Profil non disponible
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
