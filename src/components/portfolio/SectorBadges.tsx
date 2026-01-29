import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { getSectorColors } from '@/types/portfolio';
import { cn } from '@/lib/utils';

interface SectorBadgesProps {
  sectors: string[] | null;
  maxDisplay?: number;
}

export function SectorBadges({ sectors, maxDisplay = 2 }: SectorBadgesProps) {
  const [open, setOpen] = useState(false);

  if (!sectors || sectors.length === 0) {
    return <span className="text-muted-foreground">-</span>;
  }

  const displaySectors = sectors.slice(0, maxDisplay);
  const remainingSectors = sectors.slice(maxDisplay);
  const remainingCount = remainingSectors.length;

  return (
    <div className="flex flex-wrap items-center gap-1">
      {displaySectors.map((sector) => {
        const colors = getSectorColors(sector);
        return (
          <Badge
            key={sector}
            variant="outline"
            className={cn(colors.bg, colors.text, colors.border, 'text-xs')}
          >
            {sector}
          </Badge>
        );
      })}
      {remainingCount > 0 && (
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Badge 
              variant="secondary" 
              className="text-xs cursor-pointer hover:bg-secondary/80 transition-colors"
              onClick={() => setOpen(true)}
            >
              +{remainingCount}
            </Badge>
          </PopoverTrigger>
          <PopoverContent side="bottom" align="start" className="w-auto max-w-[250px] p-2">
            <div className="flex flex-wrap gap-1">
              {remainingSectors.map((sector) => {
                const colors = getSectorColors(sector);
                return (
                  <Badge
                    key={sector}
                    variant="outline"
                    className={cn(colors.bg, colors.text, colors.border, 'text-xs')}
                  >
                    {sector}
                  </Badge>
                );
              })}
            </div>
          </PopoverContent>
        </Popover>
      )}
    </div>
  );
}
