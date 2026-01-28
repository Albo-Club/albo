/**
 * usePortfolioChat - Hook pour gérer les conversations IA des portfolio companies
 * 
 * Ce hook gère :
 * - Le chargement des conversations existantes
 * - La création de nouvelles conversations
 * - L'envoi de messages au webhook N8N
 * - La sauvegarde des messages dans Supabase
 */

import { useState, useCallback, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
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
}

// ============================================
// Configuration
// ============================================

// URL du webhook N8N pour le chat portfolio
const PORTFOLIO_CHAT_WEBHOOK_URL = 'https://n8n.alboteam.com/webhook/6d0211b4-a08d-45b3-a20d-1b717f7713df';

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
  
  // États pour le streaming futur
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingContent, setStreamingContent] = useState('');

  // ============================================
  // Query: Charger les conversations de cette company
  // ============================================
  const {
    data: conversations = [],
    isLoading: isLoadingConversations,
    refetch: refetchConversations,
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
  // Query: Charger les messages de la conversation active
  // ============================================
  const {
    data: conversationMessages = [],
    isLoading: isLoadingMessages,
    refetch: refetchMessages,
  } = useQuery({
    queryKey: ['portfolio-messages', activeConversationId],
    queryFn: async () => {
      if (!activeConversationId) return [];
      
      const { data, error } = await supabase
        .from('portfolio_conversation_messages')
        .select('*')
        .eq('conversation_id', activeConversationId)
        .order('created_at', { ascending: true });
      
      if (error) throw error;
      return data as PortfolioMessage[];
    },
    enabled: !!activeConversationId,
  });

  // Mettre à jour l'état local quand les messages changent
  useEffect(() => {
    setMessages(conversationMessages);
  }, [conversationMessages]);

  // ============================================
  // Mutation: Créer une nouvelle conversation
  // ============================================
  const createConversationMutation = useMutation({
    mutationFn: async (title?: string) => {
      if (!companyId || !user) throw new Error('Missing companyId or user');
      
      const { data, error } = await supabase
        .from('portfolio_conversations')
        .insert({
          company_id: companyId,
          user_id: user.id,
          title: title || 'Nouvelle conversation',
        })
        .select()
        .single();
      
      if (error) throw error;
      return data as PortfolioConversation;
    },
    onSuccess: (newConversation) => {
      queryClient.invalidateQueries({ queryKey: ['portfolio-conversations', companyId] });
      setActiveConversationId(newConversation.id);
      setMessages([]);
    },
    onError: (error) => {
      console.error('Error creating conversation:', error);
      toast.error('Erreur lors de la création de la conversation');
    },
  });

  // ============================================
  // Mutation: Supprimer une conversation
  // ============================================
  const deleteConversationMutation = useMutation({
    mutationFn: async (conversationId: string) => {
      const { error } = await supabase
        .from('portfolio_conversations')
        .delete()
        .eq('id', conversationId);
      
      if (error) throw error;
      return conversationId;
    },
    onSuccess: (deletedId) => {
      queryClient.invalidateQueries({ queryKey: ['portfolio-conversations', companyId] });
      if (activeConversationId === deletedId) {
        setActiveConversationId(null);
        setMessages([]);
      }
      toast.success('Conversation supprimée');
    },
    onError: (error) => {
      console.error('Error deleting conversation:', error);
      toast.error('Erreur lors de la suppression');
    },
  });

  // ============================================
  // Mutation: Renommer une conversation
  // ============================================
  const renameConversationMutation = useMutation({
    mutationFn: async ({ conversationId, newTitle }: { conversationId: string; newTitle: string }) => {
      const { error } = await supabase
        .from('portfolio_conversations')
        .update({ title: newTitle })
        .eq('id', conversationId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['portfolio-conversations', companyId] });
    },
  });

  // ============================================
  // Fonction: Envoyer un message
  // ============================================
  const sendMessage = useCallback(async (content: string) => {
    if (!content.trim() || !user || !companyId) return;
    
    setIsLoading(true);
    setStreamingContent('');
    
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
      
      // 4. Sauvegarder la réponse de l'assistant
      const { data: savedAssistantMsg, error: aiMsgError } = await supabase
        .from('portfolio_conversation_messages')
        .insert({
          conversation_id: conversationId,
          role: 'assistant',
          content: assistantContent,
          attachments: [],
        })
        .select()
        .single();
      
      if (aiMsgError) throw aiMsgError;
      
      // Afficher la réponse de l'assistant
      setMessages(prev => [...prev, savedAssistantMsg as PortfolioMessage]);
      
      // Mettre à jour le timestamp de la conversation
      await supabase
        .from('portfolio_conversations')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', conversationId);
      
    } catch (error: any) {
      console.error('Erreur chat portfolio:', error);
      toast.error(error.message || 'Erreur de connexion');
    } finally {
      setIsLoading(false);
      setIsStreaming(false);
    }
  }, [activeConversationId, companyId, user, queryClient]);

  // ============================================
  // Fonction: Sélectionner une conversation
  // ============================================
  const selectConversation = useCallback((conversationId: string | null) => {
    setActiveConversationId(conversationId);
    if (!conversationId) {
      setMessages([]);
    }
  }, []);

  // ============================================
  // Fonction: Créer une nouvelle conversation
  // ============================================
  const createNewConversation = useCallback(() => {
    setActiveConversationId(null);
    setMessages([]);
  }, []);

  // ============================================
  // Return
  // ============================================
  return {
    // État
    conversations,
    messages,
    activeConversationId,
    isLoading,
    isLoadingConversations,
    isLoadingMessages,
    
    // Streaming (préparé pour le futur)
    isStreaming,
    streamingContent,
    
    // Actions
    sendMessage,
    selectConversation,
    createNewConversation,
    createConversation: createConversationMutation.mutate,
    deleteConversation: deleteConversationMutation.mutate,
    renameConversation: renameConversationMutation.mutate,
    
    // Mutations states
    isCreating: createConversationMutation.isPending,
    isDeleting: deleteConversationMutation.isPending,
  };
}
