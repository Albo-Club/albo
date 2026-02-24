import { useState } from 'react';
import { Plus, X, Star, Loader2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useCompanyDomains } from '@/hooks/useCompanyDomains';

interface CompanyDomainsEditorProps {
  companyId: string;
  onDomainAdded?: (domain: string) => void;
  onDomainRemoved?: (domainId: string) => void;
  compact?: boolean;
}

export function CompanyDomainsEditor({
  companyId,
  onDomainAdded,
  onDomainRemoved,
  compact = false,
}: CompanyDomainsEditorProps) {
  const { domains, isLoading, addDomain, removeDomain, setPrimaryDomain, isAdding } =
    useCompanyDomains(companyId);
  const [newDomain, setNewDomain] = useState('');

  const handleAdd = async () => {
    const val = newDomain.trim();
    if (!val) return;
    try {
      await addDomain(val);
      setNewDomain('');
      onDomainAdded?.(val);
    } catch {
      // error handled by hook
    }
  };

  const handleRemove = async (domainId: string) => {
    try {
      await removeDomain(domainId);
      onDomainRemoved?.(domainId);
    } catch {
      // error handled by hook
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAdd();
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground text-sm">
        <Loader2 className="h-4 w-4 animate-spin" />
        Chargement...
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {/* Domain badges */}
      {domains.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {domains.map((d) => (
            <Badge
              key={d.id}
              variant="secondary"
              className={cn(
                'gap-1 pr-1 text-xs font-normal hover:bg-secondary/80 transition-colors',
                d.is_primary && 'ring-1 ring-amber-400/50'
              )}
            >
              {!compact && d.is_primary && (
                <Star className="h-3 w-3 text-amber-500 fill-amber-500" />
              )}
              {!compact && !d.is_primary && (
                <button
                  type="button"
                  onClick={() => setPrimaryDomain(d.id)}
                  className="hover:text-amber-500 transition-colors"
                  title="Définir comme domaine principal"
                >
                  <Star className="h-3 w-3" />
                </button>
              )}
              <span>{d.domain}</span>
              <button
                type="button"
                onClick={() => handleRemove(d.id)}
                className="ml-0.5 rounded-sm p-0.5 hover:bg-destructive/20 hover:text-destructive transition-colors"
                title="Supprimer ce domaine"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}

      {/* Add new domain */}
      <div className="flex gap-2">
        <Input
          value={newDomain}
          onChange={(e) => setNewDomain(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ajouter un domaine (ex: entreprise.com)"
          className="flex-1 h-8 text-sm"
          disabled={isAdding}
        />
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="h-8 w-8 shrink-0"
          onClick={handleAdd}
          disabled={isAdding || !newDomain.trim()}
        >
          {isAdding ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Plus className="h-3.5 w-3.5" />
          )}
        </Button>
      </div>
    </div>
  );
}
