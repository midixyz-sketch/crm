import { useQuery } from '@tanstack/react-query';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { MessageCircle, FileText } from 'lucide-react';
import { format } from 'date-fns';
import { he } from 'date-fns/locale';

interface WhatsAppMessage {
  id: string;
  messageId: string;
  fromMe: boolean;
  senderName: string;
  messageText: string;
  messageType: string;
  fileName?: string;
  timestamp: string;
}

interface WhatsAppHistoryTabProps {
  candidateId: string;
}

export function WhatsAppHistoryTab({ candidateId }: WhatsAppHistoryTabProps) {
  const { data, isLoading } = useQuery<WhatsAppMessage[]>({
    queryKey: ['/api/candidates', candidateId, 'whatsapp'],
  });

  // Ensure messages is always an array
  const messages = Array.isArray(data) ? data : [];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600 mx-auto mb-4"></div>
          <p className="text-sm text-gray-500">טוען היסטוריית שיחות...</p>
        </div>
      </div>
    );
  }

  if (messages.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12" dir="rtl">
        <MessageCircle className="h-16 w-16 text-gray-300 mb-4" />
        <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
          אין שיחות WhatsApp
        </h3>
        <p className="text-sm text-gray-500 dark:text-gray-400 text-center max-w-md">
          עדיין לא נשלחו או התקבלו הודעות WhatsApp עם מועמד זה.
        </p>
      </div>
    );
  }

  return (
    <div className="p-6" dir="rtl">
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm">
        {/* Header */}
        <div className="border-b border-gray-200 dark:border-gray-700 px-6 py-4">
          <div className="flex items-center gap-2">
            <MessageCircle className="h-5 w-5 text-green-600" />
            <h3 className="text-lg font-medium">היסטוריית שיחות WhatsApp</h3>
            <span className="text-sm text-gray-500">
              ({messages.length} הודעות)
            </span>
          </div>
        </div>

        {/* Messages */}
        <ScrollArea className="h-[500px]">
          <div className="p-6 space-y-4">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${message.fromMe ? 'justify-start' : 'justify-end'} mb-3`}
                data-testid={`whatsapp-message-${message.id}`}
              >
                <div
                  className={`max-w-[70%] rounded-lg p-4 ${
                    message.fromMe
                      ? 'bg-green-500 text-white'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-gray-100'
                  }`}
                >
                  {/* File attachment indicator */}
                  {message.messageType === 'document' && message.fileName && (
                    <div className="flex items-center gap-2 mb-2 pb-2 border-b border-white/20">
                      <FileText className="h-4 w-4" />
                      <span className="text-sm font-medium">{message.fileName}</span>
                    </div>
                  )}

                  {/* Message text */}
                  <p className="text-sm whitespace-pre-wrap break-words">
                    {message.messageText}
                  </p>

                  {/* Timestamp */}
                  <div className="flex items-center justify-between mt-2 pt-2 border-t border-white/20">
                    <span className="text-xs opacity-75">
                      {format(new Date(message.timestamp), 'dd/MM/yyyy HH:mm', { locale: he })}
                    </span>
                    <span className="text-xs opacity-75">
                      {message.fromMe ? 'נשלח' : 'התקבל'}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}
