/**
 * 📧 EmailConsentModal
 * Modal de consentement affiché après connexion email Unipile
 * L'utilisateur doit accepter avant que la sync démarre
 */

import { useState } from 'react';
import { Loader2, Mail, Shield, CheckCircle } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface EmailConsentModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  account: {
    id: string;
    provider_account_id: string;
    email: string | null;
    provider: string;
  } | null;
  onSuccess: () => void;
  onCancel: () => void;
}

export function EmailConsentModal({
  open,
  onOpenChange,
  account,
  onSuccess,
  onCancel,
}: EmailConsentModalProps) {
  const [accepted, setAccepted] = useState(false);
  const [confirming, setConfirming] = useState(false);

  const handleConfirm = async () => {
    if (!account || !accepted) return;

    setConfirming(true);
    try {
      // Appeler l'edge function pour démarrer la sync
      const { data, error } = await supabase.functions.invoke('start-email-sync', {
        body: { account_id: account.provider_account_id },
      });

      if (error) throw error;

      toast.success('Synchronisation démarrée', {
        description: 'Vos emails sont en cours de synchronisation. Cela peut prendre quelques minutes.',
      });

      setAccepted(false);
      onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      console.error('Error starting sync:', error);
      toast.error('Erreur lors du démarrage de la synchronisation', {
        description: error.message || 'Veuillez réessayer.',
      });
    } finally {
      setConfirming(false);
    }
  };

  const handleCancel = async () => {
    // Optionnel: passer le compte en disconnected si l'utilisateur annule
    if (account) {
      try {
        await supabase
          .from('connected_accounts')
          .update({ status: 'disconnected', disconnected_at: new Date().toISOString() })
          .eq('id', account.id);
      } catch (e) {
        console.error('Error disconnecting account:', e);
      }
    }
    setAccepted(false);
    onCancel();
    onOpenChange(false);
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <div className="flex items-center justify-center mb-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
              <Mail className="h-6 w-6 text-primary" />
            </div>
          </div>

          <AlertDialogTitle className="text-center">
            Confirmer l'accès à vos emails
          </AlertDialogTitle>
          <AlertDialogDescription className="text-center">
            {account?.email && (
              <span className="block font-medium text-foreground mt-1">
                {account.email}
              </span>
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="space-y-4 py-4">
          <div className="rounded-lg border bg-muted/50 p-4">
            <div className="flex items-start gap-3">
              <Shield className="h-5 w-5 text-primary mt-0.5 shrink-0" />
              <div>
                <p className="font-medium text-sm">Données protégées</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Seules les métadonnées des emails liés à vos portfolio companies seront stockées. 
                  Le contenu des emails n'est jamais enregistré.
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-start space-x-3">
            <Checkbox
              id="consent"
              checked={accepted}
              onCheckedChange={(checked) => setAccepted(checked === true)}
            />
            <Label htmlFor="consent" className="text-sm leading-relaxed cursor-pointer">
              Je confirme donner accès aux emails de ma messagerie et j'accepte les{' '}
              <a
                href="/terms"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary underline hover:no-underline"
              >
                conditions générales d'utilisation
              </a>{' '}
              d'Albo.app
            </Label>
          </div>
        </div>

        <AlertDialogFooter className="flex-col sm:flex-row gap-2">
          <AlertDialogCancel onClick={handleCancel} className="w-full sm:w-auto">
            Annuler
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={handleConfirm}
            disabled={!accepted || confirming}
            className="w-full sm:w-auto"
          >
            {confirming ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Démarrage...
              </>
            ) : (
              <>
                <CheckCircle className="mr-2 h-4 w-4" />
                Confirmer et synchroniser
              </>
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
