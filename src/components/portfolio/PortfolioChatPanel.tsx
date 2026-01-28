/**
 * PortfolioChatPanel - Chat IA intégré pour les portfolio companies
 * 
 * Interface style "Messenger" avec :
 * - Historique des conversations en accordéon
 * - Mode rétractable/agrandi
 * - Bulles de messages avec Markdown
 * - Streaming simulé (effet machine à écrire)
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { 
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
  Square,
  User,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
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
import { usePortfolioChat, PortfolioMessage } from '@/hooks/usePortfolioChat';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';

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

// Configuration du resize
const MIN_PANEL_WIDTH = 350;
const MAX_PANEL_WIDTH = 600;
const DEFAULT_PANEL_WIDTH = 420;

export function PortfolioChatPanel({ companyId, companyName }: PortfolioChatPanelProps) {
  // État local pour l'interface
  const [isExpanded, setIsExpanded] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [panelWidth, setPanelWidth] = useState(DEFAULT_PANEL_WIDTH);
  const [isResizing, setIsResizing] = useState(false);
  
  // Refs
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const dragStartX = useRef<number>(0);
  const dragStartWidth = useRef<number>(DEFAULT_PANEL_WIDTH);
  
  // Hook de chat
  const {
    conversations,
    messages,
    activeConversationId,
    isLoading,
    isStreaming,
    streamingMessageId,
    sendMessage,
    selectConversation,
    createNewConversation,
    deleteConversation,
    stopStreaming,
  } = usePortfolioChat(companyId);
  
  // Auto-scroll quand nouveaux messages ou streaming
  useEffect(() => {
    if (scrollRef.current) {
      const scrollElement = scrollRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (scrollElement) {
        scrollElement.scrollTop = scrollElement.scrollHeight;
      }
    }
  }, [messages]);

  // Handler pour le resize
  const handleResizeMouseDown = useCallback((e: React.MouseEvent) => {
    if (!isExpanded) return;
    e.preventDefault();
    e.stopPropagation();
    dragStartX.current = e.clientX;
    dragStartWidth.current = panelWidth;
    setIsResizing(true);
  }, [isExpanded, panelWidth]);

  // Gestion du mouse move/up pour le resize
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;
      const deltaX = dragStartX.current - e.clientX;
      const newWidth = dragStartWidth.current + deltaX;
      const clampedWidth = Math.min(Math.max(newWidth, MIN_PANEL_WIDTH), MAX_PANEL_WIDTH);
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

  // ============================================
  // Handlers
  // ============================================
  
  const handleSendMessage = () => {
    if (!inputValue.trim() || isLoading || isStreaming) return;
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
    textareaRef.current?.focus();
  };

  // ============================================
  // Rendu: Message individuel
  // ============================================
  
  const renderMessage = (message: PortfolioMessage) => {
    const isUser = message.role === 'user';
    const isCurrentlyStreaming = message.id === streamingMessageId;
    
    return (
      <div
        key={message.id}
        className={cn(
          "flex gap-2 mb-4",
          isUser ? "justify-end" : "justify-start"
        )}
      >
        {/* Avatar assistant */}
        {!isUser && (
          <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
            <Bot className="h-4 w-4 text-primary" />
          </div>
        )}
        
        {/* Bulle de message */}
        <div
          className={cn(
            "max-w-[75%] rounded-2xl px-4 py-2.5 text-sm",
            isUser
              ? "bg-primary text-primary-foreground"
              : "bg-muted"
          )}
        >
          {isUser ? (
            <p className="whitespace-pre-wrap">{message.content}</p>
          ) : (
            <div className="prose prose-sm dark:prose-invert max-w-none prose-p:my-2 prose-headings:my-3 prose-ul:my-2 prose-ol:my-2 prose-li:my-0.5 prose-table:my-3">
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                  // Headers
                  h1: ({ children }) => (
                    <h1 className="text-lg font-bold text-foreground border-b border-border pb-2 mb-3">{children}</h1>
                  ),
                  h2: ({ children }) => (
                    <h2 className="text-base font-semibold text-foreground mt-4 mb-2">{children}</h2>
                  ),
                  h3: ({ children }) => (
                    <h3 className="text-sm font-semibold text-foreground mt-3 mb-1">{children}</h3>
                  ),
                  // Tables
                  table: ({ children }) => (
                    <div className="overflow-x-auto my-3 rounded-lg border border-border">
                      <table className="min-w-full divide-y divide-border text-xs">
                        {children}
                      </table>
                    </div>
                  ),
                  thead: ({ children }) => (
                    <thead className="bg-muted/50">{children}</thead>
                  ),
                  th: ({ children }) => (
                    <th className="px-3 py-2 text-left font-semibold text-foreground whitespace-nowrap">
                      {children}
                    </th>
                  ),
                  td: ({ children }) => (
                    <td className="px-3 py-2 text-muted-foreground border-t border-border">
                      {children}
                    </td>
                  ),
                  // Code blocks with syntax highlighting
                  code: ({ node, className, children, ...props }) => {
                    const match = /language-(\w+)/.exec(className || '');
                    const isInline = !match && !className;
                    return !isInline && match ? (
                      <SyntaxHighlighter
                        style={oneDark}
                        language={match[1]}
                        PreTag="div"
                        className="rounded-lg text-xs my-2"
                      >
                        {String(children).replace(/\n$/, '')}
                      </SyntaxHighlighter>
                    ) : (
                      <code className="bg-muted-foreground/20 px-1.5 py-0.5 rounded text-xs font-mono" {...props}>
                        {children}
                      </code>
                    );
                  },
                  // Blockquotes
                  blockquote: ({ children }) => (
                    <blockquote className="border-l-4 border-primary/50 pl-4 py-1 my-3 bg-primary/5 rounded-r-lg italic text-muted-foreground">
                      {children}
                    </blockquote>
                  ),
                  // Links
                  a: ({ href, children }) => (
                    <a
                      href={href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline font-medium"
                    >
                      {children}
                    </a>
                  ),
                  // Lists
                  ul: ({ children }) => (
                    <ul className="list-disc list-inside space-y-1 my-2">{children}</ul>
                  ),
                  ol: ({ children }) => (
                    <ol className="list-decimal list-inside space-y-1 my-2">{children}</ol>
                  ),
                  li: ({ children }) => (
                    <li className="text-foreground">{children}</li>
                  ),
                  // Strong/Bold
                  strong: ({ children }) => (
                    <strong className="font-semibold text-foreground">{children}</strong>
                  ),
                  // Paragraphs
                  p: ({ children }) => (
                    <p className="my-2 leading-relaxed">{children}</p>
                  ),
                }}
              >
                {message.content || ''}
              </ReactMarkdown>
              
              {/* Curseur clignotant pendant le streaming */}
              {isCurrentlyStreaming && (
                <span className="inline-block w-2 h-4 bg-primary animate-pulse ml-0.5" />
              )}
            </div>
          )}
        </div>
        
        {/* Avatar utilisateur */}
        {isUser && (
          <div className="w-7 h-7 rounded-full bg-primary flex items-center justify-center flex-shrink-0 mt-0.5">
            <User className="h-4 w-4 text-primary-foreground" />
          </div>
        )}
      </div>
    );
  };

  // ============================================
  // Rendu: Indicateur de chargement (typing)
  // ============================================
  
  const renderLoadingIndicator = () => (
    <div className="flex gap-2 mb-4">
      <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
        <Bot className="h-4 w-4 text-primary" />
      </div>
      <div className="bg-muted rounded-2xl px-4 py-3">
        <div className="flex items-center gap-2">
          {/* Typing animation - 3 dots */}
          <div className="flex items-center gap-1">
            <span className="w-2 h-2 bg-primary/60 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
            <span className="w-2 h-2 bg-primary/60 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
            <span className="w-2 h-2 bg-primary/60 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
          </div>
          <span className="text-sm text-muted-foreground ml-2">Analyse en cours...</span>
        </div>
      </div>
    </div>
  );

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
          {conversations.length === 0 ? (
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
        "border rounded-lg bg-card shadow-sm overflow-hidden transition-all duration-300 flex flex-col relative",
        isExpanded 
          ? "h-[700px] shadow-xl" 
          : "h-[400px]",
        isResizing && "transition-none"
      )}
      style={isExpanded ? { width: `${panelWidth}px` } : undefined}
    >
      {/* Bordure de resize (uniquement en mode expanded) */}
      {isExpanded && (
        <div
          onMouseDown={handleResizeMouseDown}
          className={cn(
            "absolute left-0 top-0 bottom-0 w-3 -translate-x-1/2 z-50",
            "flex items-center justify-center cursor-ew-resize group",
            "hover:bg-primary/10",
            "before:absolute before:inset-y-0 before:left-1/2 before:-translate-x-1/2",
            "before:w-0.5 before:bg-border before:rounded-full",
            "hover:before:bg-primary/50 hover:before:w-1",
            isResizing && "before:bg-primary before:w-1.5"
          )}
          title="Glisser pour redimensionner"
        />
      )}
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b bg-muted/50 shrink-0">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          <span className="font-medium text-sm">Assistant IA</span>
          <span className="text-xs text-muted-foreground">• {companyName}</span>
        </div>
        <div className="flex items-center gap-1">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={handleNewConversation}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Nouvelle conversation</TooltipContent>
          </Tooltip>
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
      {conversations.length > 0 && (
        <div className="px-2 py-1 border-b shrink-0">
          {renderConversationHistory()}
        </div>
      )}
      
      {/* Zone de messages */}
      <ScrollArea 
        ref={scrollRef}
        className="flex-1 px-3 py-3"
      >
        <div className="space-y-1">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center py-8">
              <Bot className="h-10 w-10 text-muted-foreground/50 mb-3" />
              <p className="text-sm text-muted-foreground mb-1">
                Posez une question sur {companyName}
              </p>
              <p className="text-xs text-muted-foreground/70">
                Business model, métriques, stratégie...
              </p>
            </div>
          ) : (
            <>
              {messages.map(renderMessage)}
              {isLoading && !isStreaming && renderLoadingIndicator()}
            </>
          )}
        </div>
      </ScrollArea>
      
      {/* Zone de saisie */}
      <div className="p-3 border-t bg-card shrink-0">
        <div className="flex items-end gap-2">
          <Textarea
            ref={textareaRef}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Posez votre question..."
            disabled={isLoading || isStreaming}
            className="min-h-[44px] max-h-[120px] resize-none text-sm flex-1"
            rows={1}
          />
          
          {isStreaming ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="icon"
                  variant="outline"
                  className="h-[44px] w-[44px] shrink-0"
                  onClick={stopStreaming}
                >
                  <Square className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Arrêter</TooltipContent>
            </Tooltip>
          ) : (
            <Button
              size="icon"
              className="h-[44px] w-[44px] shrink-0"
              onClick={handleSendMessage}
              disabled={!inputValue.trim() || isLoading}
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

export default PortfolioChatPanel;
