import { useRef, useState, useEffect, useCallback } from "react";
import { ChevronLeft, ChevronRight, Newspaper, Linkedin } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useCompanyNews, type CompanyNewsItem } from "@/hooks/useCompanyNews";

function NewsCard({ item }: { item: CompanyNewsItem }) {
  const isLinkedIn = item.source_type === "linkedin";

  return (
    <a
      href={item.source_url || "#"}
      target="_blank"
      rel="noopener noreferrer"
      className="block h-full"
    >
      <Card className="h-full overflow-hidden hover:shadow-md transition-shadow cursor-pointer flex flex-col">
        {/* Image */}
        <div className="relative aspect-video bg-muted flex items-center justify-center overflow-hidden">
          {item.image_url ? (
            <img
              src={item.image_url}
              alt={item.title}
              className="w-full h-full object-cover"
              loading="lazy"
            />
          ) : isLinkedIn ? (
            <Linkedin className="h-10 w-10 text-muted-foreground/40" />
          ) : (
            <Newspaper className="h-10 w-10 text-muted-foreground/40" />
          )}
          <Badge
            className={`absolute top-2 right-2 text-[10px] px-1.5 py-0.5 ${
              isLinkedIn
                ? "bg-[hsl(215,80%,28%)] text-white border-transparent"
                : "bg-primary text-primary-foreground border-transparent"
            }`}
          >
            {isLinkedIn ? "LinkedIn" : "Presse"}
          </Badge>
        </div>

        {/* Body */}
        <div className="flex flex-col flex-1 p-3 gap-1.5">
          <p className="text-sm font-semibold line-clamp-2 leading-snug">{item.title}</p>
          {item.description && (
            <p className="text-xs text-muted-foreground line-clamp-3 leading-relaxed">
              {item.description}
            </p>
          )}
          {/* Footer */}
          <div className="mt-auto pt-2 flex items-center justify-between text-[11px] text-muted-foreground">
            <span className="truncate max-w-[60%]">{item.source_name || "—"}</span>
            {item.published_at && (
              <span className="whitespace-nowrap">
                {formatDistanceToNow(new Date(item.published_at), {
                  addSuffix: true,
                  locale: fr,
                })}
              </span>
            )}
          </div>
        </div>
      </Card>
    </a>
  );
}

export function CompanyNewsCarousel({ companyId }: { companyId: string }) {
  const { data: news = [], isLoading } = useCompanyNews(companyId);
  const trackRef = useRef<HTMLDivElement>(null);
  const [page, setPage] = useState(0);
  const [maxPage, setMaxPage] = useState(0);

  const recalc = useCallback(() => {
    const el = trackRef.current;
    if (!el || news.length === 0) return;
    const containerW = el.parentElement?.clientWidth || el.clientWidth;
    const cardW = containerW < 640 ? containerW : containerW < 1024 ? containerW / 2 : containerW / 3;
    const visibleCards = Math.round(containerW / cardW);
    setMaxPage(Math.max(0, news.length - visibleCards));
  }, [news.length]);

  useEffect(() => {
    recalc();
    window.addEventListener("resize", recalc);
    return () => window.removeEventListener("resize", recalc);
  }, [recalc]);

  useEffect(() => {
    const el = trackRef.current;
    if (!el) return;
    const containerW = el.parentElement?.clientWidth || el.clientWidth;
    const cardW = containerW < 640 ? containerW : containerW < 1024 ? containerW / 2 : containerW / 3;
    el.style.transform = `translateX(-${page * cardW}px)`;
  }, [page]);

  if (isLoading) return null;

  if (news.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-10 text-muted-foreground gap-2">
        <Newspaper className="h-8 w-8" />
        <p className="text-sm">Pas d'actualités récentes pour cette société</p>
      </div>
    );
  }

  return (
    <div className="relative group">
      {/* Arrows */}
      {page > 0 && (
        <Button
          variant="outline"
          size="icon"
          className="absolute -left-4 top-1/2 -translate-y-1/2 z-10 h-8 w-8 rounded-full shadow bg-background"
          onClick={() => setPage((p) => Math.max(0, p - 1))}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
      )}
      {page < maxPage && (
        <Button
          variant="outline"
          size="icon"
          className="absolute -right-4 top-1/2 -translate-y-1/2 z-10 h-8 w-8 rounded-full shadow bg-background"
          onClick={() => setPage((p) => Math.min(maxPage, p + 1))}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      )}

      {/* Track */}
      <div className="overflow-hidden">
        <div
          ref={trackRef}
          className="flex transition-transform duration-300 ease-in-out"
          style={{ gap: "1rem" }}
        >
          {news.map((item) => (
            <div
              key={item.id}
              className="shrink-0 w-full sm:w-[calc(50%-0.5rem)] lg:w-[calc(33.333%-0.667rem)]"
            >
              <NewsCard item={item} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
