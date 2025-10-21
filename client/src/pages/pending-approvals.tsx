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
import { CheckCircle, XCircle, Clock, User } from "lucide-react";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";

export default function PendingApprovalsPage() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  // קבלת רשימת מועמדים ממתינים לאישור
  const { data: candidatesData, isLoading } = useQuery({
    queryKey: ["/api/candidates", { status: "pending_approval" }],
  });

  const candidates = candidatesData?.candidates || [];

  // מוטציה לאישור מועמד
  const approveMutation = useMutation({
    mutationFn: async (candidateId: string) => {
      return await apiRequest(`/api/candidates/${candidateId}`, {
        method: "PATCH",
        body: JSON.stringify({ status: "new" }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/candidates"] });
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
      return await apiRequest(`/api/candidates/${candidateId}`, {
        method: "PATCH",
        body: JSON.stringify({ status: "rejected" }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/candidates"] });
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
                <TableHead className="text-right">מקור גיוס</TableHead>
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
                    <Badge variant="outline">{candidate.recruitmentSource || "לא צוין"}</Badge>
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
                        onClick={() => setLocation(`/candidates/${candidate.id}`)}
                        data-testid={`button-view-${candidate.id}`}
                      >
                        צפייה
                      </Button>
                      <Button
                        variant="default"
                        size="sm"
                        onClick={() => approveMutation.mutate(candidate.id)}
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
    </div>
  );
}
