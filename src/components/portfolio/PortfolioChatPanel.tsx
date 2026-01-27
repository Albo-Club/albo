/**
 * PortfolioChatPanel - Chat IA intégré pour les portfolio companies
 * 
 * Interface style "Messenger" avec :
 * - Historique des conversations en accordéon
 * - Mode rétractable/agrandi
 * - Bulles de messages
 * - Input de message avec envoi
 */

import React, { useState, useRef, useEffect } from 'react';
import { 
  MessageSquare, 
  Send, 
  Bot, 
  ChevronDown, 
  ChevronUp,
  Plus,
  Trash2,
  Maximize2,
  Minimize2,
  Loader2,
  History,
  Sparkles,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Collapsible, 
  CollapsibleContent, 
  CollapsibleTrigger 
} from '@/components/ui/collapsible';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { usePortfolioChat, PortfolioMessage, PortfolioConversation } from '@/hooks/usePortfolioChat';
import ReactMarkdown from 'react-markdown';

// ============================================
// Props
// ============================================

interface PortfolioChatPanelProps {
  companyId: string;
  companyName: string;
}

// ============================================
// Composant principal
// ============================================

export function PortfolioChatPanel({ companyId, companyName }: PortfolioChatPanelProps) {
  // État local pour l'interface
  const [isExpanded, setIsExpanded] = useState(false); // Mode agrandi
  const [isHistoryOpen, setIsHistoryOpen] = useState(false); // Accordéon historique
  const [inputValue, setInputValue] = useState('');
  
  // Ref pour le scroll automatique
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  
  // Hook de chat
  const {
    conversations,
    messages,
    activeConversationId,
    isLoading,
    isLoadingConversations,
    sendMessage,
    selectConversation,
    createNewConversation,
    deleteConversation,
  } = usePortfolioChat(companyId);
  
  // Auto-scroll quand nouveaux messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // ============================================
  // Handlers
  // ============================================
  
  const handleSendMessage = () => {
    if (!inputValue.trim() || isLoading) return;
    sendMessage(inputValue.trim());
    setInputValue('');
  };
  
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };
  
  const handleSelectConversation = (convId: string) => {
    selectConversation(convId);
    setIsHistoryOpen(false);
  };
  
  const handleNewConversation = () => {
    createNewConversation();
    setIsHistoryOpen(false);
    inputRef.current?.focus();
  };

  // ============================================
  // Rendu: Message individuel
  // ============================================
  
  const renderMessage = (message: PortfolioMessage) => {
    const isUser = message.role === 'user';
    
    return (
      <div
        key={message.id}
        className={cn(
          "flex gap-2 mb-3",
          isUser ? "justify-end" : "justify-start"
        )}
      >
        {/* Avatar assistant */}
        {!isUser && (
          <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
            <Bot className="h-4 w-4 text-primary" />
          </div>
        )}
        
        {/* Bulle de message */}
        <div
          className={cn(
            "max-w-[85%] rounded-2xl px-3 py-2 text-sm",
            isUser
              ? "bg-primary text-primary-foreground"
              : "bg-muted prose prose-sm dark:prose-invert prose-p:my-1 prose-headings:my-2 prose-ul:my-1 prose-ol:my-1 prose-li:my-0 max-w-none"
          )}
        >
          {isUser ? (
            <p className="whitespace-pre-wrap">{message.content}</p>
          ) : (
            <ReactMarkdown>{message.content}</ReactMarkdown>
          )}
        </div>
      </div>
    );
  };

  // ============================================
  // Rendu: Historique des conversations
  // ============================================
  
  const renderConversationHistory = () => (
    <Collapsible open={isHistoryOpen} onOpenChange={setIsHistoryOpen}>
      <CollapsibleTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-between text-xs h-8 px-2"
        >
          <span className="flex items-center gap-1.5">
            <History className="h-3.5 w-3.5" />
            Historique ({conversations.length})
          </span>
          {isHistoryOpen ? (
            <ChevronUp className="h-3.5 w-3.5" />
          ) : (
            <ChevronDown className="h-3.5 w-3.5" />
          )}
        </Button>
      </CollapsibleTrigger>
      
      <CollapsibleContent className="pt-1">
        <div className="space-y-1 max-h-32 overflow-y-auto">
          {/* Bouton nouvelle conversation */}
          <button
            onClick={handleNewConversation}
            className="w-full flex items-center gap-2 px-2 py-1.5 text-xs rounded hover:bg-accent transition-colors text-primary"
          >
            <Plus className="h-3.5 w-3.5" />
            Nouvelle conversation
          </button>
          
          {/* Liste des conversations */}
          {isLoadingConversations ? (
            <div className="flex items-center justify-center py-2">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            </div>
          ) : conversations.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-2">
              Aucune conversation
            </p>
          ) : (
            conversations.map((conv) => (
              <div
                key={conv.id}
                className={cn(
                  "group flex items-center justify-between px-2 py-1.5 text-xs rounded cursor-pointer transition-colors",
                  activeConversationId === conv.id
                    ? "bg-primary/10 text-primary"
                    : "hover:bg-accent"
                )}
                onClick={() => handleSelectConversation(conv.id)}
              >
                <span className="truncate flex-1">{conv.title}</span>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteConversation(conv.id);
                      }}
                      className="opacity-0 group-hover:opacity-100 p-1 hover:bg-destructive/10 rounded transition-opacity"
                    >
                      <Trash2 className="h-3 w-3 text-destructive" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="left">Supprimer</TooltipContent>
                </Tooltip>
              </div>
            ))
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );

  // ============================================
  // Rendu principal
  // ============================================
  
  return (
    <div
      className={cn(
        "border rounded-lg bg-card shadow-sm overflow-hidden transition-all duration-300",
        isExpanded 
          ? "fixed inset-4 z-50 lg:inset-auto lg:absolute lg:-left-[400px] lg:right-0 lg:top-0 lg:bottom-0" 
          : "h-[400px]"
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b bg-muted/50">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          <span className="font-medium text-sm">Chat with this deal</span>
        </div>
        <div className="flex items-center gap-1">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => setIsExpanded(!isExpanded)}
              >
                {isExpanded ? (
                  <Minimize2 className="h-4 w-4" />
                ) : (
                  <Maximize2 className="h-4 w-4" />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              {isExpanded ? "Réduire" : "Agrandir"}
            </TooltipContent>
          </Tooltip>
        </div>
      </div>
      
      {/* Historique (accordéon) */}
      <div className="px-2 py-1 border-b">
        {renderConversationHistory()}
      </div>
      
      {/* Zone de messages */}
      <ScrollArea 
        ref={scrollRef as any}
        className={cn(
          "px-3 py-3",
          isExpanded ? "h-[calc(100%-140px)]" : "h-[calc(100%-140px)]"
        )}
      >
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center py-8">
            <Bot className="h-10 w-10 text-muted-foreground/50 mb-3" />
            <p className="text-sm text-muted-foreground mb-1">
              Posez vos questions sur {companyName}
            </p>
            <p className="text-xs text-muted-foreground/70">
              Ex: "Quelle est l'évolution des AUM ?" ou "Résume les derniers reports"
            </p>
          </div>
        ) : (
          messages.map(renderMessage)
        )}
        
        {/* Indicateur de chargement */}
        {isLoading && (
          <div className="flex gap-2 mb-3">
            <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center">
              <Bot className="h-4 w-4 text-primary" />
            </div>
            <div className="bg-muted rounded-2xl px-3 py-2">
              <div className="flex items-center gap-1">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                <span className="text-xs text-muted-foreground">Réflexion...</span>
              </div>
            </div>
          </div>
        )}
      </ScrollArea>
      
      {/* Zone de saisie */}
      <div className="absolute bottom-0 left-0 right-0 p-3 border-t bg-card">
        <div className="flex items-center gap-2">
          <Input
            ref={inputRef}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Posez votre question..."
            disabled={isLoading}
            className="flex-1 h-9 text-sm"
          />
          <Button
            size="icon"
            className="h-9 w-9 shrink-0"
            onClick={handleSendMessage}
            disabled={!inputValue.trim() || isLoading}
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

export default PortfolioChatPanel;
