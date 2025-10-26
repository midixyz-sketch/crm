import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Trash2, Users } from "lucide-react";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

export default function ExternalRecruitersPage() {
  const { toast } = useToast();
  const [isAssignDialogOpen, setIsAssignDialogOpen] = useState(false);
  const [selectedRecruiter, setSelectedRecruiter] = useState<string>("");
  const [selectedJob, setSelectedJob] = useState<string>("");
  const [commission, setCommission] = useState<string>("");

  // קבלת רשימת כל המשתמשים עם תפקיד external_recruiter
  const { data: users = [] } = useQuery({
    queryKey: ["/api/users/all"],
  });

  const externalRecruiters = users.filter((user: any) =>
    user.userRoles?.some((ur: any) => ur.role?.type === "external_recruiter")
  );

  // קבלת רשימת כל המשרות הפעילות
  const { data: jobsData } = useQuery({
    queryKey: ["/api/jobs"],
  });

  const activeJobs = jobsData?.jobs?.filter((job: any) => job.status === "active") || [];

  // קבלת כל ההקצאות
  const { data: assignments = [], isLoading } = useQuery({
    queryKey: ["/api/job-assignments"],
  });

  // מוטציה להוספת הקצאה
  const assignMutation = useMutation({
    mutationFn: async (data: { userId: string; jobId: string; commission?: number }) => {
      const res = await apiRequest("POST", "/api/job-assignments", data);
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/job-assignments"] });
      toast({
        title: "הצלחה",
        description: "המשרה הוקצתה לרכז בהצלחה",
      });
      setIsAssignDialogOpen(false);
      setSelectedRecruiter("");
      setSelectedJob("");
      setCommission("");
    },
    onError: () => {
      toast({
        title: "שגיאה",
        description: "אירעה שגיאה בהקצאת המשרה",
        variant: "destructive",
      });
    },
  });

  // מוטציה למחיקת הקצאה
  const deleteMutation = useMutation({
    mutationFn: async (assignmentId: string) => {
      const res = await apiRequest("DELETE", `/api/job-assignments/${assignmentId}`);
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/job-assignments"] });
      toast({
        title: "הצלחה",
        description: "ההקצאה נמחקה בהצלחה",
      });
    },
    onError: () => {
      toast({
        title: "שגיאה",
        description: "אירעה שגיאה במחיקת ההקצאה",
        variant: "destructive",
      });
    },
  });

  const handleAssign = () => {
    if (!selectedRecruiter || !selectedJob) {
      toast({
        title: "שגיאה",
        description: "יש לבחור רכז ומשרה",
        variant: "destructive",
      });
      return;
    }

    assignMutation.mutate({
      userId: selectedRecruiter,
      jobId: selectedJob,
      commission: commission ? parseInt(commission) : undefined,
    });
  };

  // קיבוץ הקצאות לפי רכז
  const assignmentsByRecruiter = assignments.reduce((acc: any, assignment: any) => {
    const userId = assignment.userId;
    if (!acc[userId]) {
      acc[userId] = [];
    }
    acc[userId].push(assignment);
    return acc;
  }, {});

  return (
    <div className="container mx-auto p-6" dir="rtl">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Users className="w-8 h-8" />
            ניהול רכזים חיצוניים
          </h1>
          <p className="text-muted-foreground mt-2">
            ניהול רכזים חיצוניים והקצאת משרות
          </p>
        </div>
        <Button onClick={() => setIsAssignDialogOpen(true)} data-testid="button-assign-job">
          <Plus className="w-4 h-4 ml-2" />
          הקצה משרה לרכז
        </Button>
      </div>

      {isLoading ? (
        <div className="text-center py-8">טוען...</div>
      ) : externalRecruiters.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          אין רכזים חיצוניים במערכת. צור משתמשים עם תפקיד "רכז חיצוני" בדף ניהול משתמשים.
        </div>
      ) : (
        <div className="space-y-6">
          {externalRecruiters.map((recruiter: any) => {
            const recruiterAssignments = assignmentsByRecruiter[recruiter.id] || [];
            
            return (
              <div key={recruiter.id} className="border rounded-lg p-4">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="text-lg font-semibold">
                      {recruiter.firstName} {recruiter.lastName}
                    </h3>
                    <p className="text-sm text-muted-foreground">{recruiter.email}</p>
                    {recruiter.requiresApproval && (
                      <span className="inline-block mt-2 px-2 py-1 text-xs bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200 rounded">
                        דורש אישור מנהל
                      </span>
                    )}
                  </div>
                  <div className="text-left">
                    <div className="text-sm text-muted-foreground">משרות מוקצות</div>
                    <div className="text-2xl font-bold">{recruiterAssignments.length}</div>
                  </div>
                </div>

                {recruiterAssignments.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-right">משרה</TableHead>
                        <TableHead className="text-right">עמלה</TableHead>
                        <TableHead className="text-right">תאריך הקצאה</TableHead>
                        <TableHead className="text-right">פעולות</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {recruiterAssignments.map((assignment: any) => {
                        const job = activeJobs.find((j: any) => j.id === assignment.jobId);
                        
                        return (
                          <TableRow key={assignment.id}>
                            <TableCell className="font-medium">
                              {job?.title || "משרה לא נמצאה"}
                            </TableCell>
                            <TableCell>
                              {assignment.commission ? `₪${assignment.commission}` : "-"}
                            </TableCell>
                            <TableCell>
                              {new Date(assignment.assignedAt).toLocaleDateString("he-IL")}
                            </TableCell>
                            <TableCell>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => deleteMutation.mutate(assignment.id)}
                                disabled={deleteMutation.isPending}
                                data-testid={`button-delete-assignment-${assignment.id}`}
                              >
                                <Trash2 className="w-4 h-4 text-destructive" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    אין משרות מוקצות לרכז זה
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}

      <Dialog open={isAssignDialogOpen} onOpenChange={setIsAssignDialogOpen}>
        <DialogContent className="sm:max-w-[500px]" dir="rtl">
          <DialogHeader>
            <DialogTitle>הקצאת משרה לרכז חיצוני</DialogTitle>
            <DialogDescription>
              בחר רכז ומשרה להקצאה. ניתן להגדיר גם עמלה אופציונלית.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="recruiter">בחר רכז חיצוני</Label>
              <Select value={selectedRecruiter} onValueChange={setSelectedRecruiter}>
                <SelectTrigger id="recruiter" data-testid="select-recruiter">
                  <SelectValue placeholder="בחר רכז..." />
                </SelectTrigger>
                <SelectContent>
                  {externalRecruiters.map((recruiter: any) => (
                    <SelectItem key={recruiter.id} value={recruiter.id}>
                      {recruiter.firstName} {recruiter.lastName} ({recruiter.email})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="job">בחר משרה</Label>
              <Select value={selectedJob} onValueChange={setSelectedJob}>
                <SelectTrigger id="job" data-testid="select-job">
                  <SelectValue placeholder="בחר משרה..." />
                </SelectTrigger>
                <SelectContent>
                  {activeJobs.map((job: any) => (
                    <SelectItem key={job.id} value={job.id}>
                      {job.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="commission">עמלה (אופציונלי)</Label>
              <Input
                id="commission"
                type="number"
                placeholder="0"
                value={commission}
                onChange={(e) => setCommission(e.target.value)}
                data-testid="input-commission"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsAssignDialogOpen(false)}
              data-testid="button-cancel-assign"
            >
              ביטול
            </Button>
            <Button
              onClick={handleAssign}
              disabled={assignMutation.isPending}
              data-testid="button-confirm-assign"
            >
              {assignMutation.isPending ? "מקצה..." : "הקצה משרה"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
