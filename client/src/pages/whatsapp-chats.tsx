import { useState, useEffect, useRef, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Send, CheckCheck, Clock, XCircle, RefreshCw, AlertCircle, Pin, PinOff, Tag, X, QrCode, Loader2, Users, User, Archive } from "lucide-react";
import { format } from "date-fns";
import { he } from "date-fns/locale";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface WhatsAppChat {
  id: string;
  remoteJid: string;
  name: string | null;
  profilePicUrl: string | null;
  isGroup: boolean;
  isPinned: boolean;
  isArchived: boolean;
  unreadCount: number;
  lastMessageAt: string | null;
  lastMessagePreview: string | null;
  candidateId: string | null;
}

interface WhatsAppMessage {
  id: string;
  messageId: string;
  fromMe: boolean;
  remoteJid: string;
  senderName: string | null;
  messageType: string;
  messageText: string | null;
  timestamp: string;
  isRead: boolean;
}

interface Candidate {
  id: string;
  firstName: string;
  lastName: string;
  mobilePhone: string;
  email?: string;
  tags?: string[];
}

interface WhatsAppStatus {
  isConnected: boolean;
  qrCode: string | null;
  phoneNumber: string | null;
}

export default function WhatsAppChats() {
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);
  const [newMessage, setNewMessage] = useState("");
  const [isTagsDialogOpen, setIsTagsDialogOpen] = useState(false);
  const [editingCandidate, setEditingCandidate] = useState<Candidate | null>(null);
  const [newTag, setNewTag] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTagFilter, setSelectedTagFilter] = useState<string | null>(null);
  const [chatTypeFilter, setChatTypeFilter] = useState<string>("individual");
  const [qrImageUrl, setQrImageUrl] = useState<string>("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  const { data: whatsappStatus, isLoading: isStatusLoading, isError: isStatusError } = useQuery<WhatsAppStatus>({
    queryKey: ["/api/whatsapp/status"],
    refetchInterval: 3000,
  });

  // Generate QR code image from data
  useEffect(() => {
    if (whatsappStatus?.qrCode) {
      setQrImageUrl(whatsappStatus.qrCode);
    } else {
      setQrImageUrl("");
    }
  }, [whatsappStatus?.qrCode]);

  const { data: chats = [], isLoading: isChatsLoading } = useQuery<WhatsAppChat[]>({
    queryKey: ["/api/whatsapp/chats"],
    refetchInterval: 5000,
    enabled: whatsappStatus?.isConnected === true,
  });

  // Sync profile pictures when connected (one-time)
  const [hasSyncedProfilePics, setHasSyncedProfilePics] = useState(false);
  
  useEffect(() => {
    if (whatsappStatus?.isConnected && !hasSyncedProfilePics && chats.length > 0) {
      apiRequest("POST", "/api/whatsapp/sync-profile-pictures", {})
        .then(() => {
          console.log('✅ Profile pictures synced');
          queryClient.invalidateQueries({ queryKey: ["/api/whatsapp/chats"] });
          setHasSyncedProfilePics(true);
        })
        .catch((error) => {
          console.error('שגיאה בסנכרון תמונות פרופיל:', error);
        });
    }
  }, [whatsappStatus?.isConnected, hasSyncedProfilePics, chats.length]);

  // Get selected chat
  const selectedChat = chats.find(chat => chat.id === selectedChatId);
  const selectedRemoteJid = selectedChat?.remoteJid;

  // Get messages for selected chat
  const { data: selectedMessages = [] } = useQuery<WhatsAppMessage[]>({
    queryKey: ["/api/whatsapp/messages", selectedRemoteJid],
    enabled: !!selectedRemoteJid && whatsappStatus?.isConnected === true,
    refetchInterval: 3000,
  });

  // Get candidate data for tag management
  const { data: candidatesData } = useQuery<{ candidates: Candidate[]; total: number }>({
    queryKey: ["/api/candidates"],
    enabled: false, // Only load when needed
  });

  const allCandidates = candidatesData?.candidates || [];

  // Filter and sort chats
  const filteredChats = useMemo(() => {
    let filtered = chats.filter(chat => {
      // Filter by chat type
      const chatType = chat.isArchived ? 'archived' : chat.isGroup ? 'group' : 'individual';
      if (chatType !== chatTypeFilter) {
        return false;
      }

      // Filter by search query
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const nameMatch = chat.name?.toLowerCase().includes(query);
        const jidMatch = chat.remoteJid.includes(searchQuery);
        
        // Check tags if chat has linked candidate
        if (chat.candidateId) {
          const candidate = allCandidates.find(c => c.id === chat.candidateId);
          const tagsMatch = candidate?.tags?.some(tag => tag.toLowerCase().includes(query));
          if (!nameMatch && !jidMatch && !tagsMatch) {
            return false;
          }
        } else {
          if (!nameMatch && !jidMatch) {
            return false;
          }
        }
      }

      // Filter by selected tag
      if (selectedTagFilter && chat.candidateId) {
        const candidate = allCandidates.find(c => c.id === chat.candidateId);
        if (!candidate?.tags?.includes(selectedTagFilter)) {
          return false;
        }
      }

      return true;
    });

    // Sort: pinned first, then by last message time
    return filtered.sort((a, b) => {
      if (a.isPinned && !b.isPinned) return -1;
      if (!a.isPinned && b.isPinned) return 1;
      
      const timeA = a.lastMessageAt ? new Date(a.lastMessageAt).getTime() : 0;
      const timeB = b.lastMessageAt ? new Date(b.lastMessageAt).getTime() : 0;
      return timeB - timeA;
    });
  }, [chats, chatTypeFilter, searchQuery, selectedTagFilter, allCandidates]);

  // Get unique tags from all candidates
  const allTags = useMemo(() => {
    const tags = new Set<string>();
    allCandidates.forEach(candidate => {
      candidate.tags?.forEach(tag => tags.add(tag));
    });
    return Array.from(tags);
  }, [allCandidates]);

  const sendMessageMutation = useMutation({
    mutationFn: async ({ remoteJid, message }: { remoteJid: string; message: string }) => {
      return await apiRequest("POST", "/api/whatsapp/send", { phone: remoteJid, message });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/whatsapp/messages", selectedRemoteJid] });
      queryClient.invalidateQueries({ queryKey: ["/api/whatsapp/chats"] });
      setNewMessage("");
    },
    onError: (error: any) => {
      toast({
        title: "שגיאה בשליחה",
        description: error.message || "לא ניתן לשלוח הודעה",
        variant: "destructive",
      });
    },
  });

  const updateChatMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<WhatsAppChat> }) => {
      return await apiRequest("PATCH", `/api/whatsapp/chats/${id}`, updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/whatsapp/chats"] });
    },
    onError: (error: any) => {
      toast({
        title: "שגיאה בעדכון",
        description: error.message || "לא ניתן לעדכן צ'אט",
        variant: "destructive",
      });
    },
  });

  const updateCandidateMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<Candidate> }) => {
      return await apiRequest("PATCH", `/api/candidates/${id}`, updates);
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/candidates"] });
      if (editingCandidate && editingCandidate.id === variables.id) {
        setEditingCandidate({ ...editingCandidate, ...variables.updates });
      }
    },
    onError: (error: any) => {
      toast({
        title: "שגיאה בעדכון",
        description: error.message || "לא ניתן לעדכן מועמד",
        variant: "destructive",
      });
    },
  });

  const getStatusIcon = (fromMe: boolean) => {
    if (fromMe) {
      return <CheckCheck className="w-3 h-3" />;
    }
    return null;
  };

  const handleSendMessage = () => {
    if (!selectedChat || !newMessage.trim()) return;
    
    sendMessageMutation.mutate({
      remoteJid: selectedChat.remoteJid,
      message: newMessage.trim(),
    });
  };

  const handleTogglePin = (chat: WhatsAppChat) => {
    updateChatMutation.mutate({
      id: chat.id,
      updates: { isPinned: !chat.isPinned },
    });
  };

  const handleToggleArchive = (chat: WhatsAppChat) => {
    updateChatMutation.mutate({
      id: chat.id,
      updates: { isArchived: !chat.isArchived },
    });
    
    toast({
      title: chat.isArchived ? "שוחזר מהארכיון" : "הועבר לארכיון",
      description: chat.isArchived 
        ? `השיחה עם ${chat.name || chat.remoteJid} שוחזרה בהצלחה` 
        : `השיחה עם ${chat.name || chat.remoteJid} הועברה לארכיון`,
    });
  };

  const handleAddTag = () => {
    if (!editingCandidate || !newTag.trim()) return;
    const currentTags = editingCandidate.tags || [];
    if (currentTags.includes(newTag.trim())) {
      toast({
        title: "התגית כבר קיימת",
        variant: "destructive",
      });
      return;
    }
    updateCandidateMutation.mutate({
      id: editingCandidate.id,
      updates: { tags: [...currentTags, newTag.trim()] },
    });
    setNewTag("");
  };

  const handleRemoveTag = (tag: string) => {
    if (!editingCandidate) return;
    const currentTags = editingCandidate.tags || [];
    updateCandidateMutation.mutate({
      id: editingCandidate.id,
      updates: { tags: currentTags.filter(t => t !== tag) },
    });
  };

  const openTagsDialog = (chat: WhatsAppChat) => {
    if (chat.candidateId) {
      const candidate = allCandidates.find(c => c.id === chat.candidateId);
      if (candidate) {
        setEditingCandidate(candidate);
        setIsTagsDialogOpen(true);
      }
    }
  };

  // Get stable reference to last message ID for scroll trigger
  const lastMessageId = selectedMessages[selectedMessages.length - 1]?.id;

  // Auto-scroll to bottom when chat changes or new messages arrive
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [lastMessageId, selectedChatId]);

  // Get initials for avatar fallback
  const getInitials = (chat: WhatsAppChat) => {
    if (chat.name) {
      const words = chat.name.trim().split(/\s+/);
      if (words.length >= 2) {
        return words[0][0] + words[1][0];
      }
      return chat.name.substring(0, 2);
    }
    // Use phone number
    const phone = chat.remoteJid.split('@')[0];
    return phone.substring(phone.length - 2);
  };

  // Show connection status
  if (isStatusLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!whatsappStatus?.isConnected && whatsappStatus?.qrCode) {
    return (
      <div className="flex flex-col items-center justify-center h-screen gap-6 p-4">
        <Card className="p-8 max-w-md">
          <div className="text-center space-y-4">
            <QrCode className="w-16 h-16 mx-auto text-primary" />
            <h2 className="text-2xl font-bold">התחבר ל-WhatsApp</h2>
            <p className="text-muted-foreground">סרוק את קוד ה-QR עם WhatsApp במכשיר שלך</p>
            {qrImageUrl && (
              <img 
                src={qrImageUrl} 
                alt="WhatsApp QR Code" 
                className="mx-auto border rounded-lg p-2"
                data-testid="img-qr-code"
              />
            )}
            <p className="text-sm text-muted-foreground">
              פתח WhatsApp בטלפון &gt; הגדרות &gt; מכשירים מקושרים &gt; קשר מכשיר
            </p>
          </div>
        </Card>
      </div>
    );
  }

  if (!whatsappStatus?.isConnected) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Card className="p-8 max-w-md">
          <div className="text-center space-y-4">
            <AlertCircle className="w-16 h-16 mx-auto text-destructive" />
            <h2 className="text-2xl font-bold">WhatsApp לא מחובר</h2>
            <p className="text-muted-foreground">ממתין לחיבור...</p>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col" dir="rtl">
      {/* Header */}
      <div className="p-4 border-b bg-background">
        <div className="flex items-center justify-between gap-4">
          <h1 className="text-2xl font-bold">WhatsApp</h1>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20">
              <div className="w-2 h-2 bg-green-500 rounded-full mr-1 animate-pulse" />
              מחובר
            </Badge>
            {whatsappStatus?.phoneNumber && (
              <span className="text-sm text-muted-foreground">{whatsappStatus.phoneNumber}</span>
            )}
          </div>
        </div>
      </div>

      {/* Main Content - Chat List + Active Chat */}
      <div className="flex-1 flex flex-row-reverse overflow-hidden">
        {/* Chat List Sidebar (RIGHT SIDE) */}
        <div className="w-[380px] flex flex-col border-l bg-background">
          {/* Search and Filters */}
          <div className="p-3 border-b space-y-3">
            <Input
              placeholder="חפש שיחה..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full"
              data-testid="input-search-chat"
            />
            
            {/* Chat Type Tabs */}
            <Tabs value={chatTypeFilter} onValueChange={setChatTypeFilter} className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="individual" data-testid="tab-individual">
                  <User className="w-4 h-4 ml-1" />
                  צ'אטים
                </TabsTrigger>
                <TabsTrigger value="group" data-testid="tab-groups">
                  <Users className="w-4 h-4 ml-1" />
                  קבוצות
                </TabsTrigger>
                <TabsTrigger value="archived" data-testid="tab-archived">
                  <Archive className="w-4 h-4 ml-1" />
                  ארכיון
                </TabsTrigger>
              </TabsList>
            </Tabs>

            {/* Tag Filter */}
            {allTags.length > 0 && (
              <div className="flex flex-wrap gap-1">
                <Badge
                  variant={selectedTagFilter === null ? "default" : "outline"}
                  className="cursor-pointer"
                  onClick={() => setSelectedTagFilter(null)}
                  data-testid="badge-all-tags"
                >
                  הכל
                </Badge>
                {allTags.map((tag) => (
                  <Badge
                    key={tag}
                    variant={selectedTagFilter === tag ? "default" : "outline"}
                    className="cursor-pointer"
                    onClick={() => setSelectedTagFilter(tag)}
                    data-testid={`badge-tag-${tag}`}
                  >
                    {tag}
                  </Badge>
                ))}
              </div>
            )}

            {isChatsLoading && (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription className="text-sm">
                  טוען שיחות...
                </AlertDescription>
              </Alert>
            )}
          </div>

          <ScrollArea className="flex-1">
            {filteredChats.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">
                <p>{chats.length === 0 ? "אין שיחות עדיין" : "לא נמצאו שיחות"}</p>
                <p className="text-xs mt-2">{chats.length === 0 ? "שלח הודעה ראשונה כדי להתחיל שיחה" : "נסה חיפוש או סינון אחר"}</p>
              </div>
            ) : (
              <div className="space-y-1 p-2">
                {filteredChats.map((chat) => {
                  const candidate = chat.candidateId ? allCandidates.find(c => c.id === chat.candidateId) : null;
                  
                  return (
                    <div
                      key={chat.id}
                      className={cn(
                        "relative p-3 rounded-lg transition-colors cursor-pointer",
                        selectedChatId === chat.id
                          ? "bg-accent"
                          : "hover:bg-accent/50"
                      )}
                      onClick={() => setSelectedChatId(chat.id)}
                      data-testid={`chat-item-${chat.id}`}
                    >
                      <div className="flex items-start gap-3">
                        <Avatar className="w-10 h-10">
                          {chat.profilePicUrl && (
                            <AvatarImage src={chat.profilePicUrl} alt={chat.name || chat.remoteJid} />
                          )}
                          <AvatarFallback>{getInitials(chat)}</AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2 mb-1">
                            <div className="flex items-center gap-1 flex-1 min-w-0">
                              {chat.isPinned && <Pin className="w-3 h-3 text-primary shrink-0" />}
                              <span className="font-medium truncate">{chat.name || chat.remoteJid.split('@')[0]}</span>
                            </div>
                            {chat.lastMessageAt && (
                              <span className="text-xs text-muted-foreground shrink-0">
                                {format(new Date(chat.lastMessageAt), "HH:mm", { locale: he })}
                              </span>
                            )}
                          </div>
                          
                          {candidate?.tags && candidate.tags.length > 0 && (
                            <div className="flex gap-1 mb-1 flex-wrap">
                              {candidate.tags.map((tag) => (
                                <Badge key={tag} variant="secondary" className="text-xs">{tag}</Badge>
                              ))}
                            </div>
                          )}
                          
                          <div className="flex items-center gap-1">
                            {chat.lastMessagePreview ? (
                              <p className="text-sm text-muted-foreground truncate">
                                {chat.lastMessagePreview}
                              </p>
                            ) : (
                              <p className="text-sm text-muted-foreground italic">
                                אין הודעות
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                      
                      <div className="absolute bottom-2 left-2 flex gap-1">
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                size="icon"
                                variant="ghost"
                                className={cn(
                                  "h-[20px] w-[20px]",
                                  chat.isPinned 
                                    ? "bg-amber-400 dark:bg-amber-600 text-white hover:bg-amber-500 dark:hover:bg-amber-500" 
                                    : "bg-amber-200 dark:bg-amber-800 text-amber-800 dark:text-amber-200 hover:bg-amber-300 dark:hover:bg-amber-700"
                                )}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleTogglePin(chat);
                                }}
                                data-testid={`button-pin-${chat.id}`}
                              >
                                {chat.isPinned ? (
                                  <PinOff className="w-[11px] h-[11px]" />
                                ) : (
                                  <Pin className="w-[11px] h-[11px]" />
                                )}
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent side="bottom">
                              <p>{chat.isPinned ? "בטל נעיצת שיחה" : "נעץ שיחה למעלה"}</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                        {chat.candidateId && (
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="h-[20px] w-[20px] bg-blue-500 dark:bg-blue-600 text-white hover:bg-blue-600 dark:hover:bg-blue-500"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    openTagsDialog(chat);
                                  }}
                                  data-testid={`button-tags-${chat.id}`}
                                >
                                  <Tag className="w-[11px] h-[11px]" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent side="bottom">
                                <p>נהל תגיות למיון ושיוך</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </ScrollArea>
        </div>

        {/* Main Chat Area (LEFT SIDE) */}
        <div className="flex-1 flex flex-col">
          {!selectedChat ? (
            <div className="flex-1 flex items-center justify-center bg-muted/10">
              <div className="text-center text-muted-foreground">
                <p className="text-lg">בחר שיחה כדי להתחיל</p>
                <p className="text-sm mt-2">כל השיחות שלך מופיעות בצד ימין</p>
              </div>
            </div>
          ) : (
            <>
              {/* Chat Header */}
              <div className="p-4 border-b bg-background flex items-center gap-3">
                <Avatar className="w-10 h-10">
                  {selectedChat.profilePicUrl && (
                    <AvatarImage src={selectedChat.profilePicUrl} alt={selectedChat.name || selectedChat.remoteJid} />
                  )}
                  <AvatarFallback>{getInitials(selectedChat)}</AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <h2 className="font-semibold">{selectedChat.name || selectedChat.remoteJid.split('@')[0]}</h2>
                  <p className="text-xs text-muted-foreground">{selectedChat.remoteJid}</p>
                </div>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => handleToggleArchive(selectedChat)}
                        data-testid="button-archive"
                      >
                        <Archive className="w-4 h-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>{selectedChat.isArchived ? "שחזר מארכיון" : "העבר לארכיון"}</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>

              {/* Messages Area */}
              <ScrollArea className="flex-1 p-4">
                <div className="space-y-2">
                  {selectedMessages.length === 0 ? (
                    <div className="text-center text-muted-foreground py-8">
                      <p>אין הודעות בשיחה זו</p>
                    </div>
                  ) : (
                    selectedMessages.map((msg) => (
                      <div
                        key={msg.id}
                        className={cn(
                          "flex",
                          msg.fromMe ? "justify-start" : "justify-end"
                        )}
                        data-testid={`message-${msg.id}`}
                      >
                        <div
                          className={cn(
                            "max-w-[70%] rounded-lg p-3",
                            msg.fromMe
                              ? "bg-primary text-primary-foreground"
                              : "bg-muted"
                          )}
                        >
                          {msg.senderName && !msg.fromMe && selectedChat.isGroup && (
                            <p className="text-xs font-semibold mb-1">{msg.senderName}</p>
                          )}
                          <p className="break-words">{msg.messageText || '[מדיה]'}</p>
                          <div className="flex items-center gap-1 justify-end mt-1">
                            <span className="text-xs opacity-70">
                              {format(new Date(msg.timestamp), "HH:mm", { locale: he })}
                            </span>
                            {msg.fromMe && getStatusIcon(msg.fromMe)}
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                  <div ref={messagesEndRef} />
                </div>
              </ScrollArea>

              {/* Message Input */}
              <div className="p-4 border-t bg-background">
                <div className="flex gap-2">
                  <Input
                    placeholder="הקלד הודעה..."
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        handleSendMessage();
                      }
                    }}
                    className="flex-1"
                    disabled={sendMessageMutation.isPending}
                    data-testid="input-message"
                  />
                  <Button
                    onClick={handleSendMessage}
                    disabled={!newMessage.trim() || sendMessageMutation.isPending}
                    data-testid="button-send"
                  >
                    {sendMessageMutation.isPending ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Send className="w-4 h-4" />
                    )}
                  </Button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Tags Dialog */}
      <Dialog open={isTagsDialogOpen} onOpenChange={setIsTagsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>נהל תגיות</DialogTitle>
            <DialogDescription>
              הוסף או הסר תגיות לשיחה זו
            </DialogDescription>
          </DialogHeader>
          {editingCandidate && (
            <div className="space-y-4">
              <div className="flex gap-2">
                <Input
                  placeholder="תגית חדשה..."
                  value={newTag}
                  onChange={(e) => setNewTag(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleAddTag();
                    }
                  }}
                  data-testid="input-new-tag"
                />
                <Button onClick={handleAddTag} data-testid="button-add-tag">
                  הוסף
                </Button>
              </div>
              <div className="flex flex-wrap gap-2">
                {editingCandidate.tags?.map((tag) => (
                  <Badge key={tag} variant="secondary" className="gap-1">
                    {tag}
                    <X
                      className="w-3 h-3 cursor-pointer hover:text-destructive"
                      onClick={() => handleRemoveTag(tag)}
                      data-testid={`button-remove-tag-${tag}`}
                    />
                  </Badge>
                ))}
                {(!editingCandidate.tags || editingCandidate.tags.length === 0) && (
                  <p className="text-sm text-muted-foreground">אין תגיות עדיין</p>
                )}
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsTagsDialogOpen(false)} data-testid="button-close-tags">
              סגור
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
