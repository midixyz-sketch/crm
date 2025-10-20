import { useState, useEffect, useRef } from 'react';
import { X, Search, Send, Paperclip, Phone, Video, MoreVertical } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useQuery, useMutation } from '@tanstack/react-query';
import { format } from 'date-fns';
import { he } from 'date-fns/locale';
import { queryClient } from '@/lib/queryClient';

interface WhatsAppChatPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

interface Chat {
  id: string;
  remoteJid: string;
  name: string;
  profilePicUrl?: string;
  lastMessageAt: string;
  lastMessagePreview: string;
  unreadCount: number;
}

interface Message {
  id: string;
  messageId: string;
  fromMe: boolean;
  senderName: string;
  messageText: string;
  messageType: string;
  fileName?: string;
  timestamp: string;
}

export function WhatsAppChatPanel({ isOpen, onClose }: WhatsAppChatPanelProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedChat, setSelectedChat] = useState<Chat | null>(null);
  const [newMessage, setNewMessage] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Fetch chats
  const { data: chats = [], isLoading: chatsLoading } = useQuery<Chat[]>({
    queryKey: ['/api/whatsapp/chats'],
    enabled: isOpen,
    refetchInterval: 5000, // Refresh every 5 seconds
  });

  // Fetch messages for selected chat
  const { data: messages = [], isLoading: messagesLoading } = useQuery<Message[]>({
    queryKey: ['/api/whatsapp/messages', selectedChat?.remoteJid],
    enabled: !!selectedChat,
    refetchInterval: 3000, // Refresh every 3 seconds
  });

  // Send message mutation
  const sendMessageMutation = useMutation({
    mutationFn: async ({ to, text }: { to: string; text: string }) => {
      const response = await fetch('/api/whatsapp/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to, text }),
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to send message');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/whatsapp/messages', selectedChat?.remoteJid] });
      queryClient.invalidateQueries({ queryKey: ['/api/whatsapp/chats'] });
      setNewMessage('');
    },
  });

  // Mark messages as read
  const markAsReadMutation = useMutation({
    mutationFn: async (remoteJid: string) => {
      const response = await fetch(`/api/whatsapp/mark-read/${remoteJid}`, {
        method: 'POST',
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to mark as read');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/whatsapp/chats'] });
    },
  });

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Mark chat as read when selected
  useEffect(() => {
    if (selectedChat && selectedChat.unreadCount > 0) {
      markAsReadMutation.mutate(selectedChat.remoteJid);
    }
  }, [selectedChat?.id]);

  // Listen for external chat open requests
  useEffect(() => {
    const handleOpenChat = (event: CustomEvent<{ remoteJid: string }>) => {
      const chat = chats.find((c) => c.remoteJid === event.detail.remoteJid);
      if (chat) {
        setSelectedChat(chat);
      }
    };

    window.addEventListener('whatsapp:openChat' as any, handleOpenChat);

    return () => {
      window.removeEventListener('whatsapp:openChat' as any, handleOpenChat);
    };
  }, [chats]);

  // Filter chats by search
  const filteredChats = chats.filter(chat =>
    (chat.name || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Handle send message
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !selectedChat) return;

    sendMessageMutation.mutate({
      to: selectedChat.remoteJid,
      text: newMessage,
    });
  };

  if (!isOpen) return null;

  return (
    <div 
      className="fixed left-0 top-0 h-full w-96 bg-white dark:bg-gray-900 shadow-2xl z-40 flex flex-col border-r border-gray-200 dark:border-gray-700"
      dir="rtl"
      data-testid="whatsapp-chat-panel"
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700 bg-green-600 text-white">
        <h2 className="text-lg font-semibold">WhatsApp</h2>
        <Button
          variant="ghost"
          size="sm"
          onClick={onClose}
          className="text-white hover:bg-green-700"
          data-testid="button-close-panel"
        >
          <X className="h-5 w-5" />
        </Button>
      </div>

      {selectedChat ? (
        // Chat View
        <div className="flex flex-col flex-1">
          {/* Chat Header */}
          <div className="flex items-center justify-between p-3 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelectedChat(null)}
                data-testid="button-back-to-chats"
              >
                ←
              </Button>
              <Avatar className="h-10 w-10">
                <AvatarImage src={selectedChat.profilePicUrl} />
                <AvatarFallback className="bg-green-500 text-white">
                  {selectedChat.name.charAt(0)}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <p className="font-medium text-sm">{selectedChat.name}</p>
                <p className="text-xs text-gray-500">מקוון</p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="ghost" size="sm"><Phone className="h-4 w-4" /></Button>
              <Button variant="ghost" size="sm"><Video className="h-4 w-4" /></Button>
              <Button variant="ghost" size="sm"><MoreVertical className="h-4 w-4" /></Button>
            </div>
          </div>

          {/* Messages */}
          <ScrollArea className="flex-1 p-4 bg-gray-100 dark:bg-gray-800">
            {messagesLoading ? (
              <div className="text-center py-8">טוען הודעות...</div>
            ) : (
              <div className="space-y-2">
                {messages.map((message) => (
                  <div
                    key={message.id}
                    className={`flex ${message.fromMe ? 'justify-end' : 'justify-start'}`}
                    data-testid={`message-${message.id}`}
                  >
                    <div
                      className={`max-w-[70%] rounded-2xl p-3 shadow-sm ${
                        message.fromMe
                          ? 'bg-green-500 text-white'
                          : 'bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100'
                      }`}
                    >
                      {message.messageType === 'document' && message.fileName && (
                        <div className="flex items-center gap-2 mb-1">
                          <Paperclip className="h-4 w-4" />
                          <span className="text-sm">{message.fileName}</span>
                        </div>
                      )}
                      <p className="text-sm">{message.messageText}</p>
                      <span className="text-xs opacity-70 mt-1 block text-left">
                        {format(new Date(message.timestamp), 'HH:mm', { locale: he })}
                      </span>
                    </div>
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>
            )}
          </ScrollArea>

          {/* Message Input */}
          <form onSubmit={handleSendMessage} className="p-3 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
            <div className="flex gap-2">
              <Button type="button" variant="ghost" size="sm">
                <Paperclip className="h-5 w-5" />
              </Button>
              <Input
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                placeholder="הקלד הודעה..."
                className="flex-1"
                data-testid="input-message"
              />
              <Button
                type="submit"
                disabled={!newMessage.trim() || sendMessageMutation.isPending}
                className="bg-green-500 hover:bg-green-600"
                data-testid="button-send-message"
              >
                <Send className="h-5 w-5" />
              </Button>
            </div>
          </form>
        </div>
      ) : (
        // Chats List View
        <>
          {/* Search */}
          <div className="p-3 border-b border-gray-200 dark:border-gray-700">
            <div className="relative">
              <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="חפש שיחה..."
                className="pr-10"
                data-testid="input-search-chats"
              />
            </div>
          </div>

          {/* Chats List */}
          <ScrollArea className="flex-1">
            {chatsLoading ? (
              <div className="text-center py-8">טוען שיחות...</div>
            ) : filteredChats.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                {searchQuery ? 'לא נמצאו שיחות' : 'אין שיחות פעילות'}
              </div>
            ) : (
              <div>
                {filteredChats.map((chat) => (
                  <button
                    key={chat.id}
                    onClick={() => setSelectedChat(chat)}
                    className="w-full flex items-center gap-3 p-3 hover:bg-gray-50 dark:hover:bg-gray-800 border-b border-gray-200 dark:border-gray-700 text-right transition-colors"
                    data-testid={`chat-${chat.id}`}
                  >
                    <Avatar className="h-12 w-12">
                      <AvatarImage src={chat.profilePicUrl} />
                      <AvatarFallback className="bg-green-500 text-white">
                        {chat.name.charAt(0)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <p className="font-medium text-sm truncate">{chat.name}</p>
                        <span className="text-xs text-gray-500">
                          {chat.lastMessageAt
                            ? format(new Date(chat.lastMessageAt), 'HH:mm', { locale: he })
                            : ''}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <p className="text-sm text-gray-500 truncate">
                          {chat.lastMessagePreview}
                        </p>
                        {chat.unreadCount > 0 && (
                          <span className="bg-green-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                            {chat.unreadCount}
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </ScrollArea>
        </>
      )}
    </div>
  );
}
