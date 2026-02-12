/**
 * useDealChat - Hook pour gérer les conversations IA des deals
 * 
 * Ce hook gère :
 * - Le chargement des conversations existantes
 * - La création de nouvelles conversations
 * - L'envoi de messages au webhook N8N
 * - La sauvegarde des messages dans Supabase
 * - Le streaming simulé (effet machine à écrire)
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

// ============================================
// Types
// ============================================

export interface DealConversation {
  id: string;
  deal_id: string;
  user_id: string;
  title: string;
  created_at: string;
  updated_at: string;
}

export interface DealMessage {
  id: string;
  conversation_id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  attachments: any[];
  created_at: string;
  isStreaming?: boolean;
}

// ============================================
// Configuration
// ============================================

// URL du webhook N8N pour le chat deals
const DEAL_CHAT_WEBHOOK_URL = 'https://n8n.alboteam.com/webhook/chat_with_your_deals';

// Configuration du streaming simulé
const TYPING_SPEED = 30;
const CHUNK_SIZE = 1;

// ============================================
// Hook principal
// ============================================

export function useDealChat(dealId: string | undefined, companyName?: string) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  
  // État local
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<DealMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingMessageId, setStreamingMessageId] = useState<string | null>(null);
  
  // Ref pour le streaming
  const streamingRef = useRef<{
    fullContent: string;
    currentIndex: number;
    intervalId: NodeJS.Timeout | null;
  }>({
    fullContent: '',
    currentIndex: 0,
    intervalId: null,
  });

  // Cleanup du streaming au démontage
  useEffect(() => {
    return () => {
      if (streamingRef.current.intervalId) {
        clearInterval(streamingRef.current.intervalId);
      }
    };
  }, []);

  // ============================================
  // Query: Charger les conversations de ce deal
  // ============================================
  const {
    data: conversations = [],
    isLoading: isLoadingConversations,
  } = useQuery({
    queryKey: ['deal-conversations', dealId],
    queryFn: async () => {
      if (!dealId || !user) return [];
      
      const { data, error } = await supabase
        .from('deal_conversations')
        .select('*')
        .eq('deal_id', dealId)
        .order('updated_at', { ascending: false });
      
      if (error) throw error;
      return data as DealConversation[];
    },
    enabled: !!dealId && !!user,
  });

  // ============================================
  // Fonction: Simuler le streaming
  // ============================================
  const simulateStreaming = useCallback((
    messageId: string, 
    fullContent: string,
    conversationId: string,
    onComplete: () => void
  ) => {
    if (streamingRef.current.intervalId) {
      clearInterval(streamingRef.current.intervalId);
    }

    streamingRef.current = {
      fullContent,
      currentIndex: 0,
      intervalId: null,
    };

    setIsStreaming(true);
    setStreamingMessageId(messageId);

    setMessages(prev => [
      ...prev,
      {
        id: messageId,
        conversation_id: conversationId,
        role: 'assistant',
        content: '',
        attachments: [],
        created_at: new Date().toISOString(),
        isStreaming: true,
      }
    ]);

    streamingRef.current.intervalId = setInterval(() => {
      const { fullContent, currentIndex } = streamingRef.current;
      
      if (currentIndex >= fullContent.length) {
        if (streamingRef.current.intervalId) {
          clearInterval(streamingRef.current.intervalId);
          streamingRef.current.intervalId = null;
        }
        
        setMessages(prev => prev.map(msg => 
          msg.id === messageId 
            ? { ...msg, content: fullContent, isStreaming: false }
            : msg
        ));
        
        setIsStreaming(false);
        setStreamingMessageId(null);
        onComplete();
        return;
      }

      const nextIndex = Math.min(currentIndex + CHUNK_SIZE, fullContent.length);
      const newContent = fullContent.substring(0, nextIndex);
      
      streamingRef.current.currentIndex = nextIndex;
      
      setMessages(prev => prev.map(msg => 
        msg.id === messageId 
          ? { ...msg, content: newContent }
          : msg
      ));
    }, TYPING_SPEED);
  }, []);

  // ============================================
  // Fonction: Arrêter le streaming
  // ============================================
  const stopStreaming = useCallback(() => {
    if (streamingRef.current.intervalId) {
      clearInterval(streamingRef.current.intervalId);
      streamingRef.current.intervalId = null;
    }
    
    if (streamingMessageId) {
      setMessages(prev => prev.map(msg => 
        msg.id === streamingMessageId 
          ? { ...msg, content: streamingRef.current.fullContent, isStreaming: false }
          : msg
      ));
    }
    
    setIsStreaming(false);
    setStreamingMessageId(null);
  }, [streamingMessageId]);

  // ============================================
  // Fonction: Charger les messages d'une conversation
  // ============================================
  const loadMessages = useCallback(async (conversationId: string) => {
    const { data, error } = await supabase
      .from('deal_conversation_messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true });
    
    if (error) {
      console.error('Error loading messages:', error);
      return;
    }
    
    setMessages(data as DealMessage[]);
  }, []);

  // ============================================
  // Fonction: Envoyer un message
  // ============================================
  const sendMessage = useCallback(async (content: string) => {
    if (!content.trim() || !user || !dealId || isLoading || isStreaming) return;
    
    setIsLoading(true);
    
    try {
      let conversationId = activeConversationId;
      
      if (!conversationId) {
        const { data: newConv, error: convError } = await supabase
          .from('deal_conversations')
          .insert({
            deal_id: dealId,
            user_id: user.id,
            title: content.substring(0, 50) + (content.length > 50 ? '...' : ''),
          })
          .select()
          .single();
        
        if (convError) throw convError;
        conversationId = newConv.id;
        setActiveConversationId(conversationId);
        queryClient.invalidateQueries({ queryKey: ['deal-conversations', dealId] });
      }
      
      const { data: savedUserMsg, error: userMsgError } = await supabase
        .from('deal_conversation_messages')
        .insert({
          conversation_id: conversationId,
          role: 'user',
          content: content,
          attachments: [],
        })
        .select()
        .single();
      
      if (userMsgError) throw userMsgError;
      
      setMessages(prev => [...prev, savedUserMsg as DealMessage]);
      
      const response = await fetch(DEAL_CHAT_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: content,
          user_id: user.id,
          conversation_id: conversationId,
          deal_id: dealId,
          company_name: companyName || '',
        }),
      });
      
      if (!response.ok) {
        throw new Error(`Erreur serveur: ${response.status}`);
      }
      
      const data = await response.json();
      
      let assistantContent: string;
      
      if (Array.isArray(data) && data.length > 0) {
        assistantContent = data[0].message || data[0].output || data[0].response || '';
      } else if (data && typeof data === 'object') {
        assistantContent = data.message || data.output || data.response || '';
      } else {
        throw new Error('Format de réponse invalide');
      }
      
      if (!assistantContent || assistantContent.trim() === '') {
        assistantContent = "Je n'ai pas pu générer de réponse. Veuillez réessayer.";
      }

      setIsLoading(false);
      
      const tempMessageId = `streaming-${Date.now()}`;
      
      simulateStreaming(tempMessageId, assistantContent, conversationId, async () => {
        try {
          const { data: savedAssistantMsg, error: assistantMsgError } = await supabase
            .from('deal_conversation_messages')
            .insert({
              conversation_id: conversationId,
              role: 'assistant',
              content: assistantContent,
              attachments: [],
            })
            .select()
            .single();
          
          if (assistantMsgError) {
            console.error('Erreur sauvegarde message:', assistantMsgError);
          } else {
            setMessages(prev => prev.map(msg => 
              msg.id === tempMessageId ? (savedAssistantMsg as DealMessage) : msg
            ));
          }
          
          await supabase
            .from('deal_conversations')
            .update({ updated_at: new Date().toISOString() })
            .eq('id', conversationId);
            
        } catch (err) {
          console.error('Erreur sauvegarde:', err);
        }
      });
      
    } catch (error: any) {
      console.error('Erreur chat deal:', error);
      toast.error(error.message || 'Erreur de connexion');
      setIsLoading(false);
    }
  }, [activeConversationId, dealId, user, isLoading, isStreaming, queryClient, simulateStreaming]);

  // ============================================
  // Fonction: Sélectionner une conversation
  // ============================================
  const selectConversation = useCallback((conversationId: string | null) => {
    stopStreaming();
    
    setActiveConversationId(conversationId);
    if (conversationId) {
      loadMessages(conversationId);
    } else {
      setMessages([]);
    }
  }, [loadMessages, stopStreaming]);

  // ============================================
  // Fonction: Créer une nouvelle conversation
  // ============================================
  const createNewConversation = useCallback(() => {
    stopStreaming();
    setActiveConversationId(null);
    setMessages([]);
  }, [stopStreaming]);

  // ============================================
  // Fonction: Supprimer une conversation
  // ============================================
  const deleteConversation = useCallback(async (conversationId: string) => {
    try {
      await supabase
        .from('deal_conversation_messages')
        .delete()
        .eq('conversation_id', conversationId);
      
      const { error } = await supabase
        .from('deal_conversations')
        .delete()
        .eq('id', conversationId);
      
      if (error) throw error;
      
      queryClient.invalidateQueries({ queryKey: ['deal-conversations', dealId] });
      
      if (activeConversationId === conversationId) {
        setActiveConversationId(null);
        setMessages([]);
      }
      
      toast.success('Conversation supprimée');
    } catch (error) {
      console.error('Error deleting conversation:', error);
      toast.error('Erreur lors de la suppression');
    }
  }, [dealId, activeConversationId, queryClient]);

  // ============================================
  // Return
  // ============================================
  return {
    conversations,
    isLoadingConversations,
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
  };
}
