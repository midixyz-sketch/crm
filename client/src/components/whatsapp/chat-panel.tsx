import { useState, useEffect, useRef, useMemo } from 'react';
import { X, Search, Send, Pin, PinOff, Tag, Archive as ArchiveIcon, User, Users, Minimize2, MoreVertical, Trash2, ArchiveRestore, Bell, BellOff, Edit2, Check, CheckCheck, FileText, Image as ImageIcon, Video, Music, Download, Smile, Phone, UserPlus } from 'lucide-react';
import EmojiPicker, { EmojiClickData } from 'emoji-picker-react';
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
import { useLocation } from 'wouter';
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
  mediaUrl?: string;
  caption?: string;
  mimeType?: string;
  fileSize?: number;
  timestamp: string;
  deliveryStatus?: 'sent' | 'delivered' | 'read';
  isRead?: boolean;
}

export function WhatsAppChatPanel({ isOpen, onClose }: WhatsAppChatPanelProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedChat, setSelectedChat] = useState<Chat | null>(null);
  const [newMessage, setNewMessage] = useState('');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [activeTab, setActiveTab] = useState<'individual' | 'group' | 'archived'>('group');
  const [selectedTagFilter, setSelectedTagFilter] = useState<string | null>(null);
  const [tagsDialogOpen, setTagsDialogOpen] = useState(false);
  const [newTag, setNewTag] = useState('');
  const [editNameDialogOpen, setEditNameDialogOpen] = useState(false);
  const [editedName, setEditedName] = useState('');
  const [fileActionDialog, setFileActionDialog] = useState<{ open: boolean; fileUrl: string; fileName: string; candidateId?: string; phoneNumber?: string } | null>(null);
  const [linkPhoneDialog, setLinkPhoneDialog] = useState<{ open: boolean; fileUrl: string; fileName: string; phoneNumber: string } | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();
  const [, setLocation] = useLocation();

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
    queryFn: async () => {
      if (!selectedChat?.remoteJid) return [];
      const response = await fetch(`/api/whatsapp/messages/${encodeURIComponent(selectedChat.remoteJid)}`);
      if (!response.ok) throw new Error('Failed to fetch messages');
      return response.json();
    },
  });

  // Handle emoji selection
  const handleEmojiClick = (emojiData: EmojiClickData) => {
    setNewMessage(prev => prev + emojiData.emoji);
    setShowEmojiPicker(false);
  };

  // Send message mutation
  const sendMessageMutation = useMutation({
    mutationFn: async ({ to, text }: { to: string; text: string }) => {
      return await apiRequest('POST', '/api/whatsapp/send', { to, text });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/whatsapp/messages'] });
      setNewMessage('');
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

  // Handle edit name
  const handleEditName = async () => {
    if (!selectedChat || !editedName.trim()) return;
    
    try {
      await updateChatMutation.mutateAsync({
        id: selectedChat.id,
        updates: {
          name: editedName.trim(),
        },
      });
      setEditNameDialogOpen(false);
      toast({
        title: "שם עודכן בהצלחה",
        description: `השם שונה ל-"${editedName.trim()}"`,
      });
    } catch (error) {
      toast({
        title: "שגיאה בעדכון שם",
        description: "לא הצלחנו לעדכן את השם. נסה שוב.",
        variant: "destructive",
      });
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-white dark:bg-gray-900 z-40 flex h-screen pt-16" dir="rtl" data-testid="whatsapp-chat-panel">
      {/* Minimize Button - Top Left Corner */}
      <div className="fixed top-14 left-4 z-[9999]">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="default"
                size="sm"
                onClick={onClose}
                className="bg-green-500 hover:bg-green-600 text-white rounded-full h-3.5 w-3.5 p-0 shadow-md hover:scale-125 transition-all"
                data-testid="button-close-panel"
              >
                <Minimize2 className="h-2.5 w-2.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right">
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
                                <p className="font-medium truncate">{chat.name || chat.remoteJid.split('@')[0]}</p>
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
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold" data-testid="text-selected-chat-name">
                    {selectedChat.name}
                  </h3>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-6 w-6 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                          onClick={() => {
                            setEditedName(selectedChat.name);
                            setEditNameDialogOpen(true);
                          }}
                          data-testid="button-edit-name-header"
                        >
                          <Edit2 className="h-3 w-3" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent side="bottom">
                        <p>ערוך שם</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
                <p className="text-sm text-muted-foreground">{selectedChat.remoteJid.split('@')[0]}</p>
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
                        
                        {/* Message Content based on type */}
                        {message.messageType === 'text' && (
                          <p className="text-sm whitespace-pre-wrap break-words">{message.messageText}</p>
                        )}
                        
                        {message.messageType === 'image' && (
                          <div className="space-y-2">
                            {message.mediaUrl ? (
                              <img 
                                src={message.mediaUrl} 
                                alt={message.caption || 'תמונה'} 
                                className="max-w-xs rounded-lg cursor-pointer hover:opacity-90 transition-opacity hover:ring-2 hover:ring-green-500"
                                onClick={() => setFileActionDialog({ 
                                  open: true, 
                                  fileUrl: message.mediaUrl!, 
                                  fileName: 'תמונה.jpg',
                                  candidateId: selectedChat?.candidateId,
                                  phoneNumber: selectedChat?.remoteJid
                                })}
                                data-testid="image-media"
                              />
                            ) : (
                              <div className="flex items-center gap-2 p-2 bg-gray-100 dark:bg-gray-600 rounded">
                                <ImageIcon className="w-5 h-5" />
                                <div className="flex-1">
                                  <span className="text-sm">תמונה</span>
                                  <p className="text-xs opacity-70 text-amber-600 dark:text-amber-400">קובץ לא זמין</p>
                                </div>
                              </div>
                            )}
                            {message.caption && (
                              <p className="text-sm whitespace-pre-wrap break-words">{message.caption}</p>
                            )}
                          </div>
                        )}
                        
                        {message.messageType === 'document' && (
                          <div 
                            className={cn(
                              "flex items-center gap-3 p-3 bg-gray-100 dark:bg-gray-600 rounded-lg",
                              message.mediaUrl && "cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-500 transition-colors"
                            )}
                            onClick={() => message.mediaUrl && setFileActionDialog({ 
                              open: true, 
                              fileUrl: message.mediaUrl, 
                              fileName: message.fileName || 'מסמך',
                              candidateId: selectedChat?.candidateId,
                              phoneNumber: selectedChat?.remoteJid
                            })}
                            data-testid="document-media"
                          >
                            <FileText className="w-6 h-6 flex-shrink-0" />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate">{message.fileName || 'מסמך'}</p>
                              {message.fileSize ? (
                                <p className="text-xs opacity-70">
                                  {(message.fileSize / 1024).toFixed(1)} KB
                                </p>
                              ) : message.mediaUrl ? null : (
                                <p className="text-xs opacity-70 text-amber-600 dark:text-amber-400">קובץ לא זמין</p>
                              )}
                            </div>
                            {message.mediaUrl && <Download className="w-5 h-5 flex-shrink-0" />}
                          </div>
                        )}
                        
                        {message.messageType === 'video' && (
                          <div className="space-y-2">
                            {message.mediaUrl ? (
                              <video 
                                src={message.mediaUrl} 
                                controls 
                                className="max-w-xs rounded-lg"
                              />
                            ) : (
                              <div className="flex items-center gap-2 p-2 bg-gray-100 dark:bg-gray-600 rounded">
                                <Video className="w-5 h-5" />
                                <span className="text-sm">וידאו</span>
                              </div>
                            )}
                            {message.caption && (
                              <p className="text-sm whitespace-pre-wrap break-words">{message.caption}</p>
                            )}
                          </div>
                        )}
                        
                        {message.messageType === 'audio' && (
                          <div className="flex items-center gap-3 p-2 bg-gray-100 dark:bg-gray-600 rounded-lg">
                            <Music className="w-5 h-5" />
                            {message.mediaUrl ? (
                              <audio src={message.mediaUrl} controls className="flex-1" />
                            ) : (
                              <span className="text-sm">הודעת קול</span>
                            )}
                          </div>
                        )}
                        
                        {message.messageType === 'sticker' && (
                          <div className="flex items-center gap-2">
                            {message.mediaUrl ? (
                              <img 
                                src={message.mediaUrl} 
                                alt="מדבקה" 
                                className="w-24 h-24"
                              />
                            ) : (
                              <span className="text-sm">מדבקה</span>
                            )}
                          </div>
                        )}
                        
                        {!['text', 'image', 'document', 'video', 'audio', 'sticker'].includes(message.messageType) && (
                          <p className="text-sm opacity-70">[{message.messageType}]</p>
                        )}
                        <div className="flex items-center gap-1 justify-end mt-1">
                          <span className="text-xs opacity-70">
                            {message.timestamp && !isNaN(new Date(message.timestamp).getTime()) 
                              ? format(new Date(message.timestamp), 'HH:mm', { locale: he })
                              : ''}
                          </span>
                          {message.fromMe && (
                            <span className="flex-shrink-0">
                              {message.deliveryStatus === 'read' ? (
                                <CheckCheck className="w-4 h-4 text-blue-400" />
                              ) : message.deliveryStatus === 'delivered' ? (
                                <CheckCheck className="w-4 h-4 opacity-70" />
                              ) : (
                                <Check className="w-4 h-4 opacity-70" />
                              )}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                  <div ref={messagesEndRef} />
                </div>
              )}
            </div>

            {/* Message Input */}
            <div className="relative">
              {/* Emoji Picker */}
              {showEmojiPicker && (
                <div className="absolute bottom-full left-0 mb-2 z-50">
                  <EmojiPicker
                    onEmojiClick={handleEmojiClick}
                    searchPlaceHolder="חפש אימוג'י..."
                    width={350}
                    height={400}
                  />
                </div>
              )}
              
              <form onSubmit={handleSendMessage} className="p-3 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
                <div className="flex gap-2 items-center">
                  {/* Emoji Button */}
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                    className="flex-shrink-0"
                    data-testid="button-emoji"
                  >
                    <Smile className="h-5 w-5 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300" />
                  </Button>
                  
                  <Input
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    placeholder="הקלד הודעה..."
                    className="flex-1"
                    data-testid="input-message"
                    onFocus={() => setShowEmojiPicker(false)}
                  />
                  
                  <Button
                    type="submit"
                    disabled={!newMessage.trim() || sendMessageMutation.isPending}
                    className="bg-green-500 hover:bg-green-600 flex-shrink-0"
                    data-testid="button-send-message"
                  >
                    <Send className="h-5 w-5" />
                  </Button>
                </div>
              </form>
            </div>
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

      {/* Edit Name Dialog */}
      <Dialog open={editNameDialogOpen} onOpenChange={setEditNameDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>ערוך שם איש קשר</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">שם</label>
              <Input
                value={editedName}
                onChange={(e) => setEditedName(e.target.value)}
                placeholder="הזן שם לאיש הקשר..."
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleEditName();
                  }
                }}
                className="mt-1"
                data-testid="input-edit-name"
              />
              <p className="text-xs text-muted-foreground mt-1">
                מספר טלפון: {selectedChat?.remoteJid}
              </p>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setEditNameDialogOpen(false)}>
              ביטול
            </Button>
            <Button onClick={handleEditName} disabled={!editedName.trim()}>
              שמור
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* File Action Dialog */}
      <Dialog open={fileActionDialog?.open || false} onOpenChange={(open) => !open && setFileActionDialog(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>פעולה על קובץ</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <p className="text-sm font-medium text-center">
              {fileActionDialog?.fileName}
            </p>
            <div className="flex flex-col gap-3">
              <Button 
                onClick={() => {
                  if (fileActionDialog?.fileUrl) {
                    const link = document.createElement('a');
                    link.href = fileActionDialog.fileUrl;
                    link.download = fileActionDialog.fileName;
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                    setFileActionDialog(null);
                    toast({ title: 'הקובץ הורד בהצלחה', variant: 'default' });
                  }
                }}
                className="w-full"
                data-testid="button-download-file"
              >
                <Download className="ml-2 h-4 w-4" />
                האם להוריד למחשב?
              </Button>
              
              {fileActionDialog?.candidateId ? (
                <Button 
                  onClick={() => {
                    onClose();
                    setLocation(`/candidates/${fileActionDialog.candidateId}`);
                    setFileActionDialog(null);
                  }}
                  variant="outline"
                  className="w-full"
                  data-testid="button-open-candidate"
                >
                  <User className="ml-2 h-4 w-4" />
                  פתח כרטיס מועמד
                </Button>
              ) : (
                <Button 
                  onClick={() => {
                    if (fileActionDialog?.phoneNumber && fileActionDialog?.fileUrl) {
                      setLinkPhoneDialog({
                        open: true,
                        fileUrl: fileActionDialog.fileUrl,
                        fileName: fileActionDialog.fileName,
                        phoneNumber: fileActionDialog.phoneNumber
                      });
                      setFileActionDialog(null);
                    } else {
                      toast({ 
                        title: 'לא ניתן ליצור מועמד', 
                        description: 'חסר מספר טלפון או קובץ',
                        variant: 'destructive' 
                      });
                    }
                  }}
                  variant="outline"
                  className="w-full"
                  data-testid="button-create-candidate"
                >
                  <UserPlus className="ml-2 h-4 w-4" />
                  האם לפתוח מועמד חדש?
                </Button>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button 
              variant="ghost" 
              onClick={() => setFileActionDialog(null)}
              data-testid="button-cancel-file-action"
            >
              ביטול
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Link Phone Number Dialog */}
      <Dialog open={linkPhoneDialog?.open || false} onOpenChange={(open) => !open && setLinkPhoneDialog(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>הוספת מועמד חדש</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <p className="text-sm text-muted-foreground text-center">
              האם להשתמש במספר המועמד שמופיע בשיחה לכרטיס המועמד?
            </p>
            <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg">
              <p className="text-sm font-medium text-center">
                מספר טלפון: {linkPhoneDialog?.phoneNumber}
              </p>
              <p className="text-xs text-muted-foreground text-center mt-1">
                קובץ: {linkPhoneDialog?.fileName}
              </p>
            </div>
            <div className="flex flex-col gap-3">
              <Button 
                onClick={async () => {
                  console.log('🟢 START: Creating candidate with phone number');
                  console.log('📋 Data:', { fileUrl: linkPhoneDialog?.fileUrl, fileName: linkPhoneDialog?.fileName, phoneNumber: linkPhoneDialog?.phoneNumber });
                  
                  if (!linkPhoneDialog?.fileUrl) {
                    console.error('❌ STOP: No file URL');
                    return;
                  }
                  
                  try {
                    console.log('⬇️ STEP 1: Downloading file from server...');
                    // Download file from server
                    const response = await fetch(linkPhoneDialog.fileUrl);
                    if (!response.ok) {
                      console.error('❌ STEP 1 FAILED: File download failed:', response.status);
                      toast({ title: 'שגיאה בהורדת הקובץ', variant: 'destructive' });
                      return;
                    }
                    console.log('✅ STEP 1 SUCCESS: File downloaded');
                    
                    const blob = await response.blob();
                    const file = new File([blob], linkPhoneDialog.fileName, { type: blob.type });
                    console.log('📁 File created:', { name: file.name, size: file.size, type: file.type });
                    
                    // Create form data with phone number
                    const formData = new FormData();
                    formData.append('cv', file);
                    formData.append('phoneNumber', linkPhoneDialog.phoneNumber);
                    console.log('📦 FormData created with phone number:', linkPhoneDialog.phoneNumber);
                    
                    console.log('⬆️ STEP 2: Uploading to /api/candidates...');
                    // Upload and create candidate
                    const uploadResponse = await fetch('/api/candidates', {
                      method: 'POST',
                      body: formData,
                      credentials: 'include',
                    });
                    console.log('📡 Upload response status:', uploadResponse.status);
                    
                    if (uploadResponse.ok) {
                      const contentType = uploadResponse.headers.get('content-type');
                      console.log('✅ Upload successful, content-type:', contentType);
                      if (contentType && contentType.includes('application/json')) {
                        const result = await uploadResponse.json();
                        console.log('📄 Received candidate data:', result);
                        toast({ title: 'מועמד נוצר בהצלחה עם מספר הטלפון!' });
                        setLinkPhoneDialog(null);
                        if (result.id) {
                          console.log('🚀 Navigating to candidate page:', result.id);
                          onClose();
                          setLocation(`/candidates/${result.id}`);
                        } else {
                          console.warn('⚠️ No candidate ID in response');
                        }
                      } else {
                        console.warn('⚠️ Response is not JSON, content-type:', contentType);
                        toast({ title: 'מועמד נוצר בהצלחה עם מספר הטלפון!' });
                        setLinkPhoneDialog(null);
                      }
                    } else {
                      const errorText = await uploadResponse.text();
                      console.error('❌ STEP 2 FAILED: Upload error:', errorText);
                      toast({ title: 'שגיאה ביצירת המועמד', variant: 'destructive' });
                    }
                  } catch (error) {
                    console.error('❌ EXCEPTION: Error creating candidate:', error);
                    toast({ title: 'שגיאה ביצירת המועמד', variant: 'destructive' });
                  }
                }}
                className="w-full"
                data-testid="button-link-phone-yes"
              >
                <Phone className="ml-2 h-4 w-4" />
                כן, השתמש במספר
              </Button>
              
              <Button 
                onClick={async () => {
                  console.log('🟢 START: Creating candidate WITHOUT phone number');
                  console.log('📋 Data:', { fileUrl: linkPhoneDialog?.fileUrl, fileName: linkPhoneDialog?.fileName });
                  
                  if (!linkPhoneDialog?.fileUrl) {
                    console.error('❌ STOP: No file URL');
                    return;
                  }
                  
                  try {
                    console.log('⬇️ STEP 1: Downloading file from server...');
                    // Download file from server
                    const response = await fetch(linkPhoneDialog.fileUrl);
                    if (!response.ok) {
                      console.error('❌ STEP 1 FAILED: File download failed:', response.status);
                      toast({ title: 'שגיאה בהורדת הקובץ', variant: 'destructive' });
                      return;
                    }
                    console.log('✅ STEP 1 SUCCESS: File downloaded');
                    
                    const blob = await response.blob();
                    const file = new File([blob], linkPhoneDialog.fileName, { type: blob.type });
                    console.log('📁 File created:', { name: file.name, size: file.size, type: file.type });
                    
                    // Create form data WITHOUT phone number
                    const formData = new FormData();
                    formData.append('cv', file);
                    console.log('📦 FormData created WITHOUT phone number');
                    
                    console.log('⬆️ STEP 2: Uploading to /api/candidates...');
                    // Upload and create candidate
                    const uploadResponse = await fetch('/api/candidates', {
                      method: 'POST',
                      body: formData,
                      credentials: 'include',
                    });
                    
                    if (uploadResponse.ok) {
                      const contentType = uploadResponse.headers.get('content-type');
                      console.log('✅ Upload successful (no phone), content-type:', contentType);
                      if (contentType && contentType.includes('application/json')) {
                        const result = await uploadResponse.json();
                        console.log('📄 Received candidate data (no phone):', result);
                        toast({ title: 'מועמד נוצר בהצלחה!' });
                        setLinkPhoneDialog(null);
                        if (result.id) {
                          console.log('🚀 Navigating to candidate page:', result.id);
                          onClose();
                          setLocation(`/candidates/${result.id}`);
                        } else {
                          console.warn('⚠️ No candidate ID in response');
                        }
                      } else {
                        console.warn('⚠️ Response is not JSON (no phone), content-type:', contentType);
                        toast({ title: 'מועמד נוצר בהצלחה!' });
                        setLinkPhoneDialog(null);
                      }
                    } else {
                      const errorText = await uploadResponse.text();
                      console.error('Upload error (no phone):', errorText);
                      toast({ title: 'שגיאה ביצירת המועמד', variant: 'destructive' });
                    }
                  } catch (error) {
                    console.error('Error creating candidate:', error);
                    toast({ title: 'שגיאה ביצירת המועמד', variant: 'destructive' });
                  }
                }}
                variant="outline"
                className="w-full"
                data-testid="button-link-phone-no"
              >
                <UserPlus className="ml-2 h-4 w-4" />
                לא, ללא מספר
              </Button>
            </div>
          </div>
          <DialogFooter>
            <Button 
              variant="ghost" 
              onClick={() => setLinkPhoneDialog(null)}
              data-testid="button-cancel-link-phone"
            >
              ביטול
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
