import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { SECTOR_COLORS, getSectorColors } from '@/types/portfolio';
import { cn } from '@/lib/utils';

interface SectorBadgesProps {
  sectors: string[] | null;
  maxDisplay?: number;
}

export function SectorBadges({ sectors, maxDisplay = 2 }: SectorBadgesProps) {
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
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge variant="secondary" className="text-xs cursor-help">
              +{remainingCount}
            </Badge>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            <div className="flex flex-col gap-1">
              {remainingSectors.map((sector) => (
                <span key={sector}>{sector}</span>
              ))}
            </div>
          </TooltipContent>
        </Tooltip>
      )}
    </div>
  );
}
