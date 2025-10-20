import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { Upload, FileText, CheckCircle, XCircle, AlertCircle, Download, ShieldAlert } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { usePermissions } from "@/hooks/usePermissions";
import { useLocation } from "wouter";

interface ImportResult {
  filename: string;
  status: 'success' | 'failed' | 'duplicate';
  candidateId?: string;
  candidateName?: string;
  existingCandidateId?: string;
  existingCandidateName?: string;
  error?: string;
  extractedData?: {
    name?: string;
    email?: string;
    mobile?: string;
    profession?: string;
  };
}

interface ImportSummary {
  total: number;
  success: number;
  duplicate: number;
  failed: number;
}

export default function BulkImportCandidates() {
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState<ImportResult[]>([]);
  const [summary, setSummary] = useState<ImportSummary | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const { isSuperAdmin, isLoading } = usePermissions();
  const [, setLocation] = useLocation();

  useEffect(() => {
    // Only redirect if loading is done and user is not super admin
    if (!isLoading && !isSuperAdmin) {
      toast({
        title: "אין הרשאת גישה",
        description: "רק סופר אדמין יכול לגשת לעמוד זה",
        variant: "destructive"
      });
      setLocation('/');
    }
  }, [isSuperAdmin, isLoading, setLocation, toast]);

  // Show loading while checking permissions
  if (isLoading) {
    return (
      <div className="container mx-auto py-8">
        <Card>
          <CardContent className="py-8">
            <p className="text-center text-muted-foreground">טוען...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Show access denied if not super admin
  if (!isSuperAdmin) {
    return (
      <div className="container mx-auto py-8">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShieldAlert className="h-6 w-6 text-red-500" />
              אין הרשאת גישה
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">
              רק סופר אדמין יכול לגשת לעמוד זה. אתה מועבר לדף הבית...
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const files = Array.from(e.target.files);
      setSelectedFiles(files);
      setResults([]);
      setSummary(null);
    }
  };

  const handleImport = async () => {
    if (selectedFiles.length === 0) {
      toast({
        title: "שגיאה",
        description: "אנא בחר קבצים לייבוא",
        variant: "destructive"
      });
      return;
    }

    setImporting(true);
    setProgress(0);
    setResults([]);
    setSummary(null);

    const BATCH_SIZE = 100;
    const allResults: ImportResult[] = [];
    let totalSuccess = 0;
    let totalDuplicate = 0;
    let totalFailed = 0;

    try {
      const totalBatches = Math.ceil(selectedFiles.length / BATCH_SIZE);

      for (let i = 0; i < selectedFiles.length; i += BATCH_SIZE) {
        const batchFiles = selectedFiles.slice(i, i + BATCH_SIZE);
        const currentBatch = Math.floor(i / BATCH_SIZE) + 1;

        const formData = new FormData();
        batchFiles.forEach(file => {
          formData.append('cvFiles', file);
        });

        const response = await fetch('/api/candidates/bulk-import', {
          method: 'POST',
          body: formData,
          credentials: 'include'
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.message || 'שגיאה בייבוא');
        }

        const data = await response.json();
        
        allResults.push(...data.results);
        totalSuccess += data.summary.success;
        totalDuplicate += data.summary.duplicate;
        totalFailed += data.summary.failed;

        const progressPercent = Math.round((currentBatch / totalBatches) * 100);
        setProgress(progressPercent);
        setResults([...allResults]);
        setSummary({
          total: selectedFiles.length,
          success: totalSuccess,
          duplicate: totalDuplicate,
          failed: totalFailed
        });
      }

      toast({
        title: "ייבוא הושלם!",
        description: `${totalSuccess} מועמדים נוצרו בהצלחה מתוך ${selectedFiles.length} קבצים`,
      });

    } catch (error) {
      console.error('Import error:', error);
      toast({
        title: "שגיאה בייבוא",
        description: error instanceof Error ? error.message : "אירעה שגיאה לא צפויה",
        variant: "destructive"
      });
    } finally {
      setImporting(false);
    }
  };

  const handleReset = () => {
    setSelectedFiles([]);
    setResults([]);
    setSummary(null);
    setProgress(0);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success':
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'duplicate':
        return <AlertCircle className="h-5 w-5 text-yellow-500" />;
      case 'failed':
        return <XCircle className="h-5 w-5 text-red-500" />;
      default:
        return null;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'success':
        return <Badge className="bg-green-500">הצליח</Badge>;
      case 'duplicate':
        return <Badge className="bg-yellow-500">כפול</Badge>;
      case 'failed':
        return <Badge variant="destructive">נכשל</Badge>;
      default:
        return null;
    }
  };

  return (
    <div className="container mx-auto p-6 max-w-6xl" dir="rtl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">ייבוא מרובה של מועמדים</h1>
        <p className="text-muted-foreground mt-2">
          העלה עד 20,000 קבצי קורות חיים (PDF, DOCX, תמונות) - המערכת תעלה 100 קבצים בכל בקשה ותעבד 10 במקביל לחילוץ פרטים אוטומטי
        </p>
      </div>

      <div className="grid gap-6">
        {/* Upload Section */}
        <Card>
          <CardHeader>
            <CardTitle>בחירת קבצים</CardTitle>
            <CardDescription>
              בחר עד 20,000 קבצי קורות חיים. המערכת תעלה 100 קבצים בכל בקשה ותעבד 10 במקביל. נתמכים: PDF, DOC, DOCX, JPG, PNG
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-4">
              <Button
                onClick={() => fileInputRef.current?.click()}
                disabled={importing}
                variant="outline"
                data-testid="button-select-files"
              >
                <Upload className="h-4 w-4 ml-2" />
                בחר קבצים
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.gif,.bmp,.tiff,.webp"
                onChange={handleFileSelect}
                className="hidden"
                data-testid="input-file-upload"
              />
              {selectedFiles.length > 0 && (
                <span className="text-sm text-muted-foreground">
                  {selectedFiles.length} קבצים נבחרו
                </span>
              )}
            </div>

            {selectedFiles.length > 0 && (
              <div className="space-y-2">
                <h3 className="font-medium">קבצים שנבחרו:</h3>
                <div className="max-h-40 overflow-y-auto space-y-1">
                  {selectedFiles.map((file, index) => (
                    <div key={index} className="flex items-center gap-2 text-sm p-2 bg-muted rounded" data-testid={`file-item-${index}`}>
                      <FileText className="h-4 w-4" />
                      <span>{file.name}</span>
                      <span className="text-muted-foreground">
                        ({(file.size / 1024).toFixed(1)} KB)
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex gap-2">
              <Button
                onClick={handleImport}
                disabled={importing || selectedFiles.length === 0}
                data-testid="button-start-import"
              >
                {importing ? 'מייבא...' : 'התחל ייבוא'}
              </Button>
              {(selectedFiles.length > 0 || results.length > 0) && (
                <Button
                  onClick={handleReset}
                  variant="outline"
                  disabled={importing}
                  data-testid="button-reset"
                >
                  איפוס
                </Button>
              )}
            </div>

            {importing && (
              <div className="space-y-2">
                <Progress value={progress} className="w-full" />
                <p className="text-sm text-muted-foreground text-center">
                  מייבא מועמדים... {progress}%
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Summary */}
        {summary && (
          <Card>
            <CardHeader>
              <CardTitle>סיכום ייבוא</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-4 gap-4">
                <div className="text-center p-4 bg-muted rounded-lg" data-testid="summary-total">
                  <div className="text-2xl font-bold">{summary.total}</div>
                  <div className="text-sm text-muted-foreground">סה"כ קבצים</div>
                </div>
                <div className="text-center p-4 bg-green-50 dark:bg-green-950 rounded-lg" data-testid="summary-success">
                  <div className="text-2xl font-bold text-green-600 dark:text-green-400">{summary.success}</div>
                  <div className="text-sm text-muted-foreground">הצליחו</div>
                </div>
                <div className="text-center p-4 bg-yellow-50 dark:bg-yellow-950 rounded-lg" data-testid="summary-duplicate">
                  <div className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">{summary.duplicate}</div>
                  <div className="text-sm text-muted-foreground">כפולים</div>
                </div>
                <div className="text-center p-4 bg-red-50 dark:bg-red-950 rounded-lg" data-testid="summary-failed">
                  <div className="text-2xl font-bold text-red-600 dark:text-red-400">{summary.failed}</div>
                  <div className="text-sm text-muted-foreground">נכשלו</div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Results */}
        {results.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>תוצאות ייבוא</CardTitle>
              <CardDescription>
                פרטים על כל קובץ שעובד
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {results.map((result, index) => (
                  <div
                    key={index}
                    className="border rounded-lg p-4 space-y-2"
                    data-testid={`result-item-${index}`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3 flex-1">
                        {getStatusIcon(result.status)}
                        <div className="flex-1">
                          <div className="font-medium">{result.filename}</div>
                          {result.status === 'success' && result.candidateName && (
                            <div className="text-sm text-green-600 dark:text-green-400">
                              נוצר מועמד: {result.candidateName}
                            </div>
                          )}
                          {result.status === 'duplicate' && result.existingCandidateName && (
                            <div className="text-sm text-yellow-600 dark:text-yellow-400">
                              כבר קיים: {result.existingCandidateName}
                            </div>
                          )}
                          {result.status === 'failed' && result.error && (
                            <div className="text-sm text-red-600 dark:text-red-400">
                              {result.error}
                            </div>
                          )}
                          {result.extractedData && (
                            <div className="text-xs text-muted-foreground mt-1">
                              {result.extractedData.name && <span>שם: {result.extractedData.name} | </span>}
                              {result.extractedData.email && <span>מייל: {result.extractedData.email} | </span>}
                              {result.extractedData.mobile && <span>נייד: {result.extractedData.mobile}</span>}
                            </div>
                          )}
                        </div>
                      </div>
                      {getStatusBadge(result.status)}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Instructions */}
        <Alert>
          <AlertDescription className="space-y-2">
            <div className="font-medium">הוראות שימוש:</div>
            <ul className="list-disc list-inside space-y-1 text-sm">
              <li>בחר עד 20,000 קבצים - המערכת תעלה 100 קבצים בכל בקשה ותעבד 10 במקביל</li>
              <li>המערכת תחלץ אוטומטית: שם, טלפון, מייל ומקצוע</li>
              <li>קבצים עם פרטים כפולים (טלפון/מייל זהים) לא ייוצרו ויסומנו ככפולים</li>
              <li>כל מועמד שנוצר יקבל אירוע "נוצר באמצעות ייבוא מרובה" בטיימליין שלו</li>
            </ul>
          </AlertDescription>
        </Alert>
      </div>
    </div>
  );
}
