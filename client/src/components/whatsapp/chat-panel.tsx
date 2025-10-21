import { useState, useEffect, useRef, useMemo } from 'react';
import { X, Search, Send, Pin, PinOff, Tag, Archive as ArchiveIcon, User, Users, Minimize2, MoreVertical, Trash2, ArchiveRestore, Bell, BellOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useQuery, useMutation } from '@tanstack/react-query';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { he } from 'date-fns/locale';

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
  isPinned?: boolean;
  isGroup?: boolean;
  isArchived?: boolean;
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
  const [activeTab, setActiveTab] = useState<'individual' | 'group' | 'archived'>('group');
  const [selectedTagFilter, setSelectedTagFilter] = useState<string | null>(null);
  const [tagsDialogOpen, setTagsDialogOpen] = useState(false);
  const [newTag, setNewTag] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  // Check connection status
  const { data: status } = useQuery<{ isConnected: boolean }>({
    queryKey: ['/api/whatsapp/status'],
    enabled: isOpen,
    refetchInterval: 3000,
  });

  // Close panel immediately when disconnected
  useEffect(() => {
    if (isOpen && status !== undefined && !status?.isConnected) {
      onClose();
    }
  }, [status?.isConnected, isOpen, onClose]);

  // Fetch chats (with tab filtering on server)
  const { data: chats = [], isLoading: chatsLoading } = useQuery<Chat[]>({
    queryKey: ['/api/whatsapp/chats', activeTab],
    enabled: isOpen,
    refetchInterval: 5000,
    queryFn: async () => {
      const response = await fetch(`/api/whatsapp/chats?tab=${activeTab}&limit=100`);
      if (!response.ok) throw new Error('Failed to fetch chats');
      return response.json();
    },
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
      return await apiRequest('POST', '/api/whatsapp/send-message', { to, message: text });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/whatsapp/messages'] });
      setNewMessage('');
      toast({ title: 'ההודעה נשלחה בהצלחה' });
    },
    onError: (error: any) => {
      toast({ title: 'שגיאה בשליחת הודעה', description: error.message, variant: 'destructive' });
    },
  });

  // Update chat mutation
  const updateChatMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<Chat> }) => {
      return await apiRequest('PATCH', `/api/whatsapp/chats/${id}`, updates);
    },
    onSuccess: async (data, variables) => {
      // Update selectedChat immediately if it was the one that was updated
      if (selectedChat && selectedChat.id === variables.id) {
        setSelectedChat({ ...selectedChat, ...variables.updates });
      }
      // Wait for the query to refresh so the list updates
      await queryClient.invalidateQueries({ queryKey: ['/api/whatsapp/chats'] });
    },
  });

  // Get all unique tags
  const allTags = useMemo(() => {
    const tagsSet = new Set<string>();
    chats.forEach(chat => {
      chat.tags?.forEach(tag => tagsSet.add(tag));
    });
    return Array.from(tagsSet).sort((a, b) => a.localeCompare(b, 'he'));
  }, [chats]);

  // Filter chats by search and tags (tab filtering done on server)
  const filteredChats = useMemo(() => {
    let filtered = chats;

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
      if (!a.lastMessageAt) return 1;
      if (!b.lastMessageAt) return -1;
      return new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime();
    });
  }, [chats, searchQuery, selectedTagFilter]);

  // Auto-scroll to bottom when chat changes
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [selectedChat, messages.length]);

  // Handle send message
  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !selectedChat) return;

    sendMessageMutation.mutate({
      to: selectedChat.remoteJid,
      text: newMessage,
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
    <div className="fixed inset-0 bg-white dark:bg-gray-900 z-40 flex h-screen pt-16" dir="rtl" data-testid="whatsapp-chat-panel">
      {/* Minimize Button - Top Center */}
      <div className="fixed top-20 left-1/2 transform -translate-x-1/2 z-50">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="default"
                size="lg"
                onClick={onClose}
                className="bg-green-500 hover:bg-green-600 text-white rounded-full h-16 w-16 p-0 shadow-2xl hover:scale-110 transition-all"
                data-testid="button-close-panel"
              >
                <Minimize2 className="h-8 w-8" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              <p>מזעור</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      {/* Right Side - Chats List */}
      <div className="w-80 border-l border-gray-200 dark:border-gray-700 flex flex-col bg-background h-full">
        <div className="p-4 border-b border-gray-200 dark:border-gray-700 bg-[#008069] text-white flex-shrink-0">
          <div className="flex items-center gap-3">
            <Avatar className="h-10 w-10">
              <AvatarFallback className="bg-white/20 text-white">WA</AvatarFallback>
            </Avatar>
            <h2 className="text-lg font-semibold">WhatsApp</h2>
          </div>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="flex-1 flex flex-col min-h-0">
          <TabsList className="grid w-full grid-cols-3 bg-gray-100 dark:bg-gray-800 rounded-none flex-shrink-0">
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

          <TabsContent value={activeTab} className="flex-1 flex flex-col mt-0 min-h-0">
            {/* Search */}
            <div className="p-3 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
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
              <div className="p-3 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
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
              <div className="h-full">
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
                          className={cn(
                            "w-full flex items-center gap-3 p-3 hover:bg-gray-50 dark:hover:bg-gray-800 border-b border-gray-200 dark:border-gray-700 text-right transition-colors",
                            selectedChat?.id === chat.id && "bg-gray-100 dark:bg-gray-800"
                          )}
                          data-testid={`chat-${chat.id}`}
                        >
                          <Avatar className="h-12 w-12 flex-shrink-0">
                            <AvatarImage src={chat.profilePicUrl} />
                            <AvatarFallback className="bg-green-500 text-white"></AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0 pr-3">
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-2 flex-1 min-w-0">
                                <p className="font-medium truncate">{chat.name || chat.remoteJid}</p>
                                {chat.isPinned && <Pin className="h-4 w-4 text-amber-500 flex-shrink-0" />}
                              </div>
                              {chat.unreadCount > 0 && (
                                <span className="bg-green-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center flex-shrink-0">
                                  {chat.unreadCount}
                                </span>
                              )}
                            </div>
                          </div>
                        </button>
                        
                        {/* Pin and Tags buttons */}
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
              </div>
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </div>

      {/* Left Side - Main Chat Area */}
      <div className="flex-1 flex flex-col h-full">
        {!selectedChat ? (
          <div className="flex-1 flex items-center justify-center bg-gray-50 dark:bg-gray-800">
            <div className="text-center text-gray-500">
              <p className="text-lg">בחר שיחה כדי להתחיל</p>
            </div>
          </div>
        ) : (
          <>
            {/* Chat Header */}
            <div className="p-4 border-b bg-background flex items-center gap-3">
              <Avatar className="w-10 h-10">
                <AvatarImage src={selectedChat.profilePicUrl} />
                <AvatarFallback></AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <h3 className="font-semibold" data-testid="text-selected-chat-name">
                  {selectedChat.name}
                </h3>
                <p className="text-sm text-muted-foreground">{selectedChat.remoteJid}</p>
              </div>
              <div className="flex gap-1">
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        size="icon"
                        variant="ghost"
                        className={cn(
                          "h-[33px] w-[33px]",
                          selectedChat.isPinned 
                            ? "bg-amber-400 dark:bg-amber-600 text-white hover:bg-amber-500 dark:hover:bg-amber-500" 
                            : "bg-amber-200 dark:bg-amber-800 text-amber-800 dark:text-amber-200 hover:bg-amber-300 dark:hover:bg-amber-700"
                        )}
                        onClick={() => updateChatMutation.mutate({
                          id: selectedChat.id,
                          updates: { isPinned: !selectedChat.isPinned }
                        })}
                        data-testid="button-pin-header"
                      >
                        {selectedChat.isPinned ? (
                          <PinOff className="w-[19px] h-[19px]" />
                        ) : (
                          <Pin className="w-[19px] h-[19px]" />
                        )}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom">
                      <p>{selectedChat.isPinned ? "בטל נעיצת שיחה" : "נעץ שיחה למעלה"}</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-[33px] w-[33px] bg-blue-500 dark:bg-blue-600 text-white hover:bg-blue-600 dark:hover:bg-blue-500"
                        onClick={() => setTagsDialogOpen(true)}
                        data-testid="button-tags-header"
                      >
                        <Tag className="w-[19px] h-[19px]" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom">
                      <p>נהל תגיות למיון ושיוך</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        size="icon"
                        variant="ghost"
                        className={cn(
                          "h-[33px] w-[33px]",
                          selectedChat.isArchived
                            ? "bg-green-500 dark:bg-green-600 text-white hover:bg-green-600 dark:hover:bg-green-500"
                            : "bg-slate-500 dark:bg-slate-600 text-white hover:bg-slate-600 dark:hover:bg-slate-500"
                        )}
                        onClick={() => updateChatMutation.mutate({
                          id: selectedChat.id,
                          updates: { isArchived: !selectedChat.isArchived }
                        })}
                        data-testid="button-archive-header"
                      >
                        <ArchiveIcon className="w-[19px] h-[19px]" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom">
                      <p>{selectedChat.isArchived ? "שחזר מארכיון" : "העבר לארכיון"}</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
            </div>

            {/* Messages Area */}
            <div className="relative overflow-hidden flex-1 p-4 bg-gray-50 dark:bg-gray-800">
              {messagesLoading ? (
                <div className="text-center py-8">טוען הודעות...</div>
              ) : (
                <div className="space-y-2">
                  {messages.map((message) => (
                    <div
                      key={message.id}
                      className={cn(
                        "flex",
                        message.fromMe ? "justify-end" : "justify-start"
                      )}
                    >
                      <div
                        className={cn(
                          "max-w-md rounded-lg px-4 py-2 shadow-sm",
                          message.fromMe
                            ? "bg-green-500 text-white"
                            : "bg-white dark:bg-gray-700 border"
                        )}
                      >
                        {!message.fromMe && message.senderName && (
                          <p className="text-xs font-semibold mb-1 text-green-600 dark:text-green-400">
                            {message.senderName}
                          </p>
                        )}
                        <p className="text-sm">{message.messageText}</p>
                        <span className="text-xs opacity-70 mt-1 block text-left">
                          {message.timestamp && !isNaN(new Date(message.timestamp).getTime()) 
                            ? format(new Date(message.timestamp), 'HH:mm', { locale: he })
                            : ''}
                        </span>
                      </div>
                    </div>
                  ))}
                  <div ref={messagesEndRef} />
                </div>
              )}
            </div>

            {/* Message Input */}
            <form onSubmit={handleSendMessage} className="p-3 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
              <div className="flex gap-2">
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
          </>
        )}
      </div>

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
