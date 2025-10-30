import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/useAuth";
import Navbar from "@/components/layout/navbar";
import { ReminderPopup } from "@/components/reminder-popup";
import { WhatsAppWidget } from "@/components/whatsapp/whatsapp-widget";
import { WhatsAppNotificationContainer } from "@/components/whatsapp/message-notification";
import NotFound from "@/pages/not-found";
import Landing from "@/pages/landing";
import Login from "@/pages/login";
import JobLanding from "@/pages/job-landing";
import Dashboard from "@/pages/dashboard";
import Candidates from "@/pages/candidates";
import AddCandidate from "@/pages/add-candidate";
import AdvancedCandidate from "@/pages/advanced-candidate";
import CandidateDetail from "@/pages/candidate-detail";
import Clients from "@/pages/clients";
import Jobs from "@/pages/jobs";
import Interviews from "@/pages/interviews";
import JobInterviews from "@/pages/job-interviews";
import Emails from "@/pages/emails";
import EmailSettings from "@/pages/email-settings";
import SystemSettings from "@/pages/system-settings";
import Settings from "@/pages/settings";
import CVSearch from "@/pages/cv-search";
import Calendar from "@/pages/calendar";
import UserManagement from "@/pages/user-management";
import BulkImportCandidates from "@/pages/bulk-import-candidates";
import RecentlyUpdated from "@/pages/recently-updated";
import WhatsAppChats from "@/pages/whatsapp-chats";
import ExternalRecruiters from "@/pages/external-recruiters";
import MyJobs from "@/pages/my-jobs";
import PendingApprovals from "@/pages/pending-approvals";
import UploadCandidateExternal from "@/pages/upload-candidate-external";
import Reports from "@/pages/reports";
import { PermissionWrapper } from "@/components/permissions/permission-wrapper";

import { useQuery } from "@tanstack/react-query";
import { Redirect } from "wouter";
import { RouteGuard } from "@/components/route-guard";

function HomePage() {
  const { data: currentUser, isLoading } = useQuery({
    queryKey: ["/api/auth/user"],
  });

  // בדיקה נכונה - role.type (לא roleType)
  const isExternalRecruiter = (currentUser as any)?.userRoles?.some((ur: any) => ur.role?.type === "external_recruiter");

  // טעינה - המתן עד שהנתונים נטענים
  if (isLoading) {
    return <div className="flex items-center justify-center min-h-screen">טוען...</div>;
  }

  // רכז חיצוני - הפנה ל-"המשרות שלי"
  if (isExternalRecruiter) {
    return <Redirect to="/my-jobs" />;
  }

  // כל השאר - הצג דשבורד
  return <Dashboard />;
}

function ProtectedReports() {
  return (
    <PermissionWrapper 
      permission="view_reports" 
      fallback={
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <h2 className="text-2xl font-bold mb-2">אין לך הרשאה לצפות בדף זה</h2>
            <p className="text-muted-foreground">צור קשר עם המנהל למתן הרשאות דוחות ואנליטיקה.</p>
          </div>
        </div>
      }
    >
      <Reports />
    </PermissionWrapper>
  );
}

function Router() {
  const { isAuthenticated, isLoading } = useAuth();

  const { data: currentUser, isLoading: isUserLoading } = useQuery({
    queryKey: ["/api/auth/user"],
    enabled: isAuthenticated,
  });

  // בדיקה נכונה - role.type (לא roleType)
  const isExternalRecruiter = (currentUser as any)?.userRoles?.some((ur: any) => ur.role?.type === "external_recruiter");

  if (isLoading || !isAuthenticated) {
    return (
      <Switch>
        <Route path="/" component={Login} />
        <Route path="/login" component={Login} />
        <Route path="/jobs/:id/landing" component={JobLanding} />
        <Route component={NotFound} />
      </Switch>
    );
  }

  // הצג מסך טעינה כל עוד נתוני המשתמש עדיין נטענים
  if (isUserLoading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <div className="text-gray-600 dark:text-gray-400">טוען...</div>
        </div>
      </div>
    );
  }

  return (
    <RouteGuard>
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <Navbar />
        {/* הצג רק אחרי שיודעים בוודאות שהמשתמש אינו רכז חיצוני */}
        {currentUser && !isExternalRecruiter ? <ReminderPopup /> : null}
        {currentUser && !isExternalRecruiter ? <WhatsAppWidget /> : null}
        {currentUser && !isExternalRecruiter ? <WhatsAppNotificationContainer /> : null}
        <main className="w-full px-4 sm:px-6 lg:px-8 py-6">
          <Switch>
          <Route path="/" component={HomePage} />
          <Route path="/candidates" component={Candidates} />
          <Route path="/candidates/recently-updated" component={RecentlyUpdated} />
          <Route path="/candidates/new" component={AddCandidate} />
          <Route path="/candidates/add" component={AddCandidate} />
          <Route path="/candidates/bulk-import" component={BulkImportCandidates} />
          <Route path="/candidates/advanced" component={AdvancedCandidate} />
          <Route path="/candidates/:id/advanced" component={AdvancedCandidate} />
          <Route path="/candidates/:id" component={CandidateDetail} />
          <Route path="/cv-search" component={CVSearch} />
          <Route path="/calendar" component={Calendar} />
          <Route path="/clients" component={Clients} />
          <Route path="/jobs" component={Jobs} />
          <Route path="/jobs/:id/landing" component={JobLanding} />
          <Route path="/interviews" component={Interviews} />
          <Route path="/interviews/:jobId" component={JobInterviews} />
          <Route path="/emails" component={Emails} />
          <Route path="/email-settings" component={EmailSettings} />
          <Route path="/system-settings" component={SystemSettings} />
          <Route path="/user-management" component={UserManagement} />
          <Route path="/settings" component={Settings} />
          <Route path="/whatsapp-chats" component={WhatsAppChats} />
          <Route path="/external-recruiters" component={ExternalRecruiters} />
          <Route path="/my-jobs" component={MyJobs} />
          <Route path="/upload-candidate" component={UploadCandidateExternal} />
          <Route path="/pending-approvals" component={PendingApprovals} />
          <Route path="/reports" component={ProtectedReports} />
          <Route component={NotFound} />
          </Switch>
        </main>
      </div>
    </RouteGuard>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
