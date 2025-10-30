import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useRoute, Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { 
  UserCheck, 
  Building2, 
  MapPin, 
  Phone, 
  Mail, 
  FileText, 
  CheckCircle, 
  XCircle, 
  Clock,
  User,
  ChevronLeft,
  ChevronRight,
  Download,
  ArrowRight,
  Briefcase,
  MessageSquare,
  Eye,
  Calendar,
  Plus
} from "lucide-react";
import type { JobApplicationWithDetails, JobApplication, JobWithClient } from "@shared/schema";
import { FileViewer } from "@/components/file-viewer";
import * as mammoth from 'mammoth';
// PDF.js removed temporarily - causing runtime errors

export default function JobInterviews() {
  const { toast } = useToast();
  const { user, isAuthenticated, isLoading } = useAuth();
  const [, params] = useRoute("/interviews/:jobId");
  const jobId = params?.jobId;
  
  const [currentIndex, setCurrentIndex] = useState(0);
  const [reviewerFeedback, setReviewerFeedback] = useState("");
  const [whatsappDialog, setWhatsappDialog] = useState(false);
  const [selectedWhatsappMessage, setSelectedWhatsappMessage] = useState("");
  const [interviewDialog, setInterviewDialog] = useState(false);
  const [interviewDate, setInterviewDate] = useState("");
  const [interviewTime, setInterviewTime] = useState("");
  const [warningAlert, setWarningAlert] = useState(false);
  const [warningMessage, setWarningMessage] = useState("");
  const [fileViewerOpen, setFileViewerOpen] = useState(false);
  const [docxHtml, setDocxHtml] = useState<string>("");
  const [docxLoading, setDocxLoading] = useState(false);

  const whatsappMessages = [
    "שלום, זה מחברת גיוס H-Group. ניסיתי להתקשר אליך לגבי משרה שתואמת לך. אנא צור איתי קשר בחזרה",
    "שלום, מחברת גיוס H-Group. יש לי הצעת עבודה מעניינת בשבילך. אשמח לשוחח איתך",
    "היי, זה מחברת גיוס H-Group. זכור שהיה לנו קדם קשר? יש לי משרה נחמדה שתתאים לך",
    "שלום, מחברת גיוס H-Group. אשמח לשוחח איתך על משרה שמתאימה לפרופיל שלך",
    "היי, זה מחברת גיוס H-Group. נשמח לשמוע אם אתה עדיין מחפש משרה חדשה"
  ];

  // Check for previous candidate events for this job in the last 45 days
  const checkPreviousEvents = async (candidateId: string, jobId: string) => {
    try {
      const response = await fetch(`/api/candidates/${candidateId}/events`);
      if (!response.ok) return;
      
      const events = await response.json();
      const now = new Date();
      const fortyFiveDaysAgo = new Date(now.getTime() - (45 * 24 * 60 * 60 * 1000));
      
      // Look for relevant events in the last 45 days for this specific job
      const recentEvents = events.filter((event: any) => {
        const eventDate = new Date(event.createdAt);
        const isRecent = eventDate >= fortyFiveDaysAgo;
        const isSameJob = event.metadata?.jobId === jobId || event.metadata?.jobTitle;
        const isRelevantEvent = ['sent_to_employer', 'rejected'].includes(event.eventType);
        
        return isRecent && isSameJob && isRelevantEvent;
      });
      
      if (recentEvents.length > 0) {
        const latestEvent = recentEvents[0];
        const eventDate = new Date(latestEvent.createdAt);
        const daysAgo = Math.floor((now.getTime() - eventDate.getTime()) / (1000 * 60 * 60 * 24));
        
        let eventDescription = '';
        if (latestEvent.eventType === 'sent_to_employer') {
          eventDescription = 'נשלח למעסיק';
        } else if (latestEvent.eventType === 'rejected') {
          eventDescription = 'נפסל';
        }
        
        const warningText = `⚠️ התראה: מועמד זה ${eventDescription} למשרה זו לפני ${daysAgo} ימים`;
        setWarningMessage(warningText);
        setWarningAlert(true);
      }
    } catch (error) {
      console.error('Error checking previous events:', error);
    }
  };

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      toast({
        title: "נדרשת הזדהות",
        description: "מועבר למערכת...",
        variant: "destructive",
      });
      setTimeout(() => {
        window.location.href = "/login";
      }, 500);
      return;
    }
  }, [isAuthenticated, isLoading, toast]);

  // Fetch job details
  const { data: jobsData } = useQuery<{ jobs: JobWithClient[] }>({
    queryKey: ["/api/jobs"],
    enabled: isAuthenticated && !!jobId,
  });

  const jobData = jobsData?.jobs.find(job => job.id === jobId);

  // Fetch message templates
  const { data: templatesResponse } = useQuery({
    queryKey: ['/api/message-templates'],
    enabled: isAuthenticated,
  });
  const templates = Array.isArray(templatesResponse) ? templatesResponse : [];

  // Fetch job applications for this specific job
  const { data: applicationsData, isLoading: applicationsLoading } = useQuery<{ applications: JobApplicationWithDetails[] }>({
    queryKey: ["/api/job-applications"],
    enabled: isAuthenticated && !!jobId,
  });

  // Show only applications that haven't been reviewed yet
  const applications = applicationsData?.applications.filter(app => 
    app.jobId === jobId && 
    app.status === 'submitted' && 
    !app.reviewedAt
  ) || [];
  const currentApplication = applications[currentIndex];

  // Check previous events when current application changes
  useEffect(() => {
    if (currentApplication && jobId && currentApplication.candidateId) {
      checkPreviousEvents(currentApplication.candidateId, jobId);
    }
  }, [currentApplication?.candidateId, jobId]);

  // Load DOCX files automatically
  useEffect(() => {
    const loadDocx = async () => {
      console.log('=== DOCX Load useEffect triggered ===');
      console.log('Current application:', currentApplication?.candidate?.id);
      console.log('CV Path:', currentApplication?.candidate?.cvPath);
      
      if (!currentApplication?.candidate?.cvPath) {
        console.log('No CV path, clearing DOCX HTML');
        setDocxHtml("");
        return;
      }

      const cvPath = currentApplication.candidate.cvPath;
      const isDocx = cvPath.toLowerCase().endsWith('.docx') || cvPath.toLowerCase().endsWith('.doc');
      
      console.log('Is DOCX file?', isDocx);
      
      if (!isDocx) {
        console.log('Not a DOCX file, clearing DOCX HTML');
        setDocxHtml("");
        return;
      }

      try {
        console.log('Starting DOCX load...');
        setDocxLoading(true);
        const response = await fetch(`/api/candidates/${currentApplication.candidate.id}/cv`);
        console.log('Fetch response status:', response.status);
        
        const arrayBuffer = await response.arrayBuffer();
        console.log('ArrayBuffer size:', arrayBuffer.byteLength);
        
        // Configure mammoth to properly extract images and content
        const options = {
          convertImage: mammoth.images.imgElement((image: any) => {
            return image.read("base64").then((imageBuffer: string) => {
              return {
                src: `data:${image.contentType};base64,${imageBuffer}`
              };
            });
          }),
          styleMap: [
            "p[style-name='Heading 1'] => h1:fresh",
            "p[style-name='Heading 2'] => h2:fresh",
            "p[style-name='Heading 3'] => h3:fresh",
          ],
          includeDefaultStyleMap: true,
          ignoreEmptyParagraphs: false
        };
        
        console.log('Converting with Mammoth...');
        const result = await mammoth.convertToHtml({ arrayBuffer }, options);
        console.log('Mammoth conversion SUCCESS!');
        console.log('Result length:', result.value.length);
        console.log('First 500 chars:', result.value.substring(0, 500));
        console.log('Mammoth messages:', result.messages);
        setDocxHtml(result.value);
      } catch (error) {
        console.error('!!! Error loading DOCX:', error);
        setDocxHtml("");
      } finally {
        setDocxLoading(false);
      }
    };

    loadDocx();
  }, [currentApplication?.candidate?.id, currentApplication?.candidate?.cvPath]);


  // Mutations for application actions
  const updateApplicationMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<JobApplication> }) => {
      await apiRequest("PATCH", `/api/job-applications/${id}`, updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/job-applications"] });
      queryClient.invalidateQueries({ queryKey: ["/api/candidates"] });
      queryClient.invalidateQueries({ queryKey: ["/api/candidates/enriched"] });
      queryClient.invalidateQueries({ queryKey: ["/api/candidates/recently-updated"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] });
      
      // Also invalidate specific candidate data if available
      if (currentApplication?.candidateId) {
        queryClient.invalidateQueries({ queryKey: [`/api/candidates/${currentApplication.candidateId}`] });
        queryClient.invalidateQueries({ queryKey: [`/api/candidates/${currentApplication.candidateId}/events`] });
      }
      
      setReviewerFeedback("");
    },
    onError: (error: any) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: "נדרשת הזדהות מחדש",
          description: "מועבר לדף התחברות...",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/login";
        }, 500);
        return;
      }
      toast({
        title: "שגיאה",
        description: error.message || "פעולה נכשלה",
        variant: "destructive",
      });
    },
  });

  const handleApprove = async () => {
    if (!currentApplication) return;
    
    try {
      // Update application status
      await updateApplicationMutation.mutateAsync({
        id: currentApplication.id,
        updates: {
          status: 'interview',
          reviewerFeedback,
          reviewedAt: new Date(),
          sentToClient: true,
        }
      });

      // Update candidate status to 'sent_to_employer'
      await apiRequest("PATCH", `/api/candidates/${currentApplication.candidateId}`, {
        status: 'sent_to_employer',
        lastStatusChange: new Date(),
      });

      // Send candidate profile to selected contact persons
      let emailsSent = 0;
      let emailsFailed = 0;
      const contactPersons = jobData?.client?.contactPersons || [];
      const selectedContactPersonIds = jobData?.selectedContactPersonIds || [];
      
      // Get selected contact persons
      const selectedContacts = contactPersons.filter((person: any) => 
        selectedContactPersonIds.includes(person.id)
      );
      
      if (selectedContacts.length > 0) {
        // Send to all selected contact persons
        for (const contact of selectedContacts) {
          if (contact.email) {
            try {
              await apiRequest("POST", "/api/send-candidate-profile", {
                candidateId: currentApplication.candidateId,
                jobId: currentApplication.jobId,
                reviewerFeedback: reviewerFeedback || "מועמד מומלץ למשרה",
                recipientEmail: contact.email,
                recipientName: contact.name || contact.title,
              });
              emailsSent++;
            } catch (error) {
              console.error(`Email sending failed to ${contact.email}:`, error);
              emailsFailed++;
            }
          }
        }
      }
      
      // Show accurate success/error message
      if (emailsSent > 0 && emailsFailed === 0) {
        toast({
          title: "מועמד נשלח למעסיק! ✅",
          description: `המועמד נשלח בהצלחה ל-${emailsSent} אנשי קשר`,
        });
      } else if (emailsSent > 0 && emailsFailed > 0) {
        toast({
          title: "מועמד נשלח חלקית ⚠️",
          description: `נשלח ל-${emailsSent} אנשי קשר, ${emailsFailed} נכשלו`,
          variant: "destructive",
        });
      } else if (emailsFailed > 0) {
        toast({
          title: "מועמד אושר אבל המיילים נכשלו! ⚠️",
          description: "המועמד אושר במערכת אבל לא ניתן לשלוח מיילים למעסיק. אנא צור קשר ידני.",
          variant: "destructive",
        });
      } else {
        toast({
          title: "מועמד אושר בהצלחה! ✅",
          description: selectedContacts.length === 0 ? "לא נבחרו אנשי קשר למשרה זו" : "המועמד אושר והתווסף לרשימת המועמדים המאושרים",
        });
      }

      // Refresh data and move to next candidate automatically
      setTimeout(async () => {
        await queryClient.invalidateQueries({ queryKey: ["/api/job-applications"] });
        
        // Stay at current index, the component will re-render with updated data
        setReviewerFeedback("");
        setWarningAlert(false);
        setWarningMessage("");
      }, 800);
    } catch (error) {
      console.error('Error approving candidate:', error);
      toast({
        title: "שגיאה",
        description: "שגיאה בשליחת המועמד למעסיק",
        variant: "destructive",
      });
    }
  };

  const handleReject = async () => {
    if (!currentApplication) return;
    
    try {
      // Update application status
      await updateApplicationMutation.mutateAsync({
        id: currentApplication.id,
        updates: {
          status: 'rejected',
          reviewerFeedback,
          reviewedAt: new Date(),
        }
      });

      // Update candidate status to 'rejected'
      await apiRequest("PATCH", `/api/candidates/${currentApplication.candidateId}`, {
        status: 'rejected',
        lastStatusChange: new Date(),
        notes: reviewerFeedback ? `הערות פסילה: ${reviewerFeedback}` : undefined,
      });
      
      toast({
        title: "מועמד נפסל ❌",
        description: "המועמד סומן כנפסל והערותיך נשמרו",
      });

      // Refresh data and move to next candidate automatically
      setTimeout(async () => {
        await queryClient.invalidateQueries({ queryKey: ["/api/job-applications"] });
        
        // Stay at current index, the component will re-render with updated data
        setReviewerFeedback("");
        setWarningAlert(false);
        setWarningMessage("");
      }, 800);
    } catch (error) {
      console.error('Error rejecting candidate:', error);
      toast({
        title: "שגיאה",
        description: "שגיאה בעדכון סטטוס המועמד",
        variant: "destructive",
      });
    }
  };

  const handleNeedsMoreReview = () => {
    if (!currentApplication) return;
    
    updateApplicationMutation.mutate({
      id: currentApplication.id,
      updates: {
        status: 'submitted',
        reviewerFeedback,
        reviewedAt: new Date(),
      }
    });
    
    toast({
      title: "נדרש ראיון נוסף 🔄",
      description: "המועמד סומן לבדיקה נוספת",
    });
  };

  const handleOpenWhatsappChat = () => {
    if (!currentApplication) return;
    
    // Navigate to WhatsApp page with this candidate's phone number
    const phoneNumber = currentApplication.candidate.phone?.replace(/^0/, '972');
    window.location.href = `/whatsapp?phone=${phoneNumber}`;
  };

  const handleWhatsappSend = async () => {
    if (!currentApplication || !selectedWhatsappMessage) return;
    
    try {
      // Update candidate status to 'whatsapp_sent'
      await apiRequest("PATCH", `/api/candidates/${currentApplication.candidateId}`, {
        status: 'whatsapp_sent',
        lastStatusChange: new Date(),
        notes: `הודעת ווצאפ נשלחה: ${selectedWhatsappMessage}`,
      });

      // Update application with WhatsApp note
      await updateApplicationMutation.mutateAsync({
        id: currentApplication.id,
        updates: {
          reviewerFeedback: `הודעת ווצאפ נשלחה: ${selectedWhatsappMessage}`,
        }
      });

      // Open WhatsApp with the message
      const phoneNumber = currentApplication.candidate.phone?.replace(/^0/, '972');
      const whatsappUrl = `https://wa.me/${phoneNumber}?text=${encodeURIComponent(selectedWhatsappMessage)}`;
      window.open(whatsappUrl, '_blank');
      
      setWhatsappDialog(false);
      setSelectedWhatsappMessage("");
      
      toast({
        title: "הודעת ווצאפ נשלחה! 📱",
        description: "המועמד הועבר לסוף הרשימה והסטטוס עודכן",
      });

      // Refresh data and move to next candidate automatically
      setTimeout(async () => {
        await queryClient.invalidateQueries({ queryKey: ["/api/job-applications"] });
        
        // Stay at current index, the component will re-render with updated data
        setReviewerFeedback("");
        setWarningAlert(false);
        setWarningMessage("");
      }, 800);
    } catch (error) {
      console.error('Error sending WhatsApp:', error);
      toast({
        title: "שגיאה",
        description: "שגיאה בשליחת הודעת ווצאפ",
        variant: "destructive",
      });
    }
  };

  const handleScheduleInterview = async () => {
    if (!currentApplication || !interviewDate || !interviewTime) return;
    
    try {
      // Create proper ISO datetime string
      const interviewDateTime = new Date(`${interviewDate}T${interviewTime}:00`);
      
      // Validate the date is valid
      if (isNaN(interviewDateTime.getTime())) {
        throw new Error('Invalid date/time combination');
      }
      
      // Update application status
      await updateApplicationMutation.mutateAsync({
        id: currentApplication.id,
        updates: {
          status: 'submitted',
          reviewerFeedback: `נדרש ראיון נוסף ב-${interviewDateTime.toLocaleDateString('he-IL')} בשעה ${interviewTime}`,
          reviewedAt: new Date(),
        }
      });

      // Update candidate status
      await apiRequest("PATCH", `/api/candidates/${currentApplication.candidateId}`, {
        status: 'waiting_for_second_interview',
        lastStatusChange: new Date(),
      });

      // Create reminder event with link to interviews page
      const interviewLink = `/interviews/${currentApplication.jobId}`;
      await apiRequest("POST", "/api/reminders", {
        title: `ראיון נוסף - ${currentApplication.candidate.firstName} ${currentApplication.candidate.lastName}`,
        description: `ראיון נוסף למועמד ${currentApplication.candidate.firstName} ${currentApplication.candidate.lastName} למשרה ${jobData?.title}\n\nלחץ כאן לעבור לעמוד הראיונות: ${window.location.origin}${interviewLink}`,
        reminderDate: interviewDateTime,
        priority: 'high',
        candidateId: currentApplication.candidateId,
        jobId: currentApplication.jobId,
      });
      
      setInterviewDialog(false);
      setInterviewDate("");
      setInterviewTime("");
      
      toast({
        title: "ראיון נוסף נקבע! 📅",
        description: `ראיון נקבע ל-${interviewDateTime.toLocaleDateString('he-IL')} בשעה ${interviewTime}`,
      });

      // Refresh data and move to next candidate automatically
      setTimeout(async () => {
        await queryClient.invalidateQueries({ queryKey: ["/api/job-applications"] });
        
        // Stay at current index, the component will re-render with updated data
        setReviewerFeedback("");
        setWarningAlert(false);
        setWarningMessage("");
      }, 800);
    } catch (error) {
      console.error('Error scheduling interview:', error);
      toast({
        title: "שגיאה",
        description: "שגיאה בקביעת הראיון",
        variant: "destructive",
      });
    }
  };

  const navigateToCandidate = (direction: 'prev' | 'next') => {
    if (direction === 'prev' && currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
      setReviewerFeedback("");
      setWarningAlert(false); // Reset warning when navigating
      setWarningMessage("");
    } else if (direction === 'next' && currentIndex < applications.length - 1) {
      setCurrentIndex(currentIndex + 1);
      setReviewerFeedback("");
      setWarningAlert(false); // Reset warning when navigating
      setWarningMessage("");
    }
  };

  if (!isAuthenticated || isLoading) {
    return null;
  }

  if (!jobId) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-2">
            משרה לא נמצאה
          </h2>
          <Link href="/interviews">
            <Button>חזור לדף ראיונות</Button>
          </Link>
        </div>
      </div>
    );
  }

  if (applicationsLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-pulse text-center">
          <UserCheck className="h-12 w-12 mx-auto mb-4 text-blue-600" />
          <p className="text-gray-600 dark:text-gray-300">טוען מועמדות לסקירה...</p>
        </div>
      </div>
    );
  }

  if (applications.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <UserCheck className="h-16 w-16 mx-auto mb-4 text-gray-400" />
          <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-2">
            כל המועמדים נבדקו! ✅
          </h2>
          <p className="text-gray-600 dark:text-gray-300 mb-4">
            כל המועמדויות למשרה זו כבר נבדקו ואושרו/נפסלו. אין מועמדים נוספים לבדיקה.
          </p>
          <Link href="/interviews">
            <Button>חזור לדף ראיונות</Button>
          </Link>
        </div>
      </div>
    );
  }

  if (!currentApplication) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-2">
            מועמד לא נמצא
          </h2>
          <Link href="/interviews">
            <Button>חזור לדף ראיונות</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div dir="rtl" className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header with candidate info */}
      <div className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-6 py-4">
          {/* Breadcrumb */}
          <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300 mb-4">
            <Link href="/interviews" className="hover:text-blue-600">
              ראיונות
            </Link>
            <ArrowRight className="h-3 w-3" />
            <span className="font-medium">{jobData?.title}</span>
          </div>

          {/* Candidate Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-6">
              <Link 
                href={`/candidates/${currentApplication.candidate.id}`}
                className="flex items-center gap-3 hover:opacity-80 transition-opacity cursor-pointer"
              >
                <User className="h-10 w-10 p-2 bg-blue-100 dark:bg-blue-900 text-blue-600 rounded-full" />
                <div>
                  <h1 className="text-2xl font-bold text-gray-900 dark:text-white hover:text-blue-600 transition-colors">
                    {currentApplication.candidate.firstName} {currentApplication.candidate.lastName}
                  </h1>
                  <div className="flex items-center gap-4 mt-1">
                    {currentApplication.candidate.city && (
                      <div className="flex items-center gap-1 text-sm text-gray-600 dark:text-gray-400">
                        <MapPin className="h-4 w-4" />
                        {currentApplication.candidate.city}
                      </div>
                    )}
                    {currentApplication.candidate.phone && (
                      <a
                        href={`tel:${currentApplication.candidate.phone}`}
                        className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800"
                        data-testid="link-phone"
                      >
                        <Phone className="h-4 w-4" />
                        {currentApplication.candidate.phone}
                      </a>
                    )}
                    {currentApplication.candidate.email && (
                      <a
                        href={`mailto:${currentApplication.candidate.email}`}
                        className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800"
                        data-testid="link-email"
                      >
                        <Mail className="h-4 w-4" />
                        {currentApplication.candidate.email}
                      </a>
                    )}
                    {currentApplication.candidate.phone && (
                      <Dialog open={whatsappDialog} onOpenChange={setWhatsappDialog}>
                        <DialogTrigger asChild>
                          <Button
                            variant="outline"
                            size="sm"
                            className="flex items-center gap-1 text-sm text-green-600 hover:text-green-800 border-green-200"
                            data-testid="button-whatsapp"
                          >
                            <MessageSquare className="h-4 w-4" />
                            שלח ווצאפ
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>שליחת הודעת ווצאפ</DialogTitle>
                          </DialogHeader>
                          <div className="space-y-4">
                            <div>
                              <Label>בחר הודעה מוכנה:</Label>
                              <Select value={selectedWhatsappMessage} onValueChange={setSelectedWhatsappMessage}>
                                <SelectTrigger>
                                  <SelectValue placeholder="בחר הודעה..." />
                                </SelectTrigger>
                                <SelectContent>
                                  {(templates.length > 0 ? templates : whatsappMessages.map((msg, idx) => ({ id: idx.toString(), name: msg.substring(0, 30) + '...', content: msg, icon: '💬' }))).map((template: any) => (
                                    <SelectItem key={template.id || template.name} value={template.content}>
                                      {template.icon} {template.name || template.content.substring(0, 50)}...
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            {selectedWhatsappMessage && (
                              <div className="p-3 bg-gray-50 rounded-lg">
                                <p className="text-sm">{selectedWhatsappMessage}</p>
                              </div>
                            )}
                            <div className="flex gap-2">
                              <Button onClick={handleWhatsappSend} disabled={!selectedWhatsappMessage}>
                                שלח הודעה
                              </Button>
                              <Button 
                                variant="default" 
                                onClick={handleOpenWhatsappChat}
                                className="bg-green-600 hover:bg-green-700"
                              >
                                <MessageSquare className="h-4 w-4 mr-2" />
                                פתח צ'אט
                              </Button>
                              <Button variant="outline" onClick={() => setWhatsappDialog(false)}>
                                ביטול
                              </Button>
                            </div>
                          </div>
                        </DialogContent>
                      </Dialog>
                    )}
                  </div>
                </div>
              </Link>
            </div>

            {/* Navigation */}
            <div className="flex items-center gap-4">
              <span className="text-sm text-gray-600 dark:text-gray-300">
                מועמד {currentIndex + 1} מתוך {applications.length}
              </span>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => navigateToCandidate('prev')}
                  disabled={currentIndex === 0}
                  data-testid="button-prev-candidate"
                >
                  <ChevronRight className="h-4 w-4" />
                  הקודם
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => navigateToCandidate('next')}
                  disabled={currentIndex === applications.length - 1}
                  data-testid="button-next-candidate"
                >
                  הבא
                  <ChevronLeft className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-6 py-6">
        <div className="grid grid-cols-10 gap-6">
          {/* Right Column - Job Details (30%) */}
          <div className="col-span-3 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Briefcase className="h-5 w-5" />
                  פרטי המשרה
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
                    {jobData?.title}
                  </h3>
                  <div className="flex items-center gap-2 mt-1">
                    <Building2 className="h-4 w-4 text-gray-500" />
                    <span className="text-gray-600 dark:text-gray-300">
                      {jobData?.client?.companyName || 'לא צוין'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <MapPin className="h-4 w-4 text-gray-500" />
                    <span className="text-gray-600 dark:text-gray-300">
                      {jobData?.location}
                    </span>
                  </div>
                </div>

                {jobData?.description && (
                  <div>
                    <h4 className="font-medium text-gray-900 dark:text-white mb-2">תיאור התפקיד</h4>
                    <p className="text-sm text-gray-600 dark:text-gray-300 whitespace-pre-wrap">
                      {jobData.description}
                    </p>
                  </div>
                )}

                {jobData?.requirements && (
                  <div>
                    <h4 className="font-medium text-gray-900 dark:text-white mb-2">דרישות התפקיד</h4>
                    <p className="text-sm text-gray-600 dark:text-gray-300 whitespace-pre-wrap">
                      {jobData.requirements}
                    </p>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                  <div>
                    <h4 className="font-medium text-gray-900 dark:text-white mb-1">סוג משרה</h4>
                    <p className="text-sm text-gray-600 dark:text-gray-300">
                      {jobData?.jobType || 'לא צוין'}
                    </p>
                  </div>
                  <div>
                    <h4 className="font-medium text-gray-900 dark:text-white mb-1">משכורת</h4>
                    <p className="text-sm text-gray-600 dark:text-gray-300">
                      {jobData?.salaryRange || 'לא צוין'}
                    </p>
                  </div>
                </div>

                {jobData?.client && (
                  <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
                    <h4 className="font-medium text-gray-900 dark:text-white mb-2">איש קשר</h4>
                    <div className="space-y-1">
                      <p className="text-sm">{jobData.client.contactName || 'לא צוין'}</p>
                      {jobData.client.email && (
                        <div className="flex items-center gap-1 text-sm text-gray-600 dark:text-gray-300">
                          <Mail className="h-3 w-3" />
                          {jobData.client.email}
                        </div>
                      )}
                      {jobData.client.phone && (
                        <div className="flex items-center gap-1 text-sm text-gray-600 dark:text-gray-300">
                          <Phone className="h-3 w-3" />
                          {jobData.client.phone}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Action Area */}
            <Card>
              <CardHeader>
                <CardTitle>הערכת המועמד</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Quick Status Buttons */}
                <div className="flex justify-end gap-2">
                  <Button
                    onClick={handleApprove}
                    disabled={updateApplicationMutation.isPending}
                    className="bg-green-600 hover:bg-green-700 text-white font-semibold shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-1"
                    style={{ fontSize: '0.68rem', width: '110px', height: '110px' }}
                    data-testid="button-approve"
                  >
                    <CheckCircle className="h-3 w-3 flex-shrink-0" />
                    <span>מתאים</span>
                  </Button>
                  <Button
                    onClick={handleReject}
                    disabled={updateApplicationMutation.isPending}
                    className="bg-red-600 hover:bg-red-700 text-white font-semibold shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-1"
                    style={{ fontSize: '0.68rem', width: '110px', height: '110px' }}
                    data-testid="button-reject"
                  >
                    <XCircle className="h-3 w-3 flex-shrink-0" />
                    <span>לא מתאים</span>
                  </Button>
                  <Dialog open={interviewDialog} onOpenChange={setInterviewDialog}>
                    <DialogTrigger asChild>
                      <Button
                        disabled={updateApplicationMutation.isPending}
                        className="bg-blue-600 hover:bg-blue-700 text-white font-semibold shadow-md hover:shadow-lg transition-all flex flex-col items-center justify-center gap-0.5"
                        style={{ fontSize: '0.68rem', width: '110px', height: '110px' }}
                        data-testid="button-more-review"
                      >
                        <Calendar className="h-3 w-3 flex-shrink-0" />
                        <div className="flex flex-col items-center leading-tight">
                          <span>נדרש ראיון</span>
                          <span>נוסף</span>
                        </div>
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>קביעת ראיון נוסף</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-4">
                        <div>
                          <Label htmlFor="interview-date">תאריך הראיון:</Label>
                          <Input
                            id="interview-date"
                            type="date"
                            value={interviewDate}
                            onChange={(e) => setInterviewDate(e.target.value)}
                            min={new Date().toISOString().split('T')[0]}
                          />
                        </div>
                        <div>
                          <Label htmlFor="interview-time">שעת הראיון:</Label>
                          <Input
                            id="interview-time"
                            type="time"
                            value={interviewTime}
                            onChange={(e) => setInterviewTime(e.target.value)}
                          />
                        </div>
                        <div className="flex gap-2">
                          <Button 
                            onClick={handleScheduleInterview} 
                            disabled={!interviewDate || !interviewTime}
                          >
                            הפנייה לראיון
                          </Button>
                          <Button variant="outline" onClick={() => setInterviewDialog(false)}>
                            ביטול
                          </Button>
                        </div>
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>

                {/* Internal Notes */}
                <div>
                  <Textarea
                    value={reviewerFeedback}
                    onChange={(e) => setReviewerFeedback(e.target.value)}
                    placeholder="הזן חוות דעת או הערות על המועמד..."
                    className="min-h-20"
                    data-testid="textarea-reviewer-feedback"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    הערות אלו ישמרו במערכת לעיון עתידי
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Left Column - CV Preview (70%) */}
          <div className="col-span-7">
            <Card className="h-fit">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  קורות החיים
                </CardTitle>
              </CardHeader>
              <CardContent>
                {currentApplication.candidate.cvPath ? (
                  (() => {
                    const cvPath = currentApplication.candidate.cvPath;
                    const isDocx = cvPath.toLowerCase().endsWith('.docx') || cvPath.toLowerCase().endsWith('.doc');
                    const isPdf = cvPath.toLowerCase().endsWith('.pdf');
                    const isImage = /\.(jpg|jpeg|png|gif|webp|bmp)$/i.test(cvPath);
                    
                    console.log('CV Path:', cvPath);
                    console.log('Is DOCX:', isDocx, 'Is PDF:', isPdf, 'Is Image:', isImage);
                    console.log('DOCX HTML length:', docxHtml?.length || 0);
                    console.log('DOCX Loading:', docxLoading);
                    
                    // For DOCX files, show converted HTML automatically
                    if (isDocx) {
                      return (
                        <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden bg-white dark:bg-gray-800">
                          <div className="p-3 bg-blue-50 dark:bg-blue-900/20 border-b flex items-center justify-between">
                            <p className="text-sm text-blue-700 dark:text-blue-300">
                              קובץ Word - {currentApplication.candidate.firstName} {currentApplication.candidate.lastName}
                            </p>
                            <div className="flex gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setFileViewerOpen(true)}
                                data-testid="button-view-cv-fullscreen"
                              >
                                <Eye className="h-4 w-4 mr-2" />
                                הצג במסך מלא
                              </Button>
                            </div>
                          </div>
                          <div 
                            className="overflow-auto bg-white dark:bg-gray-800"
                            style={{ height: 'calc(100vh - 250px)', minHeight: '700px' }}
                          >
                            {docxLoading ? (
                              <div className="flex items-center justify-center h-full">
                                <div className="text-center">
                                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
                                  <div className="text-gray-600 dark:text-gray-400">טוען קובץ Word...</div>
                                </div>
                              </div>
                            ) : docxHtml ? (
                              <div className="p-8">
                                <div 
                                  className="prose prose-lg dark:prose-invert max-w-none"
                                  dangerouslySetInnerHTML={{ __html: docxHtml }}
                                  dir="rtl"
                                  style={{
                                    fontFamily: 'Arial, sans-serif',
                                    lineHeight: '1.8',
                                    textAlign: 'right'
                                  }}
                                />
                              </div>
                            ) : (
                              <div className="flex flex-col items-center justify-center h-full gap-4 p-8">
                                <FileText className="h-16 w-16 text-gray-400" />
                                <div className="text-gray-500 dark:text-gray-400 text-center">
                                  <div className="text-lg font-semibold mb-2">לא ניתן להציג את הקובץ</div>
                                  <div className="text-sm">לחץ על "הצג במסך מלא" לצפייה</div>
                                </div>
                                <Button
                                  onClick={() => setFileViewerOpen(true)}
                                  variant="default"
                                  data-testid="button-view-docx"
                                >
                                  <Eye className="h-5 w-5 mr-2" />
                                  הצג במסך מלא
                                </Button>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    }
                    
                    // For PDF - use simple iframe (most compatible)
                    if (isPdf) {
                      const pdfUrl = `/api/candidates/${currentApplication.candidate.id}/cv`;
                      return (
                        <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden bg-white dark:bg-gray-800">
                          <div className="p-3 bg-blue-50 dark:bg-blue-900/20 border-b flex items-center justify-between">
                            <p className="text-sm text-blue-700 dark:text-blue-300">
                              קובץ PDF - {currentApplication.candidate.firstName} {currentApplication.candidate.lastName}
                            </p>
                            <div className="flex gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => window.open(pdfUrl, '_blank')}
                                data-testid="button-open-cv-new-tab"
                              >
                                <Eye className="h-4 w-4 mr-2" />
                                פתח בטאב חדש
                              </Button>
                            </div>
                          </div>
                          <div 
                            className="bg-gray-100 dark:bg-gray-900 w-full"
                            style={{ height: 'calc(100vh - 250px)', minHeight: '700px' }}
                          >
                            <embed
                              src={pdfUrl}
                              type="application/pdf"
                              className="w-full h-full"
                              style={{ minHeight: '700px' }}
                            />
                          </div>
                        </div>
                      );
                    }
                    
                    // For images - use img tag directly
                    return (
                      <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden bg-white dark:bg-gray-800">
                        <div className="p-3 bg-blue-50 dark:bg-blue-900/20 border-b flex items-center justify-between">
                          <p className="text-sm text-blue-700 dark:text-blue-300">
                            תמונה - {currentApplication.candidate.firstName} {currentApplication.candidate.lastName}
                          </p>
                          <div className="flex gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => window.open(`/api/candidates/${currentApplication.candidate.id}/cv`, '_blank')}
                              data-testid="button-open-cv-new-tab"
                            >
                              <Eye className="h-4 w-4 mr-2" />
                              פתח בטאב חדש
                            </Button>
                          </div>
                        </div>
                        <div className="p-4 bg-gray-100 dark:bg-gray-900 flex justify-center items-center" style={{ minHeight: '700px', maxHeight: 'calc(100vh - 250px)', overflow: 'auto' }}>
                          <img
                            src={`/api/candidates/${currentApplication.candidate.id}/cv`}
                            alt={`קורות חיים - ${currentApplication.candidate.firstName} ${currentApplication.candidate.lastName}`}
                            className="max-w-full h-auto shadow-lg"
                            style={{ maxHeight: '100%', objectFit: 'contain' }}
                          />
                        </div>
                      </div>
                    );
                  })()
                ) : (
                  <div className="text-center py-8">
                    <FileText className="h-12 w-12 mx-auto text-gray-400 mb-2" />
                    <p className="text-gray-600 dark:text-gray-300">
                      לא הועלה קובץ קורות חיים
                    </p>
                  </div>
                )}

                {/* Candidate Details from CV */}
                {currentApplication.candidate.experience && (
                  <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                    <h4 className="font-medium text-gray-900 dark:text-white mb-3">
                      פרטים שחולצו מהקורות חיים
                    </h4>
                    <div className="space-y-3 text-sm">
                      {currentApplication.candidate.experience && (
                        <div>
                          <span className="font-medium">ניסיון תעסוקתי:</span>
                          <p className="text-gray-600 dark:text-gray-300 mt-1 whitespace-pre-wrap">
                            {currentApplication.candidate.experience}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Warning Alert for Previous Events */}
      <AlertDialog open={warningAlert} onOpenChange={setWarningAlert}>
        <AlertDialogContent className="w-[90%] max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-center text-orange-600">
              ⚠️ התראה חשובה
            </AlertDialogTitle>
            <AlertDialogDescription className="text-center text-lg">
              {warningMessage}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex justify-center">
            <AlertDialogAction 
              onClick={() => setWarningAlert(false)}
              className="bg-orange-600 hover:bg-orange-700"
            >
              הבנתי
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* File Viewer for CV */}
      {currentApplication?.candidate?.cvPath && (
        <FileViewer
          isOpen={fileViewerOpen}
          onClose={() => setFileViewerOpen(false)}
          fileUrl={`/api/candidates/${currentApplication.candidate.id}/cv`}
          fileName={currentApplication.candidate.cvPath.split('/').pop() || 'CV.pdf'}
          mimeType={
            currentApplication.candidate.cvPath.toLowerCase().endsWith('.pdf') ? 'application/pdf' :
            currentApplication.candidate.cvPath.toLowerCase().endsWith('.docx') ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' :
            currentApplication.candidate.cvPath.toLowerCase().match(/\.(jpg|jpeg|png|gif|webp|bmp)$/i) ? 'image/' + currentApplication.candidate.cvPath.split('.').pop() :
            undefined
          }
        />
      )}
    </div>
  );
}