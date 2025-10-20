import { useEffect, useState } from 'react';
import { X, MessageCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { format } from 'date-fns';
import { he } from 'date-fns/locale';

interface WhatsAppNotification {
  id: string;
  senderName: string;
  senderNumber: string;
  messagePreview: string;
  profilePic?: string;
  timestamp: Date;
}

interface MessageNotificationProps {
  notification: WhatsAppNotification;
  onClose: () => void;
  onClick: () => void;
}

export function MessageNotification({ notification, onClose, onClick }: MessageNotificationProps) {
  const [isVisible, setIsVisible] = useState(true);

  // Auto-close after 5 seconds
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(false);
      setTimeout(onClose, 300); // Wait for animation to complete
    }, 5000);

    return () => clearTimeout(timer);
  }, [onClose]);

  const handleClose = () => {
    setIsVisible(false);
    setTimeout(onClose, 300);
  };

  return (
    <div
      className={`fixed top-20 left-1/2 transform -translate-x-1/2 z-50 transition-all duration-300 ${
        isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4'
      }`}
      dir="rtl"
      data-testid="whatsapp-notification"
    >
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl border border-gray-200 dark:border-gray-700 p-4 min-w-[350px] max-w-[400px]">
        <div className="flex items-start gap-3">
          {/* Avatar */}
          <Avatar className="h-12 w-12">
            <AvatarImage src={notification.profilePic} />
            <AvatarFallback className="bg-green-500 text-white">
              {notification.senderName.charAt(0)}
            </AvatarFallback>
          </Avatar>

          {/* Content */}
          <button
            onClick={onClick}
            className="flex-1 text-right hover:opacity-80 transition-opacity"
            data-testid="button-open-notification"
          >
            <div className="flex items-center gap-2 mb-1">
              <MessageCircle className="h-4 w-4 text-green-500" />
              <h4 className="font-semibold text-sm">{notification.senderName}</h4>
              <span className="text-xs text-gray-500 mr-auto">
                {format(notification.timestamp, 'HH:mm', { locale: he })}
              </span>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-300 line-clamp-2">
              {notification.messagePreview}
            </p>
          </button>

          {/* Close Button */}
          <Button
            variant="ghost"
            size="sm"
            onClick={handleClose}
            className="h-6 w-6 p-0"
            data-testid="button-close-notification"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

export function WhatsAppNotificationContainer() {
  const [notifications, setNotifications] = useState<WhatsAppNotification[]>([]);

  // In a real implementation, this would listen to WhatsApp events
  // For now, we'll export a function to add notifications
  useEffect(() => {
    // Listen to custom events for new WhatsApp messages
    const handleNewMessage = (event: CustomEvent<WhatsAppNotification>) => {
      setNotifications((prev) => [...prev, event.detail]);
    };

    window.addEventListener('whatsapp:newMessage' as any, handleNewMessage);

    return () => {
      window.removeEventListener('whatsapp:newMessage' as any, handleNewMessage);
    };
  }, []);

  const handleOpenChat = (notification: WhatsAppNotification) => {
    // Dispatch event to open chat panel with this conversation
    window.dispatchEvent(
      new CustomEvent('whatsapp:openChat', {
        detail: { remoteJid: notification.senderNumber },
      })
    );
    removeNotification(notification.id);
  };

  const removeNotification = (id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  };

  return (
    <>
      {notifications.map((notification) => (
        <MessageNotification
          key={notification.id}
          notification={notification}
          onClose={() => removeNotification(notification.id)}
          onClick={() => handleOpenChat(notification)}
        />
      ))}
    </>
  );
}

// Helper function to trigger notifications from anywhere in the app
export function showWhatsAppNotification(notification: Omit<WhatsAppNotification, 'id'>) {
  window.dispatchEvent(
    new CustomEvent('whatsapp:newMessage', {
      detail: {
        ...notification,
        id: `notification_${Date.now()}_${Math.random()}`,
      },
    })
  );
}
