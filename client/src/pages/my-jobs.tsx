import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Briefcase, Upload, AlertCircle } from "lucide-react";
import { useLocation } from "wouter";

export default function MyJobsPage() {
  const [, setLocation] = useLocation();
  const [selectedJob, setSelectedJob] = useState<any>(null);

  // קבלת המשתמש הנוכחי
  const { data: currentUser } = useQuery({
    queryKey: ["/api/auth/user"],
  });

  // קבלת ההקצאות של המשתמש
  const { data: assignments = [], isLoading } = useQuery({
    queryKey: [`/api/users/${currentUser?.id}/job-assignments`],
    enabled: !!currentUser?.id,
  });

  if (isLoading) {
    return (
      <div className="container mx-auto p-6" dir="rtl">
        <div className="text-center py-8">טוען...</div>
      </div>
    );
  }

  if (assignments.length === 0) {
    return (
      <div className="container mx-auto p-6" dir="rtl">
        <div className="flex flex-col items-center justify-center py-12">
          <AlertCircle className="w-16 h-16 text-muted-foreground mb-4" />
          <h2 className="text-2xl font-bold mb-2">אין משרות מוקצות</h2>
          <p className="text-muted-foreground text-center max-w-md">
            לא הוקצו לך משרות עדיין. פנה למנהל המערכת להקצאת משרות.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6" dir="rtl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <Briefcase className="w-8 h-8" />
          המשרות שלי
        </h1>
        <p className="text-muted-foreground mt-2">
          משרות שהוקצו לך - העלה מועמדים למשרות אלו
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {assignments.map((assignment: any) => {
          const job = assignment.job;
          if (!job) return null;

          return (
            <Card key={assignment.id} className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <CardTitle className="text-xl">{job.title}</CardTitle>
                <CardDescription>
                  {job.location && `📍 ${job.location}`}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <div className="text-sm font-medium mb-1">דרישות התפקיד:</div>
                  <p className="text-sm text-muted-foreground line-clamp-3">
                    {job.requirements || "לא צוין"}
                  </p>
                </div>

                {assignment.commission && (
                  <div className="flex items-center justify-between pt-2 border-t">
                    <span className="text-sm text-muted-foreground">עמלה:</span>
                    <Badge variant="secondary" className="text-base">
                      ₪{assignment.commission}
                    </Badge>
                  </div>
                )}

                <div className="flex gap-2 pt-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setSelectedJob(job)}
                    className="flex-1"
                    data-testid={`button-view-job-${job.id}`}
                  >
                    פרטים מלאים
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => setLocation(`/candidates/new?jobId=${job.id}`)}
                    className="flex-1"
                    data-testid={`button-upload-candidate-${job.id}`}
                  >
                    <Upload className="w-4 h-4 ml-2" />
                    העלה מועמד
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Dialog open={!!selectedJob} onOpenChange={() => setSelectedJob(null)}>
        <DialogContent className="sm:max-w-[600px]" dir="rtl">
          <DialogHeader>
            <DialogTitle>{selectedJob?.title}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {selectedJob?.location && (
              <div>
                <div className="text-sm font-medium mb-1">מיקום:</div>
                <p className="text-sm text-muted-foreground">📍 {selectedJob.location}</p>
              </div>
            )}

            {selectedJob?.description && (
              <div>
                <div className="text-sm font-medium mb-1">תיאור המשרה:</div>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                  {selectedJob.description}
                </p>
              </div>
            )}

            {selectedJob?.requirements && (
              <div>
                <div className="text-sm font-medium mb-1">דרישות התפקיד:</div>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                  {selectedJob.requirements}
                </p>
              </div>
            )}

            <div className="flex gap-2 pt-4 border-t">
              <Button
                variant="outline"
                onClick={() => setSelectedJob(null)}
                className="flex-1"
                data-testid="button-close-job-details"
              >
                סגור
              </Button>
              <Button
                onClick={() => {
                  setLocation(`/candidates/new?jobId=${selectedJob.id}`);
                  setSelectedJob(null);
                }}
                className="flex-1"
                data-testid="button-upload-from-details"
              >
                <Upload className="w-4 h-4 ml-2" />
                העלה מועמד למשרה
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
