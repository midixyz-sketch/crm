import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { LayoutDashboard, Users, Building2, Briefcase, Mail, BarChart3, Settings, UserCheck, Search, Calendar, Upload } from "lucide-react";
import { usePermissions } from "@/hooks/usePermissions";
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
const navigation = [
  { name: "מאגר מועמדים", href: "/candidates", icon: Users },
  { name: "חיפוש בקורות חיים", href: "/cv-search", icon: Search },
  { name: "יומן", href: "/calendar", icon: Calendar },
  { name: "מאגר לקוחות", href: "/clients", icon: Building2 },
  { name: "מאגר משרות", href: "/jobs", icon: Briefcase },
  { name: "ראיונות", href: "/interviews", icon: UserCheck },
  { name: "דוחות ואנליטיקה", href: "/reports", icon: BarChart3 },
  { name: "הגדרות", href: "/settings", icon: Settings },
];

export default function Sidebar() {
  const [location] = useLocation();
  const { isSuperAdmin } = usePermissions();
  const [whatsappDialogOpen, setWhatsappDialogOpen] = useState(false);
  const { toast } = useToast();

  // WhatsApp status query - always enabled when dialog is open
  const { data: whatsappStatus, refetch: refetchStatus, isLoading } = useQuery({
    queryKey: ['/api/whatsapp/status'],
    refetchInterval: whatsappDialogOpen ? 3000 : false,
    enabled: whatsappDialogOpen,
    staleTime: 0,
  });

  const handleInitializeWhatsApp = async () => {
    try {
      await apiRequest('POST', '/api/whatsapp/initialize', {});
      refetchStatus();
      toast({
        title: "WhatsApp מאותחל",
        description: "סרוק את קוד ה-QR עם WhatsApp בטלפון שלך",
      });
    } catch (error) {
      toast({
        title: "שגיאה",
        description: "לא ניתן לאתחל את WhatsApp",
        variant: "destructive",
      });
    }
  };

  const handleDisconnect = async () => {
    try {
      await apiRequest('POST', '/api/whatsapp/logout', {});
      refetchStatus();
      toast({
        title: "התנתקת מWhatsApp",
        description: "WhatsApp נותק בהצלחה",
      });
    } catch (error) {
      toast({
        title: "שגיאה",
        description: "לא ניתן להתנתק מWhatsApp",
        variant: "destructive",
      });
    }
  };

  return (
    <aside className="bg-surface w-64 shadow-lg border-l border-gray-200 dark:border-gray-700 flex-shrink-0 sidebar-transition">
      <div className="p-6 border-b border-gray-200 dark:border-gray-700 flex justify-center">
        <button 
          onClick={() => setWhatsappDialogOpen(true)}
          data-testid="button-logo-sidebar" 
          className="hover:opacity-80 transition-opacity cursor-pointer border-none bg-transparent"
        >
          <div className="flex flex-col items-center text-center">
            <h1 className="text-3xl font-bold text-primary">Linkjob</h1>
            <p className="text-base text-gray-600 dark:text-gray-300 mt-1">מערכת לניהול הגיוס</p>
          </div>
        </button>
      </div>

      {/* WhatsApp Connection Dialog */}
      <Dialog open={whatsappDialogOpen} onOpenChange={setWhatsappDialogOpen}>
        <DialogContent className="sm:max-w-md" dir="rtl">
          <DialogHeader>
            <DialogTitle>חיבור WhatsApp</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            {isLoading ? (
              <div className="text-center space-y-4 py-8">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
                <p className="text-sm text-gray-600">טוען...</p>
              </div>
            ) : whatsappStatus?.isConnected ? (
              <div className="text-center space-y-4">
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
                  <svg className="w-10 h-10 text-green-600" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
                  </svg>
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-green-600">מחובר בהצלחה!</h3>
                  <p className="text-sm text-gray-600 mt-2">
                    WhatsApp מחובר למספר: {whatsappStatus.phoneNumber || 'לא זמין'}
                  </p>
                </div>
                <Button
                  onClick={handleDisconnect}
                  variant="outline"
                  className="w-full"
                >
                  התנתק מWhatsApp
                </Button>
              </div>
            ) : whatsappStatus?.qrCode ? (
              <div className="text-center space-y-4">
                <p className="text-sm text-gray-600">
                  סרוק את קוד ה-QR עם WhatsApp בטלפון שלך
                </p>
                <div className="flex justify-center bg-white p-4 rounded-lg">
                  <img 
                    src={whatsappStatus.qrCode} 
                    alt="WhatsApp QR Code"
                    className="w-64 h-64"
                  />
                </div>
                <div className="text-xs text-gray-500 space-y-1">
                  <p>1. פתח WhatsApp בטלפון שלך</p>
                  <p>2. לחץ על תפריט (⋮) או הגדרות</p>
                  <p>3. בחר "מכשירים מקושרים"</p>
                  <p>4. לחץ על "קשר מכשיר"</p>
                  <p>5. סרוק את הקוד</p>
                </div>
              </div>
            ) : (
              <div className="text-center space-y-4">
                <p className="text-sm text-gray-600">
                  חבר את WhatsApp שלך למערכת
                </p>
                <Button
                  onClick={handleInitializeWhatsApp}
                  className="w-full bg-green-600 hover:bg-green-700"
                  data-testid="button-initialize-whatsapp"
                >
                  התחל חיבור WhatsApp
                </Button>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
      
      <nav className="mt-6">
        <ul className="space-y-2 px-4">
          {navigation.map((item) => {
            const Icon = item.icon;
            const isActive = location === item.href;
            
            return (
              <li key={item.name}>
                <Link 
                  href={item.href}
                  className={cn(
                    "flex items-center p-3 rounded-lg transition-colors",
                    isActive 
                      ? "text-primary bg-blue-50 dark:bg-blue-900/20" 
                      : "text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
                  )}
                  data-testid={`link-nav-${item.href === '/' ? 'dashboard' : item.href.slice(1)}`}
                >
                  <Icon className="h-5 w-5 ml-3" />
                  {item.name}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </aside>
  );
}
