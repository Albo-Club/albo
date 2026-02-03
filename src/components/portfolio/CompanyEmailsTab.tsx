import { useState } from 'react';
import { Mail, RefreshCw, Search, Loader2, AlertCircle, Inbox } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useCompanyEmails, CompanyEmail } from '@/hooks/useCompanyEmails';
import { useCompanyEmailsRealtime } from '@/hooks/useCompanyEmailsRealtime';
import { EmailListItem } from '@/components/inbox/EmailListItem';
import { EmailReadingView } from '@/components/inbox/EmailReadingView';
import type { UnipileEmail } from '@/hooks/useInboxEmails';

interface CompanyEmailsTabProps {
  companyId: string;
  companyName: string;
  domain: string | null;
}

export function CompanyEmailsTab({ companyId, companyName, domain }: CompanyEmailsTabProps) {
  const [selectedEmail, setSelectedEmail] = useState<UnipileEmail | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const { emails, total, isLoading, error, refetch, isFetching } = useCompanyEmails({
    companyId,
    limit: 100,
  });

  // Activer le realtime pour cette company
  useCompanyEmailsRealtime(companyId);

  // Filtrer les emails par recherche
  const filteredEmails = searchQuery.trim()
    ? emails.filter((email) => {
        const query = searchQuery.toLowerCase();
        return (
          email.subject?.toLowerCase().includes(query) ||
          email.from?.display_name?.toLowerCase().includes(query) ||
          email.from?.identifier?.toLowerCase().includes(query)
        );
      })
    : emails;

  // Convertir CompanyEmail en UnipileEmail pour réutiliser les composants existants
  const convertToUnipileEmail = (email: CompanyEmail): UnipileEmail => ({
    id: email.id,
    subject: email.subject || '',
    from: {
      display_name: email.from?.display_name || email.from?.identifier || '',
      identifier: email.from?.identifier || '',
    },
    to: (email.to || []).map(t => ({
      display_name: t.display_name || t.identifier || '',
      identifier: t.identifier || '',
    })),
    cc: (email.cc || []).map(c => ({
      display_name: c.display_name || c.identifier || '',
      identifier: c.identifier || '',
    })),
    date: email.date || '',
    read: email.read ?? true,
    read_date: null,
    has_attachments: email.has_attachments || false,
    folders: email.folders || [],
    role: null,
    body: email.body || '',
    body_plain: email.body_plain || '',
    snippet: email.snippet || '',
    account_id: email.account_id || '',
    account_display_name: '',
    provider: '',
    in_reply_to: null,
    message_id: null,
  });

  const handleEmailClick = (email: CompanyEmail) => {
    setSelectedEmail(convertToUnipileEmail(email));
  };

  const handleBackToList = () => {
    setSelectedEmail(null);
  };

  // Si pas de domaine configuré
  if (!domain) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <Mail className="h-12 w-12 text-muted-foreground/50 mb-4" />
        <p className="text-lg font-medium text-foreground">Aucun domaine configuré</p>
        <p className="text-sm text-muted-foreground mt-2 max-w-md">
          Pour afficher les emails liés à {companyName}, veuillez d'abord configurer le domaine de l'entreprise dans les informations de la company.
        </p>
      </div>
    );
  }

  // Erreur de chargement
  if (error) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          Erreur lors du chargement des emails : {error.message}
        </AlertDescription>
      </Alert>
    );
  }

  // Vue de lecture d'un email
  if (selectedEmail) {
    const originalEmail = emails.find(e => e.id === selectedEmail.id);
    return (
      <div className="border rounded-lg overflow-hidden bg-background min-h-[500px]">
        <EmailReadingView 
          email={selectedEmail} 
          onBack={handleBackToList} 
          accountId={originalEmail?.account_id}
        />
      </div>
    );
  }

  return (
    <div className="border rounded-lg overflow-hidden bg-background">
      <div className="p-4 space-y-4">
        {/* Header avec recherche et refresh */}
        <div className="flex items-center gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Rechercher..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 h-9"
            />
          </div>
          
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9"
            onClick={() => refetch()}
            disabled={isFetching}
          >
            <RefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
          </Button>
          
          <span className="text-sm text-muted-foreground">
            {total} email{total > 1 ? 's' : ''} avec @{domain}
          </span>
        </div>

        {/* Liste des emails */}
        <ScrollArea className="h-[500px]">
          {isLoading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : filteredEmails.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <Inbox className="h-10 w-10 text-muted-foreground/50 mb-3" />
              <p className="text-sm font-medium text-foreground">
                {searchQuery ? 'Aucun résultat' : 'Aucun email trouvé'}
              </p>
              <p className="text-xs text-muted-foreground mt-1 max-w-xs">
                {searchQuery 
                  ? `Aucun email ne correspond à "${searchQuery}"`
                  : `Aucun email échangé avec des adresses @${domain} n'a été trouvé. Les nouveaux emails seront automatiquement ajoutés.`
                }
              </p>
            </div>
          ) : (
            <div className="divide-y">
              {filteredEmails.map((email) => (
                <EmailListItem
                  key={email.id}
                  email={convertToUnipileEmail(email)}
                  isSelected={false}
                  onClick={() => handleEmailClick(email)}
                />
              ))}
            </div>
          )}
        </ScrollArea>
      </div>
    </div>
  );
}
