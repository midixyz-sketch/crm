import { useState } from 'react';
import { FileText, X, Upload, CheckCircle2, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useMutation } from '@tanstack/react-query';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';

interface CVImportDialogProps {
  isOpen: boolean;
  onClose: () => void;
  fileInfo: {
    fileName: string;
    fileUrl: string;
    senderName: string;
    senderNumber: string;
    messageId: string;
  } | null;
}

export function CVImportDialog({ isOpen, onClose, fileInfo }: CVImportDialogProps) {
  const [isImporting, setIsImporting] = useState(false);
  const { toast } = useToast();

  const importCandidateMutation = useMutation({
    mutationFn: async () => {
      if (!fileInfo) return;

      // Download file from WhatsApp
      const downloadResponse = await fetch(fileInfo.fileUrl);
      const blob = await downloadResponse.blob();
      
      // Create form data
      const formData = new FormData();
      formData.append('cv', blob, fileInfo.fileName);
      formData.append('source', 'whatsapp');
      formData.append('mobilePhone', fileInfo.senderNumber);

      // Upload to candidate creation endpoint
      const response = await fetch('/api/candidates/upload-cv', {
        method: 'POST',
        body: formData,
        credentials: 'include',
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to import candidate');
      }

      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: 'מועמד יובא בהצלחה',
        description: `${data.firstName || ''} ${data.lastName || ''} נוסף למערכת`,
      });
      queryClient.invalidateQueries({ queryKey: ['/api/candidates'] });
      onClose();
    },
    onError: (error: Error) => {
      toast({
        title: 'שגיאה בייבוא מועמד',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const handleImport = async () => {
    setIsImporting(true);
    try {
      await importCandidateMutation.mutateAsync();
    } finally {
      setIsImporting(false);
    }
  };

  const handleReject = () => {
    toast({
      title: 'הייבוא בוטל',
      description: 'הקובץ לא יובא',
    });
    onClose();
  };

  if (!fileInfo) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md" dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-green-600" />
            ייבוא קורות חיים מWhatsApp
          </DialogTitle>
          <DialogDescription className="text-right">
            זוהה קובץ קורות חיים. האם תרצה לייבא את המועמד למערכת?
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* File Info */}
          <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-500">שם הקובץ:</span>
                <span className="text-sm font-medium">{fileInfo.fileName}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-500">שולח:</span>
                <span className="text-sm font-medium">{fileInfo.senderName}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-500">טלפון:</span>
                <span className="text-sm font-medium">{fileInfo.senderNumber}</span>
              </div>
            </div>
          </div>

          {/* Import Status */}
          {importCandidateMutation.isPending && (
            <div className="flex items-center gap-2 text-blue-600">
              <Upload className="h-4 w-4 animate-pulse" />
              <span className="text-sm">מייבא את המועמד...</span>
            </div>
          )}

          {importCandidateMutation.isSuccess && (
            <div className="flex items-center gap-2 text-green-600">
              <CheckCircle2 className="h-4 w-4" />
              <span className="text-sm">המועמד יובא בהצלחה!</span>
            </div>
          )}

          {importCandidateMutation.isError && (
            <div className="flex items-center gap-2 text-red-600">
              <XCircle className="h-4 w-4" />
              <span className="text-sm">שגיאה בייבוא המועמד</span>
            </div>
          )}
        </div>

        <DialogFooter className="flex gap-2">
          <Button
            onClick={handleReject}
            variant="outline"
            disabled={isImporting}
            data-testid="button-reject-import"
          >
            <X className="h-4 w-4 ml-2" />
            ביטול
          </Button>
          <Button
            onClick={handleImport}
            disabled={isImporting}
            className="bg-green-600 hover:bg-green-700"
            data-testid="button-confirm-import"
          >
            <Upload className="h-4 w-4 ml-2" />
            {isImporting ? 'מייבא...' : 'ייבא מועמד'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
