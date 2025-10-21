import { useState, useEffect, useRef, useMemo } from 'react';
import { X, Search, Send, Paperclip, Phone, Video, MoreVertical, Pin, PinOff, Tag, Archive, User, Users, Archive as ArchiveIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { useQuery, useMutation } from '@tanstack/react-query';
import { format } from 'date-fns';
import { he } from 'date-fns/locale';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';

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
  chatType?: 'individual' | 'group' | 'archived';
  isPinned?: boolean;
  tags?: string[];
  candidateId?: string;
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
  const [activeTab, setActiveTab] = useState<'individual' | 'group' | 'archived'>('individual');
  const [selectedTagFilter, setSelectedTagFilter] = useState<string | null>(null);
  const [tagsDialogOpen, setTagsDialogOpen] = useState(false);
  const [newTag, setNewTag] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  // Fetch chats
  const { data: chats = [], isLoading: chatsLoading } = useQuery<Chat[]>({
    queryKey: ['/api/whatsapp/chats'],
    enabled: isOpen,
    refetchInterval: 5000,
  });

  // Fetch messages for selected chat
  const { data: messages = [], isLoading: messagesLoading } = useQuery<Message[]>({
    queryKey: ['/api/whatsapp/messages', selectedChat?.remoteJid],
    enabled: !!selectedChat,
    refetchInterval: 3000,
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

  // Update chat mutation (for pin/archive/tags)
  const updateChatMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<Chat> }) => {
      return apiRequest('PATCH', `/api/whatsapp/chats/${id}`, updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/whatsapp/chats'] });
      toast({
        title: 'עודכן בהצלחה',
        description: 'השיחה עודכנה',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'שגיאה',
        description: error.message || 'לא ניתן לעדכן את השיחה',
        variant: 'destructive',
      });
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

  // Toggle pin mutation
  const togglePinMutation = useMutation({
    mutationFn: async ({ candidateId, isPinned }: { candidateId: string; isPinned: boolean }) => {
      return apiRequest(`/api/candidates/${candidateId}`, {
        method: 'PATCH',
        body: JSON.stringify({ isPinned }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/whatsapp/chats'] });
      toast({
        title: 'עודכן בהצלחה',
        description: 'השיחה עודכנה',
      });
    },
  });

  // Update tags mutation
  const updateTagsMutation = useMutation({
    mutationFn: async ({ candidateId, tags }: { candidateId: string; tags: string[] }) => {
      return apiRequest(`/api/candidates/${candidateId}`, {
        method: 'PATCH',
        body: JSON.stringify({ tags }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/whatsapp/chats'] });
      toast({
        title: 'תגיות עודכנו',
        description: 'התגיות נשמרו בהצלחה',
      });
    },
  });

  // Toggle archive mutation
  const toggleArchiveMutation = useMutation({
    mutationFn: async ({ candidateId, chatType, previousChatType }: { candidateId: string; chatType: string; previousChatType?: string }) => {
      return apiRequest(`/api/candidates/${candidateId}`, {
        method: 'PATCH',
        body: JSON.stringify({ chatType, previousChatType }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/whatsapp/chats'] });
      setSelectedChat(null);
      toast({
        title: selectedChat?.chatType === 'archived' ? 'שוחזר מהארכיון' : 'הועבר לארכיון',
        description: selectedChat?.chatType === 'archived' ? 'השיחה שוחזרה בהצלחה' : 'השיחה הועברה לארכיון',
      });
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

  // Get unique tags
  const allTags = useMemo(() => {
    const tagsSet = new Set<string>();
    chats.forEach(chat => {
      (chat.tags || []).forEach(tag => tagsSet.add(tag));
    });
    return Array.from(tagsSet).sort((a, b) => a.localeCompare(b, 'he'));
  }, [chats]);

  // Filter chats by tab, search, and tags
  const filteredChats = useMemo(() => {
    let filtered = chats.filter(chat => {
      if (activeTab === 'individual') {
        return !chat.isGroup && !chat.isArchived;
      } else if (activeTab === 'group') {
        return chat.isGroup && !chat.isArchived;
      } else if (activeTab === 'archived') {
        return chat.isArchived;
      }
      return false;
    });

    // Apply search filter
    if (searchQuery) {
      filtered = filtered.filter(chat => {
        const nameMatch = (chat.name || '').toLowerCase().includes(searchQuery.toLowerCase());
        const phoneMatch = (chat.remoteJid || '').toLowerCase().includes(searchQuery.toLowerCase());
        const tagMatch = (chat.tags || []).some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()));
        return nameMatch || phoneMatch || tagMatch;
      });
    }

    // Apply tag filter
    if (selectedTagFilter) {
      filtered = filtered.filter(chat => (chat.tags || []).includes(selectedTagFilter));
    }

    // Sort: pinned first, then by last message time
    return filtered.sort((a, b) => {
      if (a.isPinned && !b.isPinned) return -1;
      if (!a.isPinned && b.isPinned) return 1;
      return new Date(b.lastMessageAt || 0).getTime() - new Date(a.lastMessageAt || 0).getTime();
    });
  }, [chats, activeTab, searchQuery, selectedTagFilter]);

  // Handle send message
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !selectedChat) return;

    sendMessageMutation.mutate({
      to: selectedChat.remoteJid,
      text: newMessage,
    });
  };

  // Handle toggle pin
  const handleTogglePin = () => {
    if (!selectedChat?.candidateId) return;
    togglePinMutation.mutate({
      candidateId: selectedChat.candidateId,
      isPinned: !selectedChat.isPinned,
    });
  };

  // Handle toggle archive
  const handleToggleArchive = () => {
    if (!selectedChat?.candidateId) return;
    const isCurrentlyArchived = selectedChat.chatType === 'archived';
    
    toggleArchiveMutation.mutate({
      candidateId: selectedChat.candidateId,
      chatType: isCurrentlyArchived ? (selectedChat as any).previousChatType || 'individual' : 'archived',
      previousChatType: isCurrentlyArchived ? undefined : selectedChat.chatType || 'individual',
    });
  };

  // Handle add tag
  const handleAddTag = () => {
    if (!selectedChat || !newTag.trim()) return;
    const currentTags = selectedChat.tags || [];
    if (!currentTags.includes(newTag.trim())) {
      updateChatMutation.mutate({
        id: selectedChat.id,
        updates: {
          tags: [...currentTags, newTag.trim()],
        },
      });
      setNewTag('');
    }
  };

  // Handle remove tag
  const handleRemoveTag = (tag: string) => {
    if (!selectedChat) return;
    const currentTags = selectedChat.tags || [];
    updateChatMutation.mutate({
      id: selectedChat.id,
      updates: {
        tags: currentTags.filter(t => t !== tag),
      },
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
            <div className="flex items-center gap-3 flex-1">
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
                <AvatarFallback className="bg-green-500 text-white"></AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm truncate">{selectedChat.name}</p>
                <p className="text-xs text-gray-500">מקוון</p>
              </div>
            </div>
            <div className="flex gap-1">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button 
                      variant={selectedChat.isPinned ? "secondary" : "ghost"}
                      size="sm"
                      className="h-7 w-7"
                      onClick={handleTogglePin}
                      data-testid="button-pin-header"
                    >
                      <Pin className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">
                    <p>{selectedChat.isPinned ? 'בטל נעיצה' : 'נעץ שיחה'}</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>

              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button 
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7"
                      onClick={() => setTagsDialogOpen(true)}
                      data-testid="button-tags-header"
                    >
                      <Tag className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">
                    <p>נהל תגיות</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>

              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button 
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7"
                      onClick={handleToggleArchive}
                      data-testid="button-archive-header"
                    >
                      <Archive className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">
                    <p>{selectedChat.chatType === 'archived' ? 'שחזר מארכיון' : 'העבר לארכיון'}</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>

              <Button variant="ghost" size="sm" className="h-7 w-7"><Phone className="h-4 w-4" /></Button>
              <Button variant="ghost" size="sm" className="h-7 w-7"><Video className="h-4 w-4" /></Button>
              <Button variant="ghost" size="sm" className="h-7 w-7"><MoreVertical className="h-4 w-4" /></Button>
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
          {/* Tabs */}
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="flex-1 flex flex-col">
            <TabsList className="grid w-full grid-cols-3 bg-gray-100 dark:bg-gray-800">
              <TabsTrigger value="individual" className="gap-2">
                <User className="h-4 w-4" />
                <span>צ'אטים</span>
              </TabsTrigger>
              <TabsTrigger value="group" className="gap-2">
                <Users className="h-4 w-4" />
                <span>קבוצות</span>
              </TabsTrigger>
              <TabsTrigger value="archived" className="gap-2">
                <ArchiveIcon className="h-4 w-4" />
                <span>ארכיון</span>
              </TabsTrigger>
            </TabsList>

            <TabsContent value={activeTab} className="flex-1 flex flex-col mt-0">
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

              {/* Tag Filters */}
              {allTags.length > 0 && (
                <div className="p-3 border-b border-gray-200 dark:border-gray-700">
                  <div className="flex flex-wrap gap-2">
                    <Badge
                      variant={selectedTagFilter === null ? "default" : "outline"}
                      className="cursor-pointer"
                      onClick={() => setSelectedTagFilter(null)}
                    >
                      הכל
                    </Badge>
                    {allTags.map(tag => (
                      <Badge
                        key={tag}
                        variant={selectedTagFilter === tag ? "default" : "outline"}
                        className="cursor-pointer"
                        onClick={() => setSelectedTagFilter(tag)}
                      >
                        {tag}
                      </Badge>
                    ))}
                  </div>
                  <p className="text-xs text-gray-500 mt-2">
                    {filteredChats.length} מתוך {chats.filter(c => {
                      if (activeTab === 'individual') return !c.isGroup && !c.isArchived;
                      if (activeTab === 'group') return c.isGroup && !c.isArchived;
                      if (activeTab === 'archived') return c.isArchived;
                      return false;
                    }).length} שיחות
                  </p>
                </div>
              )}

              {/* Chats List */}
              <ScrollArea className="flex-1">
                {chatsLoading ? (
                  <div className="text-center py-8">טוען שיחות...</div>
                ) : filteredChats.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    {searchQuery || selectedTagFilter ? 'לא נמצאו שיחות' : 'אין שיחות פעילות'}
                  </div>
                ) : (
                  <div>
                    {filteredChats.map((chat) => (
                      <div key={chat.id} className="relative">
                        <button
                          onClick={() => setSelectedChat(chat)}
                          className="w-full flex items-center gap-3 p-3 hover:bg-gray-50 dark:hover:bg-gray-800 border-b border-gray-200 dark:border-gray-700 text-right transition-colors"
                          data-testid={`chat-${chat.id}`}
                        >
                          <Avatar className="h-12 w-12">
                            <AvatarImage src={chat.profilePicUrl} />
                            <AvatarFallback className="bg-green-500 text-white"></AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between mb-1">
                              <div className="flex items-center gap-2">
                                <p className="font-medium text-sm truncate">{chat.name}</p>
                                {chat.isPinned && <Pin className="h-3 w-3 text-amber-500" />}
                              </div>
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
                                <span className="bg-green-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center flex-shrink-0">
                                  {chat.unreadCount}
                                </span>
                              )}
                            </div>
                            {(chat.tags || []).length > 0 && (
                              <div className="flex flex-wrap gap-1 mt-1">
                                {chat.tags!.map(tag => (
                                  <Badge key={tag} variant="secondary" className="text-xs">
                                    {tag}
                                  </Badge>
                                ))}
                              </div>
                            )}
                          </div>
                        </button>
                        
                        {/* Pin and Tags buttons at bottom of chat row */}
                        <div className="absolute bottom-2 left-2 flex gap-1">
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className={cn(
                                    "h-[30px] w-[30px]",
                                    chat.isPinned 
                                      ? "bg-amber-400 dark:bg-amber-600 text-white hover:bg-amber-500 dark:hover:bg-amber-500" 
                                      : "bg-amber-200 dark:bg-amber-800 text-amber-800 dark:text-amber-200 hover:bg-amber-300 dark:hover:bg-amber-700"
                                  )}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    updateChatMutation.mutate({
                                      id: chat.id,
                                      updates: { isPinned: !chat.isPinned }
                                    });
                                  }}
                                  data-testid={`button-pin-${chat.id}`}
                                >
                                  {chat.isPinned ? (
                                    <PinOff className="w-[10px] h-[10px]" />
                                  ) : (
                                    <Pin className="w-[10px] h-[10px]" />
                                  )}
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent side="bottom">
                                <p>{chat.isPinned ? 'בטל נעיצת שיחה' : 'נעץ שיחה למעלה'}</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>

                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="h-[30px] w-[30px] bg-blue-500 dark:bg-blue-600 text-white hover:bg-blue-600 dark:hover:bg-blue-500"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedChat(chat);
                                    setTagsDialogOpen(true);
                                  }}
                                  data-testid={`button-tags-${chat.id}`}
                                >
                                  <Tag className="w-[10px] h-[10px]" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent side="bottom">
                                <p>נהל תגיות למיון ושיוך</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </TabsContent>
          </Tabs>
        </>
      )}

      {/* Tags Management Dialog */}
      <Dialog open={tagsDialogOpen} onOpenChange={setTagsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>ניהול תגיות</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex gap-2">
              <Input
                value={newTag}
                onChange={(e) => setNewTag(e.target.value)}
                placeholder="הוסף תגית חדשה..."
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddTag();
                  }
                }}
              />
              <Button onClick={handleAddTag} disabled={!newTag.trim()}>
                הוסף
              </Button>
            </div>
            <div className="flex flex-wrap gap-2">
              {(selectedChat?.tags || []).map(tag => (
                <Badge key={tag} variant="default" className="gap-2">
                  {tag}
                  <button
                    onClick={() => handleRemoveTag(tag)}
                    className="text-white hover:text-gray-200"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTagsDialogOpen(false)}>
              סגור
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
