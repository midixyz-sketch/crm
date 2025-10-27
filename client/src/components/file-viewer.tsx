import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Download, X, ZoomIn, ZoomOut, ChevronLeft, ChevronRight } from "lucide-react";
import { Document, Page, pdfjs } from 'react-pdf';
import * as mammoth from 'mammoth';

pdfjs.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.js`;

interface FileViewerProps {
  isOpen: boolean;
  onClose: () => void;
  fileUrl: string;
  fileName: string;
  mimeType?: string;
}

export function FileViewer({ isOpen, onClose, fileUrl, fileName, mimeType }: FileViewerProps) {
  const [numPages, setNumPages] = useState<number>(0);
  const [pageNumber, setPageNumber] = useState<number>(1);
  const [scale, setScale] = useState<number>(1.2);
  const [docxHtml, setDocxHtml] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>("");

  useEffect(() => {
    if (!isOpen) return;
    
    setDocxHtml("");
    setError("");
    setNumPages(0);
    setPageNumber(1);
    setScale(1.2);
    
    if (isDocx) {
      loadDocx();
    }
  }, [isOpen, fileUrl, fileName]);

  const loadDocx = async () => {
    try {
      setLoading(true);
      setError("");
      
      const response = await fetch(fileUrl);
      const arrayBuffer = await response.arrayBuffer();
      
      const result = await mammoth.convertToHtml({ arrayBuffer });
      setDocxHtml(result.value);
    } catch (err) {
      console.error('Error loading DOCX:', err);
      setError('שגיאה בטעינת המסמך. נסה להוריד אותו במקום.');
    } finally {
      setLoading(false);
    }
  };

  function onDocumentLoadSuccess({ numPages }: { numPages: number }) {
    setNumPages(numPages);
    setPageNumber(1);
  }

  const isPDF = mimeType === 'application/pdf' || fileName.toLowerCase().endsWith('.pdf');
  const isDocx = mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || 
                 fileName.toLowerCase().endsWith('.docx');
  const isImage = mimeType?.startsWith('image/') || /\.(jpg|jpeg|png|gif|webp|bmp)$/i.test(fileName);

  const handleDownload = () => {
    const link = document.createElement('a');
    link.href = fileUrl;
    link.download = fileName;
    link.target = '_blank';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl max-h-[95vh] overflow-hidden flex flex-col p-0">
        <DialogHeader className="flex-shrink-0 p-6 pb-4 border-b">
          <div className="flex items-center justify-between gap-4">
            <DialogTitle className="text-right flex-1 text-lg font-semibold truncate">
              {fileName}
            </DialogTitle>
            <div className="flex gap-2 flex-shrink-0">
              {isPDF && (
                <>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setScale(s => Math.max(0.5, s - 0.2))}
                    data-testid="button-zoom-out"
                    title="הקטן"
                  >
                    <ZoomOut className="w-4 h-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setScale(s => Math.min(2.5, s + 0.2))}
                    data-testid="button-zoom-in"
                    title="הגדל"
                  >
                    <ZoomIn className="w-4 h-4" />
                  </Button>
                </>
              )}
              <Button
                size="sm"
                variant="outline"
                onClick={handleDownload}
                data-testid="button-download-file"
                title="הורד קובץ"
              >
                <Download className="w-4 h-4 ml-2" />
                הורדה
              </Button>
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-auto bg-gradient-to-b from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-950" data-testid="file-viewer-content">
          {loading && (
            <div className="flex items-center justify-center h-full min-h-[400px]">
              <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
                <div className="text-gray-600 dark:text-gray-400">טוען מסמך...</div>
              </div>
            </div>
          )}

          {error && (
            <div className="flex flex-col items-center justify-center h-full min-h-[400px] gap-4 p-8">
              <div className="text-red-600 dark:text-red-400 text-center max-w-md">
                <div className="text-4xl mb-4">⚠️</div>
                <div className="text-lg font-semibold mb-2">שגיאה בטעינת הקובץ</div>
                <div className="text-sm">{error}</div>
              </div>
              <Button onClick={handleDownload} variant="default">
                <Download className="w-4 h-4 ml-2" />
                הורד קובץ
              </Button>
            </div>
          )}

          {!loading && !error && isPDF && (
            <div className="flex flex-col items-center gap-6 py-8 px-4">
              <Document
                file={fileUrl}
                onLoadSuccess={onDocumentLoadSuccess}
                onLoadError={(error) => {
                  console.error('PDF load error:', error);
                  setError('שגיאה בטעינת PDF. נסה להוריד אותו במקום.');
                }}
                className="shadow-2xl rounded-lg overflow-hidden"
                loading={
                  <div className="flex items-center justify-center min-h-[600px]">
                    <div className="text-center">
                      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
                      <div className="text-gray-600 dark:text-gray-400">טוען PDF...</div>
                    </div>
                  </div>
                }
              >
                <Page 
                  pageNumber={pageNumber}
                  scale={scale}
                  renderTextLayer={true}
                  renderAnnotationLayer={true}
                  className="shadow-lg"
                />
              </Document>
              
              {numPages > 1 && (
                <div className="flex items-center gap-4 bg-white dark:bg-gray-800 px-6 py-3 rounded-full shadow-lg border border-gray-200 dark:border-gray-700">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setPageNumber(p => Math.max(1, p - 1))}
                    disabled={pageNumber <= 1}
                    data-testid="button-prev-page"
                  >
                    <ChevronRight className="w-5 h-5" />
                  </Button>
                  <span className="text-sm font-medium min-w-[120px] text-center">
                    עמוד {pageNumber} מתוך {numPages}
                  </span>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setPageNumber(p => Math.min(numPages, p + 1))}
                    disabled={pageNumber >= numPages}
                    data-testid="button-next-page"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </Button>
                </div>
              )}
            </div>
          )}

          {!loading && !error && isDocx && docxHtml && (
            <div className="max-w-5xl mx-auto p-8">
              <div 
                className="bg-white dark:bg-gray-800 p-12 rounded-lg shadow-xl prose prose-lg dark:prose-invert max-w-none"
                dangerouslySetInnerHTML={{ __html: docxHtml }}
                dir="rtl"
                style={{
                  fontFamily: 'Arial, sans-serif',
                  lineHeight: '1.8',
                  textAlign: 'right'
                }}
              />
            </div>
          )}

          {!loading && !error && isImage && (
            <div className="flex items-center justify-center min-h-[400px] p-8">
              <img 
                src={fileUrl} 
                alt={fileName}
                className="max-w-full max-h-[80vh] object-contain rounded-lg shadow-2xl"
                data-testid="image-preview"
              />
            </div>
          )}

          {!loading && !error && !isPDF && !isDocx && !isImage && (
            <div className="flex flex-col items-center justify-center h-full min-h-[400px] gap-4 p-8">
              <div className="text-gray-500 dark:text-gray-400 text-center max-w-md">
                <div className="text-6xl mb-4">📄</div>
                <div className="text-lg font-semibold mb-2">תצוגה מקדימה לא זמינה</div>
                <div className="text-sm">סוג הקובץ לא נתמך להצגה בדפדפן</div>
              </div>
              <Button onClick={handleDownload} variant="default">
                <Download className="w-4 h-4 ml-2" />
                הורד קובץ
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
