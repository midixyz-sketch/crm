import { useState, useEffect } from 'react';
import { WhatsAppFloatingButton } from './floating-button';
import { WhatsAppChatPanel } from './chat-panel';
import { CVImportDialog } from './cv-import-dialog';
import { useQuery } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';

export function WhatsAppWidget() {
  const [isPanelOpen, setIsPanelOpen] = useState(false);
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

  // Get unread count
  const { data: chats = [] } = useQuery<Array<{ unreadCount: number }>>({
    queryKey: ['/api/whatsapp/chats'],
    refetchInterval: 5000,
  });

  const totalUnread = chats.reduce((sum, chat) => sum + (chat.unreadCount || 0), 0);

  // Auto-initialize WhatsApp on component mount if not connected
  useEffect(() => {
    if (status && !status.isConnected && !status.qrCode) {
      // Initialize WhatsApp connection
      fetch('/api/whatsapp/initialize', {
        method: 'POST',
        credentials: 'include',
      }).catch((error) => {
        console.error('Failed to initialize WhatsApp:', error);
      });
    }
  }, [status?.isConnected]);

  // Show toast when WhatsApp connects/disconnects
  useEffect(() => {
    if (status?.isConnected && status.phoneNumber) {
      toast({
        title: 'WhatsApp מחובר',
        description: `מחובר למספר: ${status.phoneNumber}`,
        duration: 3000,
      });
    }
  }, [status?.isConnected, status?.phoneNumber]);

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

  const togglePanel = () => {
    setIsPanelOpen(!isPanelOpen);
  };

  return (
    <>
      <WhatsAppFloatingButton
        onClick={togglePanel}
        hasNewMessages={totalUnread > 0}
        messageCount={totalUnread}
      />
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
