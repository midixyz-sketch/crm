import { useState } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Upload, ArrowRight } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

export default function UploadCandidateExternalPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  
  // קבלת jobId מה-URL
  const params = new URLSearchParams(window.location.search);
  const jobId = params.get("jobId");

  const [cvFile, setCvFile] = useState<File | null>(null);
  const [candidateName, setCandidateName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [notes, setNotes] = useState("");

  // קבלת פרטי המשתמש הנוכחי
  const { data: currentUser } = useQuery({
    queryKey: ["/api/auth/user"],
  });

  // קבלת פרטי המשרה מההקצאות
  const { data: assignments = [] } = useQuery({
    queryKey: [`/api/users/${(currentUser as any)?.id}/job-assignments`],
    enabled: !!(currentUser as any)?.id,
  });

  // מצא את המשרה מתוך ההקצאות
  const assignment = assignments.find((a: any) => a.jobId === jobId);
  const job = assignment?.job;

  const uploadMutation = useMutation({
    mutationFn: async (formData: FormData) => {
      const res = await fetch("/api/candidates", {
        method: "POST",
        body: formData,
      });
      if (!res.ok) throw new Error("Failed to upload");
      return res.json();
    },
    onSuccess: () => {
      // בדיקה אם המשתמש דורש אישור
      const requiresApproval = (currentUser as any)?.requiresApproval;
      
      toast({
        title: "הצלחה!",
        description: requiresApproval 
          ? "המועמד הועלה בהצלחה וממתין לאישור המנהל"
          : "המועמד הועלה בהצלחה ונשלח ללקוח",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/candidates"] });
      setLocation("/my-jobs");
    },
    onError: () => {
      toast({
        title: "שגיאה",
        description: "אירעה שגיאה בהעלאת המועמד",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!cvFile) {
      toast({
        title: "שגיאה",
        description: "יש להעלות קובץ קורות חיים",
        variant: "destructive",
      });
      return;
    }

    if (!candidateName.trim()) {
      toast({
        title: "שגיאה",
        description: "יש למלא שם מועמד",
        variant: "destructive",
      });
      return;
    }

    const formData = new FormData();
    formData.append("cv", cvFile);
    
    // פיצול השם לשם פרטי ושם משפחה
    const nameParts = candidateName.trim().split(/\s+/);
    const firstName = nameParts[0] || candidateName;
    const lastName = nameParts.slice(1).join(' ') || '';
    
    formData.append("firstName", firstName);
    formData.append("lastName", lastName);
    if (phone) formData.append("mobile", phone);
    if (email) formData.append("email", email);
    if (notes) formData.append("notes", notes);
    if (jobId) formData.append("jobId", jobId);

    uploadMutation.mutate(formData);
  };

  if (!jobId || !job) {
    return (
      <div className="container mx-auto p-6" dir="rtl">
        <div className="text-center py-8">
          <h2 className="text-2xl font-bold mb-2">משרה לא נמצאה</h2>
          <Button onClick={() => setLocation("/my-jobs")} className="mt-4">
            <ArrowRight className="w-4 h-4 ml-2" />
            חזרה למשרות שלי
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 max-w-2xl" dir="rtl">
      <Button
        variant="ghost"
        onClick={() => setLocation("/my-jobs")}
        className="mb-4"
        data-testid="button-back-to-jobs"
      >
        <ArrowRight className="w-4 h-4 ml-2" />
        חזרה למשרות
      </Button>

      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">העלאת מועמד למשרה</CardTitle>
          <div className="text-lg font-medium text-primary mt-2">{job.title}</div>
          {job.location && (
            <div className="text-sm text-muted-foreground">📍 {job.location}</div>
          )}
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* העלאת קובץ CV */}
            <div className="space-y-2">
              <Label htmlFor="cv" className="text-base font-medium">
                קובץ קורות חיים *
              </Label>
              <Input
                id="cv"
                type="file"
                accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                onChange={(e) => setCvFile(e.target.files?.[0] || null)}
                required
                data-testid="input-cv-file"
              />
              <p className="text-sm text-muted-foreground">
                פורמטים נתמכים: PDF, Word, תמונה
              </p>
            </div>

            {/* שם מועמד */}
            <div className="space-y-2">
              <Label htmlFor="name" className="text-base font-medium">
                שם המועמד *
              </Label>
              <Input
                id="name"
                value={candidateName}
                onChange={(e) => setCandidateName(e.target.value)}
                placeholder="שם מלא"
                required
                data-testid="input-candidate-name"
              />
            </div>

            {/* טלפון */}
            <div className="space-y-2">
              <Label htmlFor="phone" className="text-base font-medium">
                טלפון
              </Label>
              <Input
                id="phone"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="050-1234567"
                data-testid="input-phone"
              />
            </div>

            {/* אימייל */}
            <div className="space-y-2">
              <Label htmlFor="email" className="text-base font-medium">
                אימייל
              </Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="example@email.com"
                data-testid="input-email"
              />
            </div>

            {/* חוות דעת */}
            <div className="space-y-2">
              <Label htmlFor="notes" className="text-base font-medium">
                חוות דעת על המועמד לשליחה למעסיק
              </Label>
              <Textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="חוות דעת מפורטת על המועמד, כישוריו וניסיונו..."
                rows={4}
                data-testid="input-notes"
              />
            </div>

            {/* כפתורים */}
            <div className="flex gap-3 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setLocation("/my-jobs")}
                className="flex-1"
                data-testid="button-cancel"
              >
                ביטול
              </Button>
              <Button
                type="submit"
                disabled={uploadMutation.isPending}
                className="flex-1"
                data-testid="button-submit"
              >
                <Upload className="w-4 h-4 ml-2" />
                {uploadMutation.isPending ? "מעלה..." : "העלה מועמד"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
