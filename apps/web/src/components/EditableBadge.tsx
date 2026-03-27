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

// Format amount to K€/M€
const formatAmount = (value: string | null): string => {
  if (!value) return '';
  const num = parseInt(value.toString().replace(/[^0-9]/g, ''));
  if (isNaN(num)) return value;
  if (num >= 1000000) {
    const millions = num / 1000000;
    return millions % 1 === 0 ? `${millions}M€` : `${millions.toFixed(1)}M€`;
  } else if (num >= 1000) {
    const thousands = num / 1000;
    return thousands % 1 === 0 ? `${thousands}k€` : `${thousands.toFixed(1)}k€`;
  }
  return `${num}€`;
};

// Parse formatted amount back to raw number string
const parseAmount = (formatted: string): string => {
  if (!formatted) return '';
  const str = formatted.toString().toLowerCase().replace('€', '').trim();
  if (str.includes('m')) {
    return String(Math.round(parseFloat(str.replace('m', '')) * 1000000));
  } else if (str.includes('k')) {
    return String(Math.round(parseFloat(str.replace('k', '')) * 1000));
  }
  return str.replace(/[^0-9]/g, '');
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

  // Single click to edit (not double click)
  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    // For amount field, show raw value for editing
    if (variant === 'amount' && value) {
      setEditValue(parseAmount(value));
    } else {
      setEditValue(value || '');
    }
    setIsEditing(true);
  };

  const handleSave = async () => {
    let saveValue = editValue;
    // For amount field, format and save raw number
    if (variant === 'amount' && editValue) {
      saveValue = parseAmount(editValue);
    }
    if (saveValue !== value) {
      await onSave(dealId, field, saveValue);
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

  // Display formatted amount for amount variant
  const displayValue = variant === 'amount' && value ? formatAmount(value) : value;

  return (
    <Badge
      variant="outline"
      className={cn(
        'cursor-pointer text-xs transition-all select-none',
        variantStyles[variant]
      )}
      onClick={handleClick}
      title="Cliquez pour modifier"
    >
      {displayValue || placeholder}
    </Badge>
  );
}
