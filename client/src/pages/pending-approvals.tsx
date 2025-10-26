import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { CheckCircle, XCircle, Clock, User, Eye } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";

export default function PendingApprovalsPage() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [selectedCandidate, setSelectedCandidate] = useState<any>(null);
  const [editedNotes, setEditedNotes] = useState<string>("");

  // קבלת רשימת מועמדים ממתינים לאישור - מועמדים שהועלו על ידי רכזים חיצוניים
  const { data: candidatesData, isLoading } = useQuery({
    queryKey: ["/api/candidates/enriched", { statuses: "pending_approval,pending" }],
  });

  // סינון רק מועמדים שהועלו על ידי רכזים חיצוניים
  const allCandidates = candidatesData?.candidates || [];
  const candidates = allCandidates.filter((c: any) => c.createdByRoleType === 'external_recruiter');

  // מוטציה לאישור מועמד - משנה סטטוס ל-"נשלח למעסיק"
  const approveMutation = useMutation({
    mutationFn: async ({ candidateId, notes }: { candidateId: string; notes: string }) => {
      return await apiRequest("PATCH", `/api/candidates/${candidateId}`, { status: "sent_to_employer", notes });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/candidates"] });
      queryClient.invalidateQueries({ queryKey: ["/api/candidates/enriched"] });
      toast({
        title: "הצלחה",
        description: "המועמד אושר בהצלחה",
      });
    },
    onError: () => {
      toast({
        title: "שגיאה",
        description: "אירעה שגיאה באישור המועמד",
        variant: "destructive",
      });
    },
  });

  // מוטציה לדחיית מועמד
  const rejectMutation = useMutation({
    mutationFn: async (candidateId: string) => {
      return await apiRequest("PATCH", `/api/candidates/${candidateId}`, { status: "rejected" });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/candidates"] });
      queryClient.invalidateQueries({ queryKey: ["/api/candidates/enriched"] });
      toast({
        title: "הצלחה",
        description: "המועמד נדחה",
      });
    },
    onError: () => {
      toast({
        title: "שגיאה",
        description: "אירעה שגיאה בדחיית המועמד",
        variant: "destructive",
      });
    },
  });

  if (isLoading) {
    return (
      <div className="container mx-auto p-6" dir="rtl">
        <div className="text-center py-8">טוען...</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6" dir="rtl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <Clock className="w-8 h-8" />
          מועמדים ממתינים לאישור
        </h1>
        <p className="text-muted-foreground mt-2">
          מועמדים שהועלו על ידי רכזים חיצוניים וממתינים לאישור מנהל
        </p>
      </div>

      {candidates.length === 0 ? (
        <div className="text-center py-12">
          <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold mb-2">אין מועמדים ממתינים</h2>
          <p className="text-muted-foreground">
            כל המועמדים מרכזים חיצוניים אושרו או נדחו
          </p>
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-900 rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-right">מועמד</TableHead>
                <TableHead className="text-right">פרטי קשר</TableHead>
                <TableHead className="text-right">משרה</TableHead>
                <TableHead className="text-right">הועלה על ידי</TableHead>
                <TableHead className="text-right">תאריך העלאה</TableHead>
                <TableHead className="text-right">סטטוס</TableHead>
                <TableHead className="text-right">פעולות</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {candidates.map((candidate: any) => (
                <TableRow key={candidate.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <User className="w-4 h-4 text-muted-foreground" />
                      <div>
                        <div className="font-medium">
                          {candidate.firstName} {candidate.lastName}
                        </div>
                        {candidate.profession && (
                          <div className="text-sm text-muted-foreground">
                            {candidate.profession}
                          </div>
                        )}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="text-sm">
                      {candidate.mobile && <div>📱 {candidate.mobile}</div>}
                      {candidate.email && (
                        <div className="text-muted-foreground">{candidate.email}</div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="text-sm font-medium">
                      {candidate.lastJobTitle || (
                        <span className="text-muted-foreground">לא צוין</span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col gap-1">
                      <div className="font-medium">
                        {candidate.createdByName || candidate.recruitmentSource || "לא ידוע"}
                      </div>
                      {candidate.createdByEmail && (
                        <div className="text-xs text-muted-foreground">
                          {candidate.createdByEmail}
                        </div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    {new Date(candidate.createdAt).toLocaleDateString("he-IL")}
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary" className="bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200">
                      <Clock className="w-3 h-3 ml-1" />
                      ממתין לאישור
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setSelectedCandidate(candidate);
                          setEditedNotes(candidate.notes || "");
                        }}
                        data-testid={`button-view-${candidate.id}`}
                      >
                        <Eye className="w-4 h-4 ml-1" />
                        חוות דעת
                      </Button>
                      <Button
                        variant="default"
                        size="sm"
                        onClick={() => approveMutation.mutate({ candidateId: candidate.id, notes: candidate.notes || "" })}
                        disabled={approveMutation.isPending}
                        data-testid={`button-approve-${candidate.id}`}
                      >
                        <CheckCircle className="w-4 h-4 ml-1" />
                        אשר
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => rejectMutation.mutate(candidate.id)}
                        disabled={rejectMutation.isPending}
                        data-testid={`button-reject-${candidate.id}`}
                      >
                        <XCircle className="w-4 h-4 ml-1" />
                        דחה
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* דיאלוג צפייה וערוך חוות דעת */}
      <Dialog open={!!selectedCandidate} onOpenChange={() => {
        setSelectedCandidate(null);
        setEditedNotes("");
      }}>
        <DialogContent className="sm:max-w-[600px]" dir="rtl">
          <DialogHeader>
            <DialogTitle>
              חוות דעת על {selectedCandidate?.firstName} {selectedCandidate?.lastName}
            </DialogTitle>
            <DialogDescription>
              מועמד שהועלה על ידי: {selectedCandidate?.createdByName || selectedCandidate?.recruitmentSource}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* פרטי המועמד */}
            <div className="bg-slate-50 dark:bg-slate-800 p-4 rounded-lg">
              <h3 className="font-semibold mb-2">פרטי המועמד</h3>
              <div className="space-y-1 text-sm">
                <div><strong>שם:</strong> {selectedCandidate?.firstName} {selectedCandidate?.lastName}</div>
                {selectedCandidate?.mobile && <div><strong>טלפון:</strong> {selectedCandidate.mobile}</div>}
                {selectedCandidate?.email && <div><strong>אימייל:</strong> {selectedCandidate.email}</div>}
                {selectedCandidate?.profession && <div><strong>תחום:</strong> {selectedCandidate.profession}</div>}
              </div>
            </div>

            {/* חוות דעת - ניתנת לעריכה */}
            <div>
              <h3 className="font-semibold mb-2">חוות דעת לשליחה ללקוח</h3>
              <p className="text-sm text-muted-foreground mb-2">
                ניתן לערוך את חוות הדעת לפני השליחה ללקוח
              </p>
              <Textarea
                value={editedNotes}
                onChange={(e) => setEditedNotes(e.target.value)}
                placeholder="חוות דעת על המועמד לשליחה למעסיק..."
                className="min-h-[150px] resize-none"
                dir="rtl"
                data-testid="textarea-notes"
              />
            </div>

            {/* כפתורים */}
            <div className="flex gap-3 pt-4 border-t">
              <Button
                variant="outline"
                onClick={() => setSelectedCandidate(null)}
                className="flex-1"
                data-testid="button-close-dialog"
              >
                סגור
              </Button>
              <Button
                variant="default"
                onClick={() => {
                  approveMutation.mutate({ candidateId: selectedCandidate.id, notes: editedNotes });
                  setSelectedCandidate(null);
                  setEditedNotes("");
                }}
                disabled={approveMutation.isPending}
                className="flex-1"
                data-testid="button-approve-from-dialog"
              >
                <CheckCircle className="w-4 h-4 ml-1" />
                אשר ושלח ללקוח
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
