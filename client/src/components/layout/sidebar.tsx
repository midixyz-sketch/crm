import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { LayoutDashboard, Users, Building2, Briefcase, Mail, BarChart3, Settings, UserCheck, Search, Calendar, Upload } from "lucide-react";
import { usePermissions } from "@/hooks/usePermissions";
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

  return (
    <aside className="bg-surface w-64 shadow-lg border-l border-gray-200 dark:border-gray-700 flex-shrink-0 sidebar-transition">
      <div className="p-6 border-b border-gray-200 dark:border-gray-700 flex justify-center">
        <Link href="/" data-testid="link-logo-sidebar" className="flex items-center">
          <img 
            src="/linkjob-logo.png" 
            alt="Linkjob Logo" 
            className="h-16 w-auto cursor-pointer hover:opacity-80 transition-opacity"
            onError={(e) => {
              console.error('Sidebar logo failed to load');
              e.currentTarget.style.display = 'none';
              e.currentTarget.parentElement!.innerHTML = '<span class="text-xl font-bold text-primary">Linkjob</span>';
            }}
          />
        </Link>
      </div>
      
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
