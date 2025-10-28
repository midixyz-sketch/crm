import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { LayoutDashboard, Users, Building2, Briefcase, Mail, BarChart3, Settings, UserCheck, Search, Menu, Calendar, Shield, LogOut, Upload, RefreshCw, UserCog, Clock } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { usePermissions } from "@/hooks/usePermissions";
import { useDetailedPermissions } from "@/hooks/useDetailedPermissions";
import { useAuth } from "@/hooks/useAuth";
import { queryClient } from "@/lib/queryClient";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export default function Navbar() {
  const [location] = useLocation();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const { canManageUsers, isSuperAdmin } = usePermissions();
  const { getAllowedNavigation, canViewComponent } = useDetailedPermissions();
  const { user } = useAuth();

  const handleLogout = async () => {
    try {
      const response = await fetch('/api/logout', {
        method: 'POST',
        credentials: 'include'
      });
      
      if (response.ok) {
        queryClient.clear();
        window.location.href = '/';
      }
    } catch (error) {
      console.error('Logout error:', error);
      window.location.href = '/';
    }
  };

  return (
    <nav className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          {/* Logo and Brand + My Jobs Link */}
          <div className="flex items-center space-x-6 space-x-reverse">
            <Link href="/" data-testid="link-logo" className="hover:opacity-80 transition-opacity">
              <div className="flex flex-col items-start">
                <h1 className="text-3xl font-bold text-primary">Linkjob</h1>
                <p className="text-sm text-gray-600 dark:text-gray-300">Recruitment Management System</p>
              </div>
            </Link>
            
            {/* Navigation Links */}
            <div className="hidden lg:flex items-center space-x-4 space-x-reverse">
              {getAllowedNavigation().map((item) => {
                const getIcon = (iconName: string) => {
                  switch (iconName) {
                    case 'LayoutDashboard': return LayoutDashboard;
                    case 'Users': return Users;
                    case 'RefreshCw': return RefreshCw;
                    case 'Search': return Search;
                    case 'Calendar': return Calendar;
                    case 'Building2': return Building2;
                    case 'Briefcase': return Briefcase;
                    case 'UserCheck': return UserCheck;
                    case 'Mail': return Mail;
                    case 'Settings': return Settings;
                    case 'BarChart3': return BarChart3;
                    case 'Shield': return Shield;
                    case 'UserCog': return UserCog;
                    case 'Clock': return Clock;
                    default: return Settings;
                  }
                };
                
                const Icon = getIcon(item.icon);
                const isActive = location === item.href;
                
                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    className={cn(
                      "flex items-center px-3 py-2 rounded-md text-sm font-medium transition-colors",
                      isActive 
                        ? "text-primary bg-blue-50 dark:bg-blue-900/20" 
                        : "text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
                    )}
                    data-testid={`link-nav-${item.href === '/' ? 'dashboard' : item.href.slice(1)}`}
                  >
                    <Icon className="h-4 w-4 ml-2" />
                    {item.name}
                  </Link>
                );
              })}
            </div>
          </div>

          {/* User Menu */}
          <div className="hidden lg:flex items-center ml-4">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="w-10 h-10 bg-primary text-white rounded-full flex items-center justify-center cursor-pointer hover:opacity-80 transition-opacity focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2">
                  <span className="text-sm font-medium">
                    {user ? `${(user as any).firstName?.charAt(0) || ''}${(user as any).lastName?.charAt(0) || ''}` || 'U' : 'U'}
                  </span>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
                  <p className="text-sm font-medium text-gray-900 dark:text-white">
                    {user ? `${(user as any).firstName || ''} ${(user as any).lastName || ''}`.trim() || (user as any).email : 'User'}
                  </p>
                  <p className="text-xs text-gray-600 dark:text-gray-300 mt-1">
                    {(user as any)?.email || ''}
                  </p>
                </div>
                <DropdownMenuItem onClick={handleLogout} className="cursor-pointer">
                  <LogOut className="h-4 w-4 ml-2" />
                  <span>Logout</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Mobile menu */}
          <div className="lg:hidden flex items-center space-x-2 space-x-reverse">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="w-9 h-9 bg-primary text-white rounded-full flex items-center justify-center cursor-pointer hover:opacity-80 transition-opacity focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2">
                  <span className="text-sm font-medium">
                    {user ? `${(user as any).firstName?.charAt(0) || ''}${(user as any).lastName?.charAt(0) || ''}` || 'U' : 'U'}
                  </span>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
                  <p className="text-sm font-medium text-gray-900 dark:text-white">
                    {user ? `${(user as any).firstName || ''} ${(user as any).lastName || ''}`.trim() || (user as any).email : 'User'}
                  </p>
                  <p className="text-xs text-gray-600 dark:text-gray-300 mt-1">
                    {(user as any)?.email || ''}
                  </p>
                </div>
                <DropdownMenuItem onClick={handleLogout} className="cursor-pointer">
                  <LogOut className="h-4 w-4 ml-2" />
                  <span>Logout</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <DropdownMenu open={isMenuOpen} onOpenChange={setIsMenuOpen}>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm">
                  <Menu className="h-5 w-5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                {getAllowedNavigation().map((item) => {
                    const getIcon = (iconName: string) => {
                      switch (iconName) {
                        case 'LayoutDashboard': return LayoutDashboard;
                        case 'Users': return Users;
                        case 'RefreshCw': return RefreshCw;
                        case 'Search': return Search;
                        case 'Calendar': return Calendar;
                        case 'Building2': return Building2;
                        case 'Briefcase': return Briefcase;
                        case 'UserCheck': return UserCheck;
                        case 'Mail': return Mail;
                        case 'Settings': return Settings;
                        case 'BarChart3': return BarChart3;
                        case 'Shield': return Shield;
                        case 'UserCog': return UserCog;
                        case 'Clock': return Clock;
                        default: return Settings;
                      }
                    };
                    
                    const Icon = getIcon(item.icon);
                    const isActive = location === item.href;
                    
                    return (
                      <DropdownMenuItem key={item.name} asChild>
                        <Link
                          href={item.href}
                          className={cn(
                            "flex items-center w-full px-2 py-2",
                            isActive && "bg-blue-50 dark:bg-blue-900/20"
                          )}
                          onClick={() => setIsMenuOpen(false)}
                        >
                          <Icon className="h-4 w-4 ml-2" />
                          {item.name}
                        </Link>
                      </DropdownMenuItem>
                    );
                  })}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>
    </nav>
  );
}