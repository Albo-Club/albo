import { useState, useRef, useEffect } from 'react';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';

interface EditableBadgeProps {
  value: string | null;
  field: string;
  dealId: string;
  options?: string[];
  placeholder?: string;
  variant: 'stage' | 'sector' | 'amount' | 'funding';
  onSave: (dealId: string, field: string, value: string) => Promise<void>;
}

const variantStyles = {
  stage: 'bg-violet-500/10 text-violet-600 border-violet-500/20 hover:bg-violet-500/20',
  sector: 'bg-blue-500/10 text-blue-600 border-blue-500/20 hover:bg-blue-500/20',
  amount: 'bg-green-500/10 text-green-600 border-green-500/20 hover:bg-green-500/20',
  funding: 'bg-orange-500/10 text-orange-600 border-orange-500/20 hover:bg-orange-500/20',
};

export function EditableBadge({
  value,
  field,
  dealId,
  options,
  placeholder = 'Non défini',
  variant,
  onSave,
}: EditableBadgeProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(value || '');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleDoubleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setEditValue(value || '');
    setIsEditing(true);
  };

  const handleSave = async () => {
    if (editValue !== value) {
      await onSave(dealId, field, editValue);
    }
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSave();
    } else if (e.key === 'Escape') {
      setIsEditing(false);
    }
  };

  if (isEditing) {
    if (options && options.length > 0) {
      return (
        <Select
          value={editValue}
          onValueChange={(val) => {
            setEditValue(val);
            onSave(dealId, field, val).then(() => setIsEditing(false));
          }}
          open={true}
          onOpenChange={(open) => {
            if (!open) setIsEditing(false);
          }}
        >
          <SelectTrigger 
            className="h-6 w-auto min-w-[80px] text-xs"
            onClick={(e) => e.stopPropagation()}
          >
            <SelectValue placeholder={placeholder} />
          </SelectTrigger>
          <SelectContent onClick={(e) => e.stopPropagation()}>
            <SelectItem value="_none_">(vide)</SelectItem>
            {options.map((opt) => (
              <SelectItem key={opt} value={opt}>
                {opt}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      );
    }

    return (
      <Input
        ref={inputRef}
        value={editValue}
        onChange={(e) => setEditValue(e.target.value)}
        onBlur={handleSave}
        onKeyDown={handleKeyDown}
        onClick={(e) => e.stopPropagation()}
        className="h-6 w-24 text-xs px-2"
      />
    );
  }

  return (
    <Badge
      variant="outline"
      className={cn(
        'cursor-pointer text-xs transition-all',
        variantStyles[variant]
      )}
      onDoubleClick={handleDoubleClick}
      title="Double-cliquez pour modifier"
    >
      {value || placeholder}
    </Badge>
  );
}
