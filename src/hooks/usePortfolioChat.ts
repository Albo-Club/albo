/**
 * usePortfolioChat - Hook pour gérer les conversations IA des portfolio companies
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

export interface PortfolioConversation {
  id: string;
  company_id: string;
  user_id: string;
  title: string;
  created_at: string;
  updated_at: string;
}

export interface PortfolioMessage {
  id: string;
  conversation_id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  attachments: any[];
  created_at: string;
  isStreaming?: boolean; // Indique si le message est en cours de streaming
}

// ============================================
// Configuration
// ============================================

// URL du webhook N8N pour le chat portfolio
const PORTFOLIO_CHAT_WEBHOOK_URL = 'https://n8n.alboteam.com/webhook/6d0211b4-a08d-45b3-a20d-1b717f7713df';

// Configuration du streaming simulé
const TYPING_SPEED = 12; // millisecondes par tick
const CHUNK_SIZE = 4; // nombre de caractères à ajouter par tick

// ============================================
// Hook principal
// ============================================

export function usePortfolioChat(companyId: string | undefined) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  
  // État local
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<PortfolioMessage[]>([]);
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
  // Query: Charger les conversations de cette company
  // ============================================
  const {
    data: conversations = [],
    isLoading: isLoadingConversations,
  } = useQuery({
    queryKey: ['portfolio-conversations', companyId],
    queryFn: async () => {
      if (!companyId || !user) return [];
      
      const { data, error } = await supabase
        .from('portfolio_conversations')
        .select('*')
        .eq('company_id', companyId)
        .order('updated_at', { ascending: false });
      
      if (error) throw error;
      return data as PortfolioConversation[];
    },
    enabled: !!companyId && !!user,
  });

  // ============================================
  // Fonction: Simuler le streaming (effet machine à écrire)
  // ============================================
  const simulateStreaming = useCallback((
    messageId: string, 
    fullContent: string,
    conversationId: string,
    onComplete: () => void
  ) => {
    // Cleanup précédent
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

    // Créer le message vide avec flag streaming
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

    // Streaming progressif
    streamingRef.current.intervalId = setInterval(() => {
      const { fullContent, currentIndex } = streamingRef.current;
      
      if (currentIndex >= fullContent.length) {
        // Streaming terminé
        if (streamingRef.current.intervalId) {
          clearInterval(streamingRef.current.intervalId);
          streamingRef.current.intervalId = null;
        }
        
        // Mettre à jour le message final (sans flag streaming)
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

      // Ajouter les prochains caractères
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
    
    // Afficher le contenu complet immédiatement
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
      .from('portfolio_conversation_messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true });
    
    if (error) {
      console.error('Error loading messages:', error);
      return;
    }
    
    setMessages(data as PortfolioMessage[]);
  }, []);

  // ============================================
  // Fonction: Envoyer un message
  // ============================================
  const sendMessage = useCallback(async (content: string) => {
    if (!content.trim() || !user || !companyId || isLoading || isStreaming) return;
    
    setIsLoading(true);
    
    try {
      // 1. Créer une conversation si nécessaire
      let conversationId = activeConversationId;
      
      if (!conversationId) {
        const { data: newConv, error: convError } = await supabase
          .from('portfolio_conversations')
          .insert({
            company_id: companyId,
            user_id: user.id,
            title: content.substring(0, 50) + (content.length > 50 ? '...' : ''),
          })
          .select()
          .single();
        
        if (convError) throw convError;
        conversationId = newConv.id;
        setActiveConversationId(conversationId);
        queryClient.invalidateQueries({ queryKey: ['portfolio-conversations', companyId] });
      }
      
      // 2. Sauvegarder le message utilisateur
      const { data: savedUserMsg, error: userMsgError } = await supabase
        .from('portfolio_conversation_messages')
        .insert({
          conversation_id: conversationId,
          role: 'user',
          content: content,
          attachments: [],
        })
        .select()
        .single();
      
      if (userMsgError) throw userMsgError;
      
      // Afficher immédiatement le message utilisateur
      setMessages(prev => [...prev, savedUserMsg as PortfolioMessage]);
      
      // 3. Appeler le webhook N8N
      const response = await fetch(PORTFOLIO_CHAT_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: content,
          user_id: user.id,
          conversation_id: conversationId,
          portfolio_company_id: companyId,
        }),
      });
      
      if (!response.ok) {
        throw new Error(`Erreur serveur: ${response.status}`);
      }
      
      const data = await response.json();
      
      // Parser la réponse N8N (peut être array ou objet)
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

      // 4. Arrêter le loading, lancer le streaming
      setIsLoading(false);
      
      // 5. Générer un ID temporaire pour le message streaming
      const tempMessageId = `streaming-${Date.now()}`;
      
      // 6. Lancer le streaming simulé
      simulateStreaming(tempMessageId, assistantContent, conversationId, async () => {
        // Callback appelé quand le streaming est terminé
        // Sauvegarder le message assistant dans Supabase
        try {
          const { data: savedAssistantMsg, error: assistantMsgError } = await supabase
            .from('portfolio_conversation_messages')
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
            // Remplacer le message temporaire par le vrai
            setMessages(prev => prev.map(msg => 
              msg.id === tempMessageId ? (savedAssistantMsg as PortfolioMessage) : msg
            ));
          }
          
          // Mettre à jour le timestamp de la conversation
          await supabase
            .from('portfolio_conversations')
            .update({ updated_at: new Date().toISOString() })
            .eq('id', conversationId);
            
        } catch (err) {
          console.error('Erreur sauvegarde:', err);
        }
      });
      
    } catch (error: any) {
      console.error('Erreur chat portfolio:', error);
      toast.error(error.message || 'Erreur de connexion');
      setIsLoading(false);
    }
  }, [activeConversationId, companyId, user, isLoading, isStreaming, queryClient, simulateStreaming]);

  // ============================================
  // Fonction: Sélectionner une conversation
  // ============================================
  const selectConversation = useCallback((conversationId: string | null) => {
    // Arrêter le streaming en cours si besoin
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
      // Supprimer les messages d'abord
      await supabase
        .from('portfolio_conversation_messages')
        .delete()
        .eq('conversation_id', conversationId);
      
      // Puis la conversation
      const { error } = await supabase
        .from('portfolio_conversations')
        .delete()
        .eq('id', conversationId);
      
      if (error) throw error;
      
      // Rafraîchir et reset si c'était la conversation active
      queryClient.invalidateQueries({ queryKey: ['portfolio-conversations', companyId] });
      
      if (activeConversationId === conversationId) {
        setActiveConversationId(null);
        setMessages([]);
      }
      
      toast.success('Conversation supprimée');
    } catch (error) {
      console.error('Error deleting conversation:', error);
      toast.error('Erreur lors de la suppression');
    }
  }, [companyId, activeConversationId, queryClient]);

  // ============================================
  // Return
  // ============================================
  return {
    // Conversations
    conversations,
    isLoadingConversations,
    
    // Messages
    messages,
    activeConversationId,
    
    // États
    isLoading,
    isStreaming,
    streamingMessageId,
    
    // Actions
    sendMessage,
    selectConversation,
    createNewConversation,
    deleteConversation,
    stopStreaming,
  };
}
