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
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

interface FeedbackModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function FeedbackModal({ open, onOpenChange }: FeedbackModalProps) {
  const { user } = useAuth();
  const [feedback, setFeedback] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!feedback.trim()) {
      toast.error("Veuillez entrer un commentaire");
      return;
    }

    setIsSubmitting(true);
    
    try {
      // TODO: Implement email sending via edge function
      // For now, just show success message
      console.log("Feedback from:", user?.email, user?.user_metadata?.name);
      console.log("Feedback:", feedback);
      
      toast.success("Merci pour votre feedback !");
      setFeedback("");
      onOpenChange(false);
    } catch (error) {
      console.error("Error sending feedback:", error);
      toast.error("Erreur lors de l'envoi du feedback");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Envoyer un feedback</DialogTitle>
          <DialogDescription>
            Partagez vos commentaires, suggestions ou signaler un problème. Votre avis nous aide à améliorer l'application.
          </DialogDescription>
        </DialogHeader>
        
        <div className="py-4">
          <Textarea
            placeholder="Décrivez votre feedback ici..."
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
            className="min-h-[150px] resize-none"
          />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting || !feedback.trim()}>
            {isSubmitting ? "Envoi..." : "Envoyer"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
