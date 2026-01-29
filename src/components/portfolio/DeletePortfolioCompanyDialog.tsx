import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
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
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';

interface DeletePortfolioCompanyDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  company: {
    id: string;
    company_name: string;
  };
}

export function DeletePortfolioCompanyDialog({
  open,
  onOpenChange,
  company,
}: DeletePortfolioCompanyDialogProps) {
  const [isDeleting, setIsDeleting] = useState(false);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      const { error } = await supabase
        .from('portfolio_companies')
        .delete()
        .eq('id', company.id);

      if (error) throw error;

      toast.success(`${company.company_name} supprimée du portfolio`);
      queryClient.invalidateQueries({ queryKey: ['portfolio-companies'] });
      onOpenChange(false);
      navigate('/portfolio');
    } catch (error: any) {
      toast.error(error.message || 'Erreur lors de la suppression');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Supprimer {company.company_name} ?</AlertDialogTitle>
          <AlertDialogDescription>
            Cette action est irréversible. L'entreprise sera définitivement supprimée 
            du portfolio ainsi que tous les rapports et documents associés.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isDeleting}>Annuler</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDelete}
            disabled={isDeleting}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {isDeleting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Suppression...
              </>
            ) : (
              'Supprimer'
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
