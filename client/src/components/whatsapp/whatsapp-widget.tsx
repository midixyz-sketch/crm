import { useState, useEffect } from 'react';
import { WhatsAppFloatingButton } from './floating-button';
import { WhatsAppChatPanel } from './chat-panel';
import { CVImportDialog } from './cv-import-dialog';
import { useQuery } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { apiRequest } from '@/lib/queryClient';

export function WhatsAppWidget() {
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [connectionDialogOpen, setConnectionDialogOpen] = useState(false);
  const [cvImportDialogOpen, setCvImportDialogOpen] = useState(false);
  const [pendingCVFile, setPendingCVFile] = useState<{
    fileName: string;
    fileUrl: string;
    senderName: string;
    senderNumber: string;
    messageId: string;
  } | null>(null);
  const { toast } = useToast();

  // Get WhatsApp status
  const { data: status } = useQuery<{
    isConnected: boolean;
    phoneNumber: string | null;
    qrCode: string | null;
  }>({
    queryKey: ['/api/whatsapp/status'],
    refetchInterval: 5000, // Check status every 5 seconds
  });

  // Get unread count (only fetch 100 chats for performance)
  const { data: chats = [] } = useQuery<Array<{ unreadCount: number }>>({
    queryKey: ['/api/whatsapp/chats', 'widget'],
    refetchInterval: 5000,
    queryFn: async () => {
      const response = await fetch('/api/whatsapp/chats?tab=individual&limit=100');
      if (!response.ok) throw new Error('Failed to fetch chats');
      return response.json();
    },
  });

  const totalUnread = chats.reduce((sum, chat) => sum + (chat.unreadCount || 0), 0);

  // Auto-open chat panel when connected, close when disconnected
  useEffect(() => {
    if (status?.isConnected) {
      // Connected - close connection dialog and open chat panel
      setConnectionDialogOpen(false);
      setIsPanelOpen(true);
    } else if (status !== undefined && !status?.isConnected) {
      // Disconnected - close chat panel immediately
      setIsPanelOpen(false);
    }
  }, [status?.isConnected]);

  // Listen for CV file detection
  useEffect(() => {
    const handleCVDetected = (event: CustomEvent) => {
      setPendingCVFile(event.detail);
      setCvImportDialogOpen(true);
    };

    window.addEventListener('whatsapp:cvDetected' as any, handleCVDetected);

    return () => {
      window.removeEventListener('whatsapp:cvDetected' as any, handleCVDetected);
    };
  }, []);

  const handleFloatingButtonClick = async () => {
    // If WhatsApp is connected, open chat panel
    // If not connected, initialize and open connection dialog with QR
    if (status?.isConnected) {
      setIsPanelOpen(!isPanelOpen);
    } else {
      // Auto-initialize WhatsApp to show QR code directly
      setConnectionDialogOpen(true);
      if (!status?.qrCode) {
        try {
          await apiRequest('POST', '/api/whatsapp/initialize', {});
        } catch (error) {
          // Silent - dialog will show the state
        }
      }
    }
  };

  const handleInitializeWhatsApp = async () => {
    try {
      await apiRequest('POST', '/api/whatsapp/initialize', {});
      toast({
        title: "WhatsApp מאותחל",
        description: "סרוק את קוד ה-QR עם WhatsApp בטלפון שלך",
      });
    } catch (error) {
      toast({
        title: "שגיאה",
        description: "לא ניתן לאתחל את WhatsApp",
        variant: "destructive",
      });
    }
  };

  const handleDisconnect = async () => {
    try {
      await apiRequest('POST', '/api/whatsapp/logout', {});
      toast({
        title: "התנתקת מWhatsApp",
        description: "WhatsApp נותק בהצלחה",
      });
      setConnectionDialogOpen(false);
    } catch (error) {
      toast({
        title: "שגיאה",
        description: "לא ניתן להתנתק מWhatsApp",
        variant: "destructive",
      });
    }
  };

  return (
    <>
      <WhatsAppFloatingButton
        onClick={handleFloatingButtonClick}
        hasNewMessages={totalUnread > 0}
        messageCount={totalUnread}
      />
      
      {/* Connection Dialog */}
      <Dialog open={connectionDialogOpen} onOpenChange={setConnectionDialogOpen}>
        <DialogContent className="sm:max-w-md" dir="rtl">
          <DialogHeader>
            <DialogTitle>חיבור WhatsApp</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            {status?.isConnected ? (
              <div className="text-center space-y-4">
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
                  <svg className="w-10 h-10 text-green-600" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
                  </svg>
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-green-600">מחובר בהצלחה!</h3>
                  <p className="text-sm text-gray-600 mt-2">
                    WhatsApp מחובר למספר: {status.phoneNumber || 'לא זמין'}
                  </p>
                </div>
                <Button
                  onClick={handleDisconnect}
                  variant="outline"
                  className="w-full"
                >
                  התנתק מWhatsApp
                </Button>
              </div>
            ) : status?.qrCode ? (
              <div className="text-center space-y-4">
                <p className="text-sm text-gray-600">
                  סרוק את קוד ה-QR עם WhatsApp בטלפון שלך
                </p>
                <div className="flex justify-center bg-white p-4 rounded-lg">
                  <img 
                    src={status.qrCode} 
                    alt="WhatsApp QR Code"
                    className="w-64 h-64"
                  />
                </div>
                <div className="text-xs text-gray-500 space-y-1">
                  <p>1. פתח WhatsApp בטלפון שלך</p>
                  <p>2. לחץ על תפריט (⋮) או הגדרות</p>
                  <p>3. בחר "מכשירים מקושרים"</p>
                  <p>4. לחץ על "קשר מכשיר"</p>
                  <p>5. סרוק את הקוד</p>
                </div>
              </div>
            ) : (
              <div className="text-center space-y-4 py-8">
                <div className="w-16 h-16 border-4 border-green-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
                <p className="text-sm text-gray-600">מאתחל את WhatsApp...</p>
                <p className="text-xs text-gray-500">מייצר קוד QR</p>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <WhatsAppChatPanel
        isOpen={isPanelOpen}
        onClose={() => setIsPanelOpen(false)}
      />
      <CVImportDialog
        isOpen={cvImportDialogOpen}
        onClose={() => {
          setCvImportDialogOpen(false);
          setPendingCVFile(null);
        }}
        fileInfo={pendingCVFile}
      />
    </>
  );
}
