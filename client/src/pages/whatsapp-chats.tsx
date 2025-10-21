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
import QRCodeLib from "qrcode";

interface Message {
  id: string;
  candidateId: string;
  phone: string;
  message: string;
  status: "pending" | "sent" | "delivered" | "failed";
  direction: "outgoing" | "incoming";
  sentAt: string;
  deliveredAt?: string;
  errorMessage?: string;
}

interface Candidate {
  id: string;
  firstName: string;
  lastName: string;
  phone: string;
  email?: string;
  tags?: string[];
  isPinned?: boolean;
  chatType?: string;
  previousChatType?: string;
}

interface ChatGroup {
  candidate: Candidate;
  messages: Message[];
  lastMessage: Message | null;
}

interface WhatsAppStatus {
  isConnected: boolean;
  qrCode: string | null;
  phoneNumber: string | null;
}

export default function WhatsAppChats() {
  const [selectedCandidateId, setSelectedCandidateId] = useState<string | null>(null);
  const [newMessage, setNewMessage] = useState("");
  const [profilePictures, setProfilePictures] = useState<Record<string, string | null>>({});
  const [isTagsDialogOpen, setIsTagsDialogOpen] = useState(false);
  const [editingCandidate, setEditingCandidate] = useState<Candidate | null>(null);
  const [newTag, setNewTag] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTagFilter, setSelectedTagFilter] = useState<string | null>(null);
  const [chatTypeFilter, setChatTypeFilter] = useState<string>("individual");
  const [qrImageUrl, setQrImageUrl] = useState<string>("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fetchedPhonesRef = useRef<Set<string>>(new Set());
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

  const { data: messages = [] } = useQuery<Message[]>({
    queryKey: ["/api/whatsapp/messages"],
    refetchInterval: 3000,
    enabled: whatsappStatus?.isConnected === true,
  });

  const { data: candidatesData } = useQuery<{ candidates: Candidate[]; total: number }>({
    queryKey: ["/api/candidates"],
    refetchInterval: 3000,
  });

  const allCandidates = candidatesData?.candidates || [];

  // Sync WhatsApp groups to candidates when connected
  useEffect(() => {
    if (whatsappStatus?.isConnected) {
      apiRequest("POST", "/api/whatsapp/sync-groups", {})
        .then(() => {
          queryClient.invalidateQueries({ queryKey: ["/api/candidates"] });
        })
        .catch((error) => {
          console.error('שגיאה בסנכרון קבוצות:', error);
        });
    }
  }, [whatsappStatus?.isConnected]);

  // Filter candidates to only those with WhatsApp messages
  const candidates = useMemo(() => {
    const candidateIds = new Set(messages.map(m => m.candidateId));
    return allCandidates.filter(c => candidateIds.has(c.id) || (c.chatType === 'group'));
  }, [allCandidates, messages]);

  // Fetch profile pictures for all candidates
  useEffect(() => {
    const fetchProfilePictures = async () => {
      for (const candidate of candidates) {
        if (!candidate.phone || fetchedPhonesRef.current.has(candidate.phone)) continue;
        
        try {
          const response = await fetch(`/api/whatsapp/profile-picture/${candidate.phone}`);
          
          if (response.ok) {
            const data = await response.json();
            fetchedPhonesRef.current.add(candidate.phone);
            setProfilePictures(prev => ({
              ...prev,
              [candidate.phone]: data.profilePicUrl || null
            }));
          } else if (response.status === 404 || response.status === 401) {
            fetchedPhonesRef.current.add(candidate.phone);
            setProfilePictures(prev => ({
              ...prev,
              [candidate.phone]: null
            }));
          }
        } catch (error) {
          // Network errors, timeouts - don't cache, allow retry
        }
      }
    };

    if (candidates.length > 0) {
      fetchProfilePictures();
    }
  }, [candidates]);

  const sendMessageMutation = useMutation({
    mutationFn: async ({ candidateId, phone, message }: { candidateId: string; phone: string; message: string }) => {
      return await apiRequest("POST", "/api/whatsapp/send", { candidateId, phone, message });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/whatsapp/messages"] });
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

  // Get all unique tags from all candidates
  const allTags = useMemo(() => {
    const tagsSet = new Set<string>();
    candidates.forEach(candidate => {
      candidate.tags?.forEach(tag => tagsSet.add(tag));
    });
    return Array.from(tagsSet).sort((a, b) => a.localeCompare(b, 'he'));
  }, [candidates]);

  // Group messages by candidate and sort with pinned chats first
  const chatGroups: ChatGroup[] = candidates
    .map((candidate): ChatGroup | null => {
      const candidateMessages = messages.filter((m) => m.candidateId === candidate.id);
      
      // Auto-detect groups based on WhatsApp phone format (@g.us)
      const isGroup = candidate.phone?.includes('@g.us') || (candidate.chatType || 'individual') === 'group';
      if (candidateMessages.length === 0 && !isGroup) return null;

      const sortedMessages = candidateMessages.length > 0
        ? [...candidateMessages].sort((a, b) => new Date(b.sentAt).getTime() - new Date(a.sentAt).getTime())
        : [];

      return {
        candidate,
        messages: candidateMessages,
        lastMessage: sortedMessages[0] || null,
      };
    })
    .filter((group): group is ChatGroup => group !== null)
    .sort((a, b) => {
      // Pinned chats always come first
      if (a.candidate.isPinned && !b.candidate.isPinned) return -1;
      if (!a.candidate.isPinned && b.candidate.isPinned) return 1;
      // Otherwise sort by last message time (groups without messages go to bottom)
      if (!a.lastMessage && !b.lastMessage) return 0;
      if (!a.lastMessage) return 1;
      if (!b.lastMessage) return -1;
      return new Date(b.lastMessage.sentAt).getTime() - new Date(a.lastMessage.sentAt).getTime();
    });

  // Filter chat groups by chat type, search query and selected tag
  const filteredChatGroups = chatGroups.filter(group => {
    // Filter by chat type - auto-detect groups based on WhatsApp phone format (@g.us)
    const isGroupChat = group.candidate.phone?.includes('@g.us') || (group.candidate.chatType || 'individual') === 'group';
    const groupChatType = isGroupChat ? 'group' : (group.candidate.chatType || 'individual');
    if (groupChatType !== chatTypeFilter) {
      return false;
    }
    
    // Filter by search query (name, phone, or tags)
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      const fullName = `${group.candidate.firstName} ${group.candidate.lastName}`.toLowerCase();
      const nameMatch = fullName.includes(query);
      const phoneMatch = group.candidate.phone?.includes(searchQuery);
      const tagsMatch = group.candidate.tags?.some(tag => tag.toLowerCase().includes(query));
      
      if (!nameMatch && !phoneMatch && !tagsMatch) {
        return false;
      }
    }
    
    // Filter by selected tag
    if (selectedTagFilter && !group.candidate.tags?.includes(selectedTagFilter)) {
      return false;
    }
    
    return true;
  });

  const selectedChat = chatGroups.find((g) => g.candidate.id === selectedCandidateId);
  
  // Get the current candidate data directly from candidates array for real-time updates
  const currentCandidate = useMemo(() => {
    return candidates.find(c => c.id === selectedCandidateId);
  }, [candidates, selectedCandidateId]);
  
  // Memoize sorted messages using stable dependencies
  const sortedSelectedMessages = useMemo(() => {
    if (!selectedCandidateId) return undefined;
    const candidateMessages = messages.filter((m) => m.candidateId === selectedCandidateId);
    return candidateMessages.sort(
      (a, b) => new Date(a.sentAt).getTime() - new Date(b.sentAt).getTime()
    );
  }, [selectedCandidateId, messages]);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "delivered":
        return <CheckCheck className="w-3 h-3" />;
      case "sent":
        return <CheckCheck className="w-3 h-3 opacity-50" />;
      case "pending":
        return <Clock className="w-3 h-3" />;
      case "failed":
        return <XCircle className="w-3 h-3 text-destructive" />;
      default:
        return null;
    }
  };

  const handleSendMessage = () => {
    if (!selectedChat || !newMessage.trim()) return;
    
    sendMessageMutation.mutate({
      candidateId: selectedChat.candidate.id,
      phone: selectedChat.candidate.phone,
      message: newMessage.trim(),
    });
  };

  const handleTogglePin = (candidate: Candidate) => {
    updateCandidateMutation.mutate({
      id: candidate.id,
      updates: { isPinned: !candidate.isPinned },
    });
  };

  const handleToggleArchive = (candidate: Candidate) => {
    const currentType = candidate.chatType || 'individual';
    const isArchived = currentType === 'archived';
    
    if (isArchived) {
      // Restore from archive - use previousChatType or default to individual
      const restoredType = candidate.previousChatType || 'individual';
      updateCandidateMutation.mutate({
        id: candidate.id,
        updates: { 
          chatType: restoredType,
          previousChatType: undefined,
        },
      });
    } else {
      // Archive the chat - save current type for restoration
      updateCandidateMutation.mutate({
        id: candidate.id,
        updates: { 
          chatType: 'archived',
          previousChatType: currentType,
        },
      });
    }
    
    toast({
      title: isArchived ? "שוחזר מהארכיון" : "הועבר לארכיון",
      description: isArchived 
        ? `השיחה עם ${candidate.firstName} ${candidate.lastName} שוחזרה בהצלחה` 
        : `השיחה עם ${candidate.firstName} ${candidate.lastName} הועברה לארכיון`,
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

  const openTagsDialog = (candidate: Candidate) => {
    setEditingCandidate(candidate);
    setIsTagsDialogOpen(true);
  };

  // Get stable reference to last message ID for scroll trigger
  const lastMessageId = sortedSelectedMessages?.[sortedSelectedMessages.length - 1]?.id;

  // Auto-scroll to bottom when chat changes or new messages arrive
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [selectedCandidateId, lastMessageId]);

  // Show loading state while initial status fetch is pending
  if (isStatusLoading) {
    return (
      <div className="h-screen flex items-center justify-center bg-muted/10">
        <div className="flex flex-col items-center space-y-4">
          <Loader2 className="w-12 h-12 animate-spin text-muted-foreground" />
          <p className="text-sm text-muted-foreground">טוען...</p>
        </div>
      </div>
    );
  }

  // Show error state if status fetch failed
  if (isStatusError || !whatsappStatus) {
    return (
      <div className="h-screen flex items-center justify-center bg-muted/10">
        <Card className="p-8 max-w-md text-center">
          <XCircle className="w-12 h-12 mx-auto mb-4 text-destructive" />
          <h2 className="text-xl font-semibold mb-2">שגיאה בטעינת מצב WhatsApp</h2>
          <p className="text-muted-foreground mb-6">לא הצלחנו לקבל את מצב החיבור. נסה לרענן את הדף.</p>
          <Button onClick={() => window.location.reload()}>
            <RefreshCw className="w-4 h-4 ml-2" />
            רענן דף
          </Button>
        </Card>
      </div>
    );
  }

  // If WhatsApp is explicitly disconnected, show QR code
  if (!whatsappStatus.isConnected) {
    return (
      <div className="h-screen flex items-center justify-center bg-muted/10">
        <Card className="p-8 max-w-md">
          <div className="text-center mb-6">
            <QrCode className="w-16 h-16 mx-auto mb-4 text-primary" />
            <h2 className="text-2xl font-semibold mb-2">חיבור ל-WhatsApp</h2>
            <p className="text-muted-foreground">סרוק את ה-QR code עם אפליקציית WhatsApp שלך</p>
          </div>

          {!qrImageUrl && (
            <div className="flex flex-col items-center justify-center py-12 space-y-4">
              <Loader2 className="w-12 h-12 animate-spin text-muted-foreground" />
              <p className="text-sm text-muted-foreground">טוען QR code...</p>
            </div>
          )}

          {qrImageUrl && (
            <div className="flex flex-col items-center space-y-6">
              <div className="bg-white p-4 rounded-lg border-2 border-gray-200">
                <img 
                  src={qrImageUrl} 
                  alt="WhatsApp QR Code" 
                  className="w-full max-w-sm"
                  data-testid="qr-image"
                />
              </div>
              
              <div className="text-center space-y-2">
                <p className="font-medium">איך לסרוק:</p>
                <ol className="text-sm text-muted-foreground space-y-1 text-right">
                  <li>1. פתח את WhatsApp בטלפון שלך</li>
                  <li>2. לחץ על <strong>⋮</strong> (שלוש נקודות) → <strong>מכשירים מקושרים</strong></li>
                  <li>3. לחץ על <strong>קשר מכשיר</strong></li>
                  <li>4. כוון את המצלמה לקוד למעלה</li>
                </ol>
              </div>
            </div>
          )}
        </Card>
      </div>
    );
  }

  // Continue in next part...
  return (
    <div className="h-screen flex">
      {/* Sidebar - Chat List */}
      <div className="w-80 border-l flex flex-col bg-background dark:bg-muted/30">
        <div className="p-4 border-b bg-background space-y-3">
          <div>
            <h2 className="text-lg font-semibold" data-testid="text-chats-title">שיחות WhatsApp</h2>
            <p className="text-sm text-muted-foreground">{filteredChatGroups.length} מתוך {chatGroups.length} שיחות</p>
          </div>
          
          {/* Chat Type Tabs */}
          <Tabs value={chatTypeFilter} onValueChange={setChatTypeFilter} className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="individual" data-testid="tab-individual">
                <User className="w-4 h-4 ml-1" />
                צ'אטים
              </TabsTrigger>
              <TabsTrigger value="group" data-testid="tab-group">
                <Users className="w-4 h-4 ml-1" />
                קבוצות
              </TabsTrigger>
              <TabsTrigger value="archived" data-testid="tab-archived">
                <Archive className="w-4 h-4 ml-1" />
                ארכיון
              </TabsTrigger>
            </TabsList>
          </Tabs>
          
          {/* Search Input */}
          <Input
            placeholder="חפש לפי שם, טלפון או תווית..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            data-testid="input-search-chats"
            className="w-full"
          />
          
          {/* Tags Filter */}
          {allTags.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground">סינון לפי תגיות:</p>
              <div className="flex flex-wrap gap-1">
                <Badge
                  variant={selectedTagFilter === null ? "default" : "outline"}
                  className="cursor-pointer"
                  onClick={() => setSelectedTagFilter(null)}
                  data-testid="tag-filter-all"
                >
                  הכל
                </Badge>
                {allTags.map((tag) => (
                  <Badge
                    key={tag}
                    variant={selectedTagFilter === tag ? "default" : "outline"}
                    className="cursor-pointer"
                    onClick={() => setSelectedTagFilter(tag)}
                    data-testid={`tag-filter-${tag}`}
                  >
                    {tag}
                  </Badge>
                ))}
              </div>
            </div>
          )}
          
          {chatGroups.length === 0 && messages.length === 0 && (
            <Alert>
              <AlertCircle className="w-4 h-4" />
              <AlertDescription className="text-xs">
                <strong>💡 טיפ:</strong> שלח לעצמך הודעה ב-WhatsApp או בקש ממישהו לשלוח לך הודעה - היא תופיע כאן תוך שניות!
              </AlertDescription>
            </Alert>
          )}
        </div>

        <ScrollArea className="flex-1">
          {filteredChatGroups.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              <p>{chatGroups.length === 0 ? "אין שיחות עדיין" : "לא נמצאו שיחות"}</p>
              <p className="text-xs mt-2">{chatGroups.length === 0 ? "שלח הודעה ראשונה למועמד כדי להתחיל שיחה" : "נסה חיפוש או סינון אחר"}</p>
            </div>
          ) : (
            <div className="space-y-1 p-2">
              {filteredChatGroups.map((group) => (
                <div
                  key={group.candidate.id}
                  className={cn(
                    "relative p-3 rounded-lg transition-colors cursor-pointer",
                    selectedCandidateId === group.candidate.id
                      ? "bg-accent"
                      : "hover:bg-accent/50"
                  )}
                  onClick={() => setSelectedCandidateId(group.candidate.id)}
                  data-testid={`chat-item-${group.candidate.id}`}
                >
                  <div className="flex items-start gap-3">
                    <Avatar className="w-10 h-10">
                      {profilePictures[group.candidate.phone] && (
                        <AvatarImage src={profilePictures[group.candidate.phone]!} alt={`${group.candidate.firstName} ${group.candidate.lastName}`} />
                      )}
                      <AvatarFallback>{group.candidate.firstName[0]}{group.candidate.lastName[0]}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <div className="flex items-center gap-1 flex-1 min-w-0">
                          {group.candidate.isPinned && <Pin className="w-3 h-3 text-primary shrink-0" />}
                          <span className="font-medium truncate">{group.candidate.firstName} {group.candidate.lastName}</span>
                        </div>
                        {group.lastMessage && (
                          <span className="text-xs text-muted-foreground shrink-0">
                            {format(new Date(group.lastMessage.sentAt), "HH:mm", { locale: he })}
                          </span>
                        )}
                      </div>
                      
                      {group.candidate.tags && group.candidate.tags.length > 0 && (
                        <div className="flex gap-1 mb-1 flex-wrap">
                          {group.candidate.tags.map((tag) => (
                            <Badge key={tag} variant="secondary" className="text-xs">{tag}</Badge>
                          ))}
                        </div>
                      )}
                      
                      <div className="flex items-center gap-1">
                        {group.lastMessage ? (
                          <>
                            {group.lastMessage.direction === "outgoing" && getStatusIcon(group.lastMessage.status)}
                            <p className="text-sm text-muted-foreground truncate">
                              {group.lastMessage.message}
                            </p>
                          </>
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
                              group.candidate.isPinned 
                                ? "bg-amber-400 dark:bg-amber-600 text-white hover:bg-amber-500 dark:hover:bg-amber-500" 
                                : "bg-amber-200 dark:bg-amber-800 text-amber-800 dark:text-amber-200 hover:bg-amber-300 dark:hover:bg-amber-700"
                            )}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleTogglePin(group.candidate);
                            }}
                            data-testid={`button-pin-${group.candidate.id}`}
                          >
                            {group.candidate.isPinned ? (
                              <PinOff className="w-[11px] h-[11px]" />
                            ) : (
                              <Pin className="w-[11px] h-[11px]" />
                            )}
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent side="bottom">
                          <p>{group.candidate.isPinned ? "בטל נעיצת שיחה" : "נעץ שיחה למעלה"}</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-[20px] w-[20px] bg-blue-500 dark:bg-blue-600 text-white hover:bg-blue-600 dark:hover:bg-blue-500"
                            onClick={(e) => {
                              e.stopPropagation();
                              openTagsDialog(group.candidate);
                            }}
                            data-testid={`button-tags-${group.candidate.id}`}
                          >
                            <Tag className="w-[11px] h-[11px]" />
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
      </div>

      {/* Main Chat Area */}
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
                {profilePictures[selectedChat.candidate.phone] && (
                  <AvatarImage src={profilePictures[selectedChat.candidate.phone]!} alt={`${selectedChat.candidate.firstName} ${selectedChat.candidate.lastName}`} />
                )}
                <AvatarFallback>{selectedChat.candidate.firstName[0]}{selectedChat.candidate.lastName[0]}</AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <h3 className="font-semibold" data-testid="text-selected-chat-name">
                  {selectedChat.candidate.firstName} {selectedChat.candidate.lastName}
                </h3>
                <p className="text-sm text-muted-foreground">{selectedChat.candidate.phone}</p>
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
                          selectedChat.candidate.isPinned 
                            ? "bg-amber-400 dark:bg-amber-600 text-white hover:bg-amber-500 dark:hover:bg-amber-500" 
                            : "bg-amber-200 dark:bg-amber-800 text-amber-800 dark:text-amber-200 hover:bg-amber-300 dark:hover:bg-amber-700"
                        )}
                        onClick={() => handleTogglePin(selectedChat.candidate)}
                        data-testid="button-pin-header"
                      >
                        {selectedChat.candidate.isPinned ? (
                          <PinOff className="w-[19px] h-[19px]" />
                        ) : (
                          <Pin className="w-[19px] h-[19px]" />
                        )}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom">
                      <p>{selectedChat.candidate.isPinned ? "בטל נעיצת שיחה" : "נעץ שיחה למעלה"}</p>
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
                        onClick={() => openTagsDialog(selectedChat.candidate)}
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
                {currentCandidate && (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          size="icon"
                          variant="ghost"
                          className={cn(
                            "h-[33px] w-[33px]",
                            (currentCandidate.chatType || 'individual') === 'archived'
                              ? "bg-green-500 dark:bg-green-600 text-white hover:bg-green-600 dark:hover:bg-green-500"
                              : "bg-slate-500 dark:bg-slate-600 text-white hover:bg-slate-600 dark:hover:bg-slate-500"
                          )}
                          onClick={() => handleToggleArchive(currentCandidate)}
                          data-testid="button-archive-header"
                        >
                          <Archive className="w-[19px] h-[19px]" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent side="bottom">
                        <p>{(currentCandidate.chatType || 'individual') === 'archived' ? "שחזר מארכיון" : "העבר לארכיון"}</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )}
              </div>
            </div>

            {/* Messages Area */}
            <ScrollArea className="flex-1 p-4 bg-muted/10">
              <div className="space-y-4 max-w-4xl mx-auto">
                {sortedSelectedMessages?.map((msg) => (
                  <div
                    key={msg.id}
                    className={cn(
                      "flex",
                      msg.direction === "outgoing" ? "justify-end" : "justify-start"
                    )}
                    data-testid={`message-${msg.id}`}
                  >
                    <div
                      className={cn(
                        "max-w-md rounded-lg px-4 py-2 shadow-sm",
                        msg.direction === "outgoing"
                          ? "bg-[hsl(142,71%,45%)] text-white"
                          : "bg-background border"
                      )}
                    >
                      <p className="text-sm whitespace-pre-wrap break-words">{msg.message}</p>
                      <div className="flex items-center gap-1 justify-end mt-1">
                        <span
                          className={cn(
                            "text-xs",
                            msg.direction === "outgoing" ? "text-white/70" : "text-muted-foreground"
                          )}
                        >
                          {format(new Date(msg.sentAt), "HH:mm", { locale: he })}
                        </span>
                        {msg.direction === "outgoing" && (
                          <span className="text-white/70">{getStatusIcon(msg.status)}</span>
                        )}
                      </div>
                      {msg.errorMessage && (
                        <p className="text-xs text-destructive mt-1">שגיאה: {msg.errorMessage}</p>
                      )}
                    </div>
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>
            </ScrollArea>

            {/* Message Input */}
            <div className="p-4 border-t bg-background">
              <div className="flex gap-2 max-w-4xl mx-auto">
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
                  disabled={sendMessageMutation.isPending}
                  className="flex-1"
                  data-testid="input-message"
                />
                <Button
                  onClick={handleSendMessage}
                  disabled={!newMessage.trim() || sendMessageMutation.isPending}
                  data-testid="button-send"
                >
                  <Send className="w-4 h-4 ml-2" />
                  {sendMessageMutation.isPending ? "שולח..." : "שלח"}
                </Button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Tags Dialog */}
      <Dialog open={isTagsDialogOpen} onOpenChange={setIsTagsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>ניהול תגיות</DialogTitle>
            <DialogDescription>
              הוסף או הסר תגיות עבור {editingCandidate?.firstName} {editingCandidate?.lastName}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex gap-2">
              <Input
                placeholder="הוסף תגית חדשה..."
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
              <Button onClick={handleAddTag} disabled={!newTag.trim()} data-testid="button-add-tag">
                <Tag className="w-4 h-4 ml-2" />
                הוסף
              </Button>
            </div>
            
            {editingCandidate?.tags && editingCandidate.tags.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-medium">תגיות קיימות:</p>
                <div className="flex flex-wrap gap-2">
                  {editingCandidate.tags.map((tag) => (
                    <Badge key={tag} variant="secondary" className="gap-1">
                      {tag}
                      <button
                        onClick={() => handleRemoveTag(tag)}
                        className="rounded-full p-0.5 hover:bg-destructive/20"
                        data-testid={`button-remove-tag-${tag}`}
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              onClick={() => {
                setIsTagsDialogOpen(false);
                setEditingCandidate(null);
                setNewTag("");
              }}
              data-testid="button-close-tags"
            >
              סגור
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
