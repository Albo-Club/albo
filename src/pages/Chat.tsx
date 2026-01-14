import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';
import { Send, Paperclip, Save, Plus, MessageSquare, Star, Trash2, Loader2 } from 'lucide-react';
import { LoadingDots } from '@/components/ui/LoadingDots';
import { useAuth } from '@/contexts/AuthContext';

interface Conversation {
  id: string;
  title: string;
  source: 'chat' | 'email';
  updated_at: string;
  expires_at: string | null;
  is_saved_as_deal?: boolean;
}

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  attachments: Array<{ name: string; type: string; size: number; storage_path?: string }>;
  created_at: string;
}

const Chat = () => {
  const { conversationId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Charger les conversations
  useEffect(() => {
    if (user) {
      loadConversations();
    }
  }, [user]);

  // Charger les messages quand conversation change
  useEffect(() => {
    if (conversationId) {
      loadMessages(conversationId);
    } else {
      setMessages([]);
    }
  }, [conversationId]);

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const loadConversations = async () => {
    const { data } = await supabase
      .from('conversations')
      .select('*')
      .order('updated_at', { ascending: false });
    
    if (data) setConversations(data as Conversation[]);
  };

  const loadMessages = async (convId: string) => {
    const { data } = await supabase
      .from('conversation_messages')
      .select('*')
      .eq('conversation_id', convId)
      .order('created_at', { ascending: true });
    
    if (data) setMessages(data as Message[]);
  };

  const handleNewConversation = () => {
    navigate('/chat');
    setMessages([]);
    setInput('');
    setFile(null);
  };

  const handleSend = async () => {
    if (!input.trim() && !file) return;
    if (!user) {
      toast.error('Vous devez être connecté');
      return;
    }
    
    setLoading(true);
    const currentInput = input;
    setInput('');
    
    try {
      // 1. Créer/Récupérer la conversation dans Supabase
      let activeConversationId = conversationId;
      
      if (!activeConversationId) {
        const { data: newConv, error: convError } = await supabase
          .from('conversations')
          .insert({
            user_id: user.id,
            title: currentInput.substring(0, 50),
            source: 'chat'
          })
          .select()
          .single();
        
        if (convError) throw convError;
        activeConversationId = newConv.id;
        navigate(`/chat/${activeConversationId}`, { replace: true });
      }
      
      // 2. Sauvegarder le message user dans Supabase
      const { data: savedUserMsg, error: userMsgError } = await supabase
        .from('conversation_messages')
        .insert({
          conversation_id: activeConversationId,
          role: 'user',
          content: currentInput,
          attachments: file ? [{ name: file.name, type: file.type, size: file.size }] : []
        })
        .select()
        .single();
      
      if (userMsgError) throw userMsgError;
      
      // Afficher immédiatement le message user dans l'UI
      setMessages(prev => [...prev, savedUserMsg as Message]);
      
      // 3. Appeler le webhook N8N pour obtenir la réponse IA
      const response = await fetch(
        'https://n8n.alboteam.com/webhook/6d0211b4-a08d-45b3-a20d-1b717f7713df',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: currentInput,
            user_id: user.id,
            conversation_id: activeConversationId
          })
        }
      );

      if (!response.ok) throw new Error('Erreur de connexion au serveur');

      const data = await response.json();
      console.log('🔍 Raw N8N response:', data);
      
      // Parser correctement selon le format N8N (array ou objet)
      let assistantContent: string;
      
      if (Array.isArray(data) && data.length > 0) {
        // Format: [{ message: "...", conversation_id: "..." }]
        assistantContent = data[0].message || data[0].output || data[0].response;
      } else if (data && typeof data === 'object') {
        // Format: { message: "...", conversation_id: "..." }
        assistantContent = data.message || data.output || data.response;
      } else {
        console.error('Format N8N inattendu:', data);
        throw new Error('Format de réponse invalide');
      }
      
      if (!assistantContent || assistantContent.trim() === '') {
        throw new Error('Réponse IA vide');
      }
      
      // 4. Sauvegarder le message assistant dans Supabase
      const { data: savedAssistantMsg, error: aiMsgError } = await supabase
        .from('conversation_messages')
        .insert({
          conversation_id: activeConversationId,
          role: 'assistant',
          content: assistantContent,
          attachments: []
        })
        .select()
        .single();
      
      if (aiMsgError) throw aiMsgError;
      
      // Afficher le message assistant dans l'UI
      setMessages(prev => [...prev, savedAssistantMsg as Message]);
      
      // Mettre à jour updated_at de la conversation
      await supabase
        .from('conversations')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', activeConversationId);
      
      loadConversations();
    } catch (error: any) {
      console.error('Erreur chat:', error);
      toast.error(error.message || 'Erreur de connexion');
    } finally {
      setLoading(false);
      setFile(null);
    }
  };

  const handleSaveAsDeal = async () => {
    if (!conversationId) return;
    
    try {
      const { data, error } = await supabase.rpc('save_conversation_as_deal', {
        p_conversation_id: conversationId
      });
      
      if (error) throw error;
      
      toast.success('Conversation sauvegardée comme Deal !');
      loadConversations();
    } catch (error: any) {
      toast.error(error.message || 'Erreur lors de la sauvegarde');
    }
  };

  const handleDeleteConversation = async (convId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Supprimer cette conversation ?')) return;
    
    await supabase.from('conversations').delete().eq('id', convId);
    
    if (conversationId === convId) {
      navigate('/chat');
    }
    loadConversations();
  };

  const currentConversation = conversations.find(c => c.id === conversationId);
  const isPermanent = currentConversation && !currentConversation.expires_at;
  const isSavedAsDeal = currentConversation?.is_saved_as_deal ?? false;
  const temporaryConversations = conversations.filter(c => c.expires_at);
  const permanentConversations = conversations.filter(c => !c.expires_at);

  return (
    <div className="flex h-[calc(100vh-4rem)] bg-background">
      {/* Sidebar */}
      <div className="w-72 border-r border-border bg-muted/30 flex flex-col">
        <div className="p-4">
          <Button 
            onClick={handleNewConversation} 
            className="w-full gap-2"
            variant="default"
          >
            <Plus className="h-4 w-4" />
            Nouvelle conversation
          </Button>
        </div>
        
        <ScrollArea className="flex-1 px-2">
          <div className="space-y-4 pb-4">
            {temporaryConversations.length > 0 && (
              <div>
                <h3 className="px-3 py-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Conversations
                </h3>
                <div className="space-y-1">
                  {temporaryConversations.map(conv => (
                    <div
                      key={conv.id}
                      onClick={() => navigate(`/chat/${conv.id}`)}
                      className={`group flex items-center justify-between px-3 py-2 rounded-md cursor-pointer transition-colors ${
                        conversationId === conv.id 
                          ? 'bg-primary/10 text-primary' 
                          : 'hover:bg-muted text-foreground'
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        {conv.source === 'email' && <span>✉️</span>}
                        <MessageSquare className="h-4 w-4 shrink-0" />
                        <span className="truncate text-sm">{conv.title}</span>
                      </div>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={(e) => handleDeleteConversation(conv.id, e)}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            {permanentConversations.length > 0 && (
              <div>
                <h3 className="px-3 py-2 text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                  <Star className="h-3 w-3" /> Mes Deals
                </h3>
                <div className="space-y-1">
                  {permanentConversations.map(conv => (
                    <div
                      key={conv.id}
                      onClick={() => navigate(`/chat/${conv.id}`)}
                      className={`flex items-center gap-2 px-3 py-2 rounded-md cursor-pointer transition-colors ${
                        conversationId === conv.id 
                          ? 'bg-primary/10 text-primary' 
                          : 'hover:bg-muted text-foreground'
                      }`}
                    >
                      <Star className="h-4 w-4 shrink-0 text-yellow-500" />
                      <span className="truncate text-sm">{conv.title}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </ScrollArea>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <div className="h-14 border-b border-border flex items-center justify-between px-6 shrink-0">
          <h2 className="font-semibold truncate">
            {currentConversation?.title || 'Nouvelle conversation'}
          </h2>
          {conversationId && !isSavedAsDeal && (
            <Button variant="outline" size="sm" onClick={handleSaveAsDeal} className="gap-2">
              <Save className="h-4 w-4" />
              Sauvegarder comme Deal
            </Button>
          )}
        </div>

        {/* Messages */}
        <ScrollArea className="flex-1">
          <div className="max-w-3xl mx-auto py-6 px-4 space-y-6">
            {messages.length === 0 && !loading && (
              <div className="text-center py-20">
                <MessageSquare className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
                <h3 className="text-lg font-medium text-foreground mb-2">Commencez une conversation</h3>
                <p className="text-muted-foreground">Envoyez un message ou uploadez un pitch deck</p>
              </div>
            )}
            
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                    msg.role === 'user'
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-foreground'
                  }`}
                >
                  {msg.attachments?.length > 0 && (
                    <div className="flex items-center gap-2 mb-2 text-sm opacity-80">
                      <Paperclip className="h-3 w-3" />
                      {msg.attachments.map((a, i) => (
                        <span key={i} className="truncate">{a.name}</span>
                      ))}
                    </div>
                  )}
                  <p className="whitespace-pre-wrap">{msg.content}</p>
                </div>
              </div>
            ))}
            
            {/* Loading indicator */}
            {loading && (
              <div className="flex justify-start">
                <div className="max-w-[80%] rounded-2xl px-4 py-3 bg-muted">
                  <div className="flex items-center gap-3 text-muted-foreground">
                    <LoadingDots />
                    <span className="text-sm">L'agent analyse votre question...</span>
                  </div>
                </div>
              </div>
            )}
            
            <div ref={messagesEndRef} />
          </div>
        </ScrollArea>

        {/* Input */}
        <div className="border-t border-border p-4 shrink-0">
          <div className="max-w-3xl mx-auto flex items-center gap-2">
            <input
              type="file"
              ref={fileInputRef}
              className="hidden"
              accept=".pdf,.doc,.docx,.ppt,.pptx"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
            />
            
            <Button
              variant="ghost"
              size="icon"
              onClick={() => fileInputRef.current?.click()}
              disabled={loading}
              className="shrink-0"
            >
              <Paperclip className="h-5 w-5" />
            </Button>
            
            <div className="flex-1 relative">
              <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
                placeholder={file ? `📎 ${file.name} - Ajoutez un message...` : "Décrivez une startup ou uploadez un deck..."}
                disabled={loading}
                className="pr-10"
              />
              {file && (
                <button
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-xs bg-muted px-2 py-0.5 rounded hover:bg-muted-foreground/20"
                  onClick={() => setFile(null)}
                >
                  ✕
                </button>
              )}
            </div>
            
            <Button 
              onClick={handleSend} 
              disabled={loading || (!input.trim() && !file)}
              size="icon"
              className="shrink-0"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Chat;
