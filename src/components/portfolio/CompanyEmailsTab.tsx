import { useState } from 'react';
import { Mail, Loader2, RefreshCw, Inbox } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useCompanyEmails } from '@/hooks/useCompanyEmails';
import { useCompanyEmailsRealtime } from '@/hooks/useCompanyEmailsRealtime';
import { EmailListItem } from '@/components/inbox/EmailListItem';
import { CompanyEmailReadingView } from './CompanyEmailReadingView';
import type { UnipileEmail } from '@/hooks/useInboxEmails';

interface CompanyEmailsTabProps {
  companyId: string;
  companyName: string;
  domain?: string | null;
}

export function CompanyEmailsTab({ companyId, companyName, domain }: CompanyEmailsTabProps) {
  const [selectedEmail, setSelectedEmail] = useState<UnipileEmail | null>(null);
  const { data: emails = [], isLoading, error, refetch, isFetching } = useCompanyEmails(companyId);

  // Enable realtime updates for this company
  useCompanyEmailsRealtime(companyId);

  // If no domain configured
  if (!domain) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center border rounded-lg bg-background">
        <Mail className="h-12 w-12 text-muted-foreground/50 mb-4" />
        <p className="text-lg font-medium text-foreground">Aucun domaine configuré</p>
        <p className="text-sm text-muted-foreground mt-2 max-w-md">
          Pour afficher les emails liés à {companyName}, veuillez d'abord configurer le domaine de l'entreprise.
        </p>
      </div>
    );
  }

  if (selectedEmail) {
    return (
      <div className="border rounded-lg overflow-hidden bg-background min-h-[500px]">
        <CompanyEmailReadingView 
          email={selectedEmail} 
          onBack={() => setSelectedEmail(null)}
        />
      </div>
    );
  }

  return (
    <div className="border rounded-lg overflow-hidden bg-background">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b">
        <div className="flex items-center gap-3">
          <Mail className="h-5 w-5 text-muted-foreground" />
          <h3 className="font-medium">Emails</h3>
          <span className="text-sm text-muted-foreground">
            {emails.length} email{emails.length !== 1 ? 's' : ''} avec @{domain}
          </span>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={() => refetch()}
          disabled={isFetching}
        >
          <RefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
        </Button>
      </div>

      {/* Content */}
      <ScrollArea className="h-[500px]">
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <p className="text-sm text-muted-foreground">Erreur lors du chargement</p>
            <Button variant="outline" size="sm" className="mt-3" onClick={() => refetch()}>
              Réessayer
            </Button>
          </div>
        ) : emails.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center px-4">
            <Inbox className="h-10 w-10 text-muted-foreground/50 mb-3" />
            <p className="text-sm font-medium text-foreground">Aucun email trouvé</p>
            <p className="text-xs text-muted-foreground mt-1 max-w-xs">
              Les emails avec @{domain} apparaîtront ici automatiquement
            </p>
          </div>
        ) : (
          <div className="divide-y">
            {emails.map((email) => (
              <EmailListItem
                key={email.id}
                email={email}
                isSelected={false}
                onClick={() => setSelectedEmail(email)}
              />
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
