import { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Send, Bot, User, Sparkles, TrendingUp, GitCompare, PieChart, Layers, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useAIPanel } from "@/contexts/AIPanelContext";
import { toast } from "sonner";
import { LoadingDots } from "@/components/ui/LoadingDots";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  created_at: string;
}

const promptSuggestions = [
  {
    icon: TrendingUp,
    title: "Market Analysis",
    description: "Industry Insights",
    prompt: "Analyse les tendances du marché pour mes deals et identifie les opportunités clés par secteur."
  },
  {
    icon: GitCompare,
    title: "Compare Deals",
    description: "Portfolio Overview",
    prompt: "Compare mes différents deals et mets en avant les plus prometteurs selon leurs métriques."
  },
  {
    icon: PieChart,
    title: "Sector Breakdown",
    description: "Distribution Analysis",
    prompt: "Donne-moi une analyse détaillée de la répartition de mon portefeuille par secteur et stade."
  },
  {
    icon: Layers,
    title: "Top Deals",
    description: "By Potential",
    prompt: "Quels sont mes meilleurs deals actuels et pourquoi sont-ils prometteurs ?"
  },
];

// Largeur min/max pour le panel
const MIN_WIDTH = 320;
const MAX_WIDTH = 600;

export function AskAISidePanel() {
  const { user } = useAuth();
  const { isOpen, closePanel, currentDealId, currentDealContext } = useAIPanel();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // État pour la largeur du panel et resize
  const [panelWidth, setPanelWidth] = useState(400);
  const [isResizing, setIsResizing] = useState(false);
  const dragStartX = useRef<number>(0);
  const dragStartWidth = useRef<number>(400);

  // Gestion du resize
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragStartX.current = e.clientX;
    dragStartWidth.current = panelWidth;
    setIsResizing(true);
  }, [panelWidth]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;
      
      // Calculer la nouvelle largeur basée sur le mouvement
      const deltaX = dragStartX.current - e.clientX;
      const newWidth = dragStartWidth.current + deltaX;
      
      // Appliquer les limites min/max
      const clampedWidth = Math.min(Math.max(newWidth, MIN_WIDTH), MAX_WIDTH);
      setPanelWidth(clampedWidth);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.body.style.userSelect = 'none';
      document.body.style.cursor = 'ew-resize';
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
    };
  }, [isResizing]);

  // Reset state when panel closes
  useEffect(() => {
    if (!isOpen) {
      setMessages([]);
      setConversationId(null);
      setInput("");
    }
  }, [isOpen]);

  // Auto-scroll on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const sendMessage = async (messageText?: string) => {
    const userMessage = (messageText || input).trim();
    if (!userMessage || isLoading || !user) return;

    setInput("");
    setIsLoading(true);

    try {
      // 1. Create or get conversation
      let activeConversationId = conversationId;

      if (!activeConversationId) {
        const { data: newConv, error: convError } = await supabase
          .from("conversations")
          .insert({
            user_id: user.id,
            deal_id: currentDealId || null,
            title: currentDealContext?.companyName 
              ? `Due Diligence - ${currentDealContext.companyName}` 
              : `Ask AI - ${new Date().toLocaleDateString("fr-FR")}`,
            source: "chat",
          })
          .select()
          .single();

        if (convError) throw convError;
        activeConversationId = newConv.id;
        setConversationId(activeConversationId);
      }

      // 2. Save user message to Supabase
      const { data: savedUserMsg, error: userMsgError } = await supabase
        .from("conversation_messages")
        .insert({
          conversation_id: activeConversationId,
          role: "user",
          content: userMessage,
          attachments: [],
        })
        .select()
        .single();

      if (userMsgError) throw userMsgError;

      // Display user message immediately
      setMessages((prev) => [...prev, savedUserMsg as Message]);

      // 3. Call N8N webhook
      const response = await fetch(
        "https://n8n.alboteam.com/webhook/6d0211b4-a08d-45b3-a20d-1b717f7713df",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: userMessage,
            user_id: user.id,
            conversation_id: activeConversationId,
            deal_id: currentDealId || null,
          }),
        }
      );

      if (!response.ok) throw new Error("Erreur de connexion au serveur");

      const data = await response.json();

      // Parse N8N response (array or object format)
      let assistantContent: string;

      if (Array.isArray(data) && data.length > 0) {
        assistantContent = data[0].message || data[0].output || data[0].response;
      } else if (data && typeof data === "object") {
        assistantContent = data.message || data.output || data.response;
      } else {
        throw new Error("Format de réponse invalide");
      }

      if (!assistantContent || assistantContent.trim() === "") {
        throw new Error("Réponse IA vide");
      }

      // 4. Save assistant message to Supabase
      const { data: savedAssistantMsg, error: aiMsgError } = await supabase
        .from("conversation_messages")
        .insert({
          conversation_id: activeConversationId,
          role: "assistant",
          content: assistantContent,
          attachments: [],
        })
        .select()
        .single();

      if (aiMsgError) throw aiMsgError;

      // Display assistant message
      setMessages((prev) => [...prev, savedAssistantMsg as Message]);

      // Update conversation timestamp
      await supabase
        .from("conversations")
        .update({ updated_at: new Date().toISOString() })
        .eq("id", activeConversationId);
    } catch (error: any) {
      console.error("Erreur chat:", error);
      toast.error(error.message || "Erreur de connexion");
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const handleSuggestionClick = (prompt: string) => {
    sendMessage(prompt);
  };

  const hasMessages = messages.length > 0;

  if (!isOpen) return null;

  return (
    <aside
      className={cn(
        "fixed right-0 top-0 h-screen bg-background z-40",
        "flex flex-col",
        "animate-in slide-in-from-right duration-300",
        isResizing && "transition-none select-none"
      )}
      style={{ width: window.innerWidth < 768 ? '100%' : `${panelWidth}px` }}
    >
      {/* Bordure de resize cliquable */}
      <div
        onMouseDown={handleMouseDown}
        className={cn(
          "absolute left-0 top-0 bottom-0 w-4 -translate-x-1/2 z-50",
          "hidden md:flex items-center justify-center",
          "cursor-ew-resize group",
          // Zone de hover plus visible
          "hover:bg-primary/5",
          // Indicateur visuel
          "before:absolute before:inset-y-0 before:left-1/2 before:-translate-x-1/2",
          "before:w-1 before:bg-border before:rounded-full",
          "before:transition-all before:duration-200",
          "hover:before:bg-primary/40 hover:before:w-1.5",
          isResizing && "before:bg-primary before:w-2"
        )}
        title="Glisser pour redimensionner"
      >
        {/* Indicateur de grip */}
        <div className="absolute left-1/2 -translate-x-1/2 flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <div className="w-0.5 h-8 bg-muted-foreground/30 rounded-full" />
        </div>
      </div>

      {/* Bordure visuelle */}
      <div className="absolute left-0 top-0 bottom-0 w-px bg-border" />

      {/* Header */}
      <div className="h-14 flex items-center justify-between px-4 border-b flex-shrink-0">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" />
          <span className="font-semibold">Ask AI</span>
          {currentDealContext?.companyName && (
            <span className="text-sm text-muted-foreground">
              • {currentDealContext.companyName}
            </span>
          )}
        </div>
        <Button variant="ghost" size="icon" onClick={closePanel}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {!hasMessages ? (
          // Initial state with suggestions
          <div className="flex-1 flex flex-col items-center justify-center p-6">
            <div className="text-center mb-6">
              <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-primary/10 mb-4">
                <Sparkles className="h-7 w-7 text-primary" />
              </div>
              <h2 className="text-lg font-semibold mb-2">
                ASK SOMETHING ABOUT YOUR DEALS
              </h2>
              <p className="text-sm text-muted-foreground max-w-sm">
                Maximize investment decisions with our AI assistant.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2 w-full">
              {promptSuggestions.map((suggestion, index) => (
                <button
                  key={index}
                  onClick={() => handleSuggestionClick(suggestion.prompt)}
                  className="flex items-start gap-2 p-3 rounded-lg border bg-card hover:bg-accent transition-colors text-left"
                >
                  <suggestion.icon className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="font-medium text-sm">{suggestion.title}</p>
                    <p className="text-xs text-muted-foreground">{suggestion.description}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        ) : (
          // Conversation view
          <ScrollArea ref={scrollRef} className="flex-1 p-4">
            <div className="space-y-4">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={cn(
                    "flex gap-3",
                    message.role === "user" ? "justify-end" : "justify-start"
                  )}
                >
                  {message.role === "assistant" && (
                    <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <Bot className="h-3.5 w-3.5 text-primary" />
                    </div>
                  )}
                  <div
                    className={cn(
                      "max-w-[85%] rounded-lg px-3 py-2",
                      message.role === "user"
                        ? "bg-primary text-primary-foreground whitespace-pre-wrap text-sm"
                        : "bg-muted prose prose-sm dark:prose-invert prose-p:my-1 prose-headings:my-2 prose-ul:my-1 prose-ol:my-1 prose-li:my-0 prose-table:my-2 max-w-none"
                    )}
                  >
                    {message.role === "user" ? (
                      message.content
                    ) : (
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {message.content}
                      </ReactMarkdown>
                    )}
                  </div>
                  {message.role === "user" && (
                    <div className="w-7 h-7 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
                      <User className="h-3.5 w-3.5 text-primary-foreground" />
                    </div>
                  )}
                </div>
              ))}

              {isLoading && (
                <div className="flex gap-3">
                  <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <Bot className="h-3.5 w-3.5 text-primary" />
                  </div>
                  <div className="bg-muted rounded-lg px-3 py-2 flex items-center gap-2">
                    <LoadingDots />
                    <span className="text-sm text-muted-foreground">Analyse en cours...</span>
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>
        )}
      </div>

      {/* Input */}
      <div className="p-4 border-t">
        <div className="flex gap-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask something..."
            disabled={isLoading}
            className="flex-1"
          />
          <Button onClick={() => sendMessage()} disabled={isLoading || !input.trim()} size="icon">
            <Send className="h-4 w-4" />
          </Button>
        </div>
        <p className="text-xs text-center text-muted-foreground mt-2">
          AI can make mistakes. Verify important information.
        </p>
      </div>

      {/* Mobile overlay backdrop */}
      <div
        className="fixed inset-0 bg-black/50 -z-10 md:hidden"
        onClick={closePanel}
      />
    </aside>
  );
}
