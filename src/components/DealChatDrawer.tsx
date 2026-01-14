import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Send, Bot, User, Sparkles } from "lucide-react";
import { cn, displayCompanyName } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
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

interface DealChatDrawerProps {
  dealId: string;
  companyName: string;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

export function DealChatDrawer({ dealId, companyName, isOpen, onOpenChange }: DealChatDrawerProps) {
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Load existing conversation for this deal when drawer opens
  useEffect(() => {
    if (isOpen && dealId && user) {
      loadDealConversation();
    }
  }, [isOpen, dealId, user]);

  // Auto-scroll on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const loadDealConversation = async () => {
    if (!user) return;

    // Find existing conversation for this deal
    const { data: existingConv } = await supabase
      .from("conversations")
      .select("id")
      .eq("deal_id", dealId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (existingConv) {
      setConversationId(existingConv.id);
      // Load messages for this conversation
      const { data: messagesData } = await supabase
        .from("conversation_messages")
        .select("id, role, content, created_at")
        .eq("conversation_id", existingConv.id)
        .order("created_at", { ascending: true });

      if (messagesData) {
        setMessages(messagesData as Message[]);
      }
    } else {
      setConversationId(null);
      setMessages([]);
    }
  };

  const sendMessage = async () => {
    if (!input.trim() || isLoading || !user) return;

    const userMessage = input.trim();
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
            deal_id: dealId,
            title: `Due Diligence - ${companyName}`,
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

      // 3. Call N8N webhook with deal_id
      const response = await fetch(
        "https://n8n.alboteam.com/webhook/6d0211b4-a08d-45b3-a20d-1b717f7713df",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: userMessage,
            user_id: user.id,
            conversation_id: activeConversationId,
            deal_id: dealId,
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

  return (
    <Sheet open={isOpen} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-md flex flex-col p-0">
        <SheetHeader className="p-4 border-b">
          <SheetTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            {displayCompanyName(companyName)}
          </SheetTitle>
        </SheetHeader>

        <ScrollArea ref={scrollRef} className="flex-1 p-4">
          <div className="space-y-4">
            {messages.length === 0 && (
              <div className="text-center py-8">
                <Bot className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">
                  Posez vos questions sur {companyName}.
                </p>
                <p className="text-sm text-muted-foreground/60 mt-2">
                  Ex: "Quels sont les risques principaux ?" ou "Détaille la concurrence"
                </p>
              </div>
            )}

            {messages.map((message) => (
              <div
                key={message.id}
                className={cn(
                  "flex gap-3",
                  message.role === "user" ? "justify-end" : "justify-start"
                )}
              >
                {message.role === "assistant" && (
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <Bot className="h-4 w-4 text-primary" />
                  </div>
                )}
                <div
                  className={cn(
                    "max-w-[80%] rounded-lg px-4 py-2",
                    message.role === "user"
                      ? "bg-primary text-primary-foreground whitespace-pre-wrap"
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
                  <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
                    <User className="h-4 w-4 text-primary-foreground" />
                  </div>
                )}
              </div>
            ))}

            {isLoading && (
              <div className="flex gap-3">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <Bot className="h-4 w-4 text-primary" />
                </div>
                <div className="bg-muted rounded-lg px-4 py-2 flex items-center gap-2">
                  <LoadingDots />
                  <span className="text-sm text-muted-foreground">Analyse en cours...</span>
                </div>
              </div>
            )}
          </div>
        </ScrollArea>

        <div className="p-4 border-t">
          <div className="flex gap-2">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={`Posez une question sur ${companyName}...`}
              disabled={isLoading}
              className="flex-1"
            />
            <Button onClick={sendMessage} disabled={isLoading || !input.trim()}>
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

// Separate button component for use in table
export function DueDiligenceButton({ onClick }: { onClick: (e: React.MouseEvent) => void }) {
  return (
    <Button
      variant="outline"
      size="sm"
      onClick={onClick}
      className="gap-1.5 h-7 px-2.5 text-xs font-medium bg-gradient-to-r from-violet-500/10 to-purple-500/10 border-violet-500/30 text-violet-700 hover:bg-violet-500/20 hover:border-violet-500/50 dark:text-violet-300"
    >
      <Sparkles className="h-3 w-3" />
      Due Diligence
    </Button>
  );
}
