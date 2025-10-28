import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "./useAuth";

// הגדרת סוגי ההרשאות
export type PagePermission = 
  | 'view_dashboard'
  | 'view_candidates' 
  | 'create_candidates'
  | 'view_candidate_details'
  | 'edit_candidates'
  | 'delete_candidates'
  | 'view_recently_updated'
  | 'view_cv_search'
  | 'view_calendar'
  | 'view_clients'
  | 'create_clients'
  | 'edit_clients'
  | 'delete_clients'
  | 'view_jobs'
  | 'create_jobs'
  | 'edit_jobs'
  | 'delete_jobs'
  | 'view_interviews'
  | 'schedule_interviews'
  | 'manage_interviews'
  | 'view_emails'
  | 'send_emails'
  | 'manage_email_settings'
  | 'manage_system_settings'
  | 'manage_users'
  | 'access_settings'
  | 'view_reports'
  | 'view_analytics'
  | 'manage_external_recruiters'
  | 'view_pending_approvals'
  | 'view_my_jobs';

export type MenuPermission = 
  | 'view_main_navigation'
  | 'view_quick_actions'
  | 'quick_add_candidate'
  | 'quick_add_job'
  | 'quick_add_client'
  | 'view_client_names'
  | 'export_data'
  | 'perform_bulk_actions'
  | 'upload_cv'
  | 'download_cv'
  | 'add_candidate_notes'
  | 'view_candidate_history'
  | 'send_candidate_email'
  | 'close_jobs'
  | 'assign_candidates'
  | 'view_job_analytics'
  | 'use_ocr_processing'
  | 'use_advanced_search'
  | 'perform_system_backup'
  | 'view_system_logs';

export type ComponentPermission = 
  | 'view_sidebar'
  | 'view_navbar'
  | 'view_user_dropdown'
  | 'view_notifications'
  | 'access_logout'
  | 'access_profile'
  | 'view_help'
  | 'view_candidate_table'
  | 'view_job_table'
  | 'view_client_table'
  | 'view_statistics'
  | 'use_search_filters'
  | 'use_sort_options'
  | 'use_pagination';

export type Permission = PagePermission | MenuPermission | ComponentPermission;

interface UserPermissions {
  pages: PagePermission[];
  menus: MenuPermission[];
  components: ComponentPermission[];
  roleTypes: string[];
  canViewClientNames: boolean;
  allowedJobIds: string[];
}

export function useDetailedPermissions() {
  const { user, isAuthenticated } = useAuth();

  // Get detailed permissions from server
  const { data: permissions, isLoading } = useQuery<UserPermissions>({
    queryKey: ['/api/permissions/detailed', (user as any)?.id],
    enabled: isAuthenticated && !!(user as any)?.id,
    staleTime: 0, // No cache - always fetch from server
    gcTime: 0, // No cache
  });

  // Check page permission
  const canAccessPage = (page: PagePermission): boolean => {
    if (!permissions) return false;
    return permissions.pages.includes(page);
  };

  // Check menu/button permission
  const canUseMenu = (menu: MenuPermission): boolean => {
    if (!permissions) return false;
    return permissions.menus.includes(menu);
  };

  // Check component permission
  const canViewComponent = (component: ComponentPermission): boolean => {
    if (!permissions) return true; // Default allowed
    return permissions.components.includes(component);
  };

  // Check if can view client names
  const canViewClientNames = (): boolean => {
    if (!permissions) return false;
    return permissions.canViewClientNames;
  };

  // Check if can view specific job
  const canViewJob = (jobId: string): boolean => {
    if (!permissions) return false;
    
    // If has permission to view all jobs
    if (canAccessPage('view_jobs') && permissions.allowedJobIds.length === 0) {
      return true;
    }
    
    // If limited to specific jobs
    return permissions.allowedJobIds.includes(jobId);
  };

  // Get list of allowed navigation pages - top menu only
  const getAllowedNavigation = () => {
    if (!permissions) return [];

    const navigation = [
      { 
        permission: 'view_candidates' as PagePermission, 
        name: "Candidates", 
        href: "/candidates", 
        icon: "Users" 
      },
      { 
        permission: 'view_recently_updated' as PagePermission, 
        name: "Recently Updated", 
        href: "/candidates/recently-updated", 
        icon: "RefreshCw" 
      },
      { 
        permission: 'view_cv_search' as PagePermission, 
        name: "CV Search", 
        href: "/cv-search", 
        icon: "Search" 
      },
      { 
        permission: 'view_calendar' as PagePermission, 
        name: "Calendar", 
        href: "/calendar", 
        icon: "Calendar" 
      },
      { 
        permission: 'view_clients' as PagePermission, 
        name: "Clients", 
        href: "/clients", 
        icon: "Building2" 
      },
      { 
        permission: 'view_jobs' as PagePermission, 
        name: "Jobs", 
        href: "/jobs", 
        icon: "Briefcase" 
      },
      { 
        permission: 'view_interviews' as PagePermission, 
        name: "Interviews", 
        href: "/interviews", 
        icon: "UserCheck" 
      },
      { 
        permission: 'manage_external_recruiters' as PagePermission, 
        name: "External Recruiters", 
        href: "/external-recruiters", 
        icon: "UserCog" 
      },
      { 
        permission: 'view_pending_approvals' as PagePermission, 
        name: "Pending Approvals", 
        href: "/pending-approvals", 
        icon: "Clock" 
      },
      { 
        permission: 'view_reports' as PagePermission, 
        name: "Reports & Analytics", 
        href: "/reports", 
        icon: "BarChart3" 
      },
      { 
        permission: 'access_settings' as PagePermission, 
        name: "Settings", 
        href: "/settings", 
        icon: "Settings" 
      }
    ];

    return navigation.filter(item => canAccessPage(item.permission));
  };

  // Check if user is super admin
  const isSuperAdmin = (): boolean => {
    if (!permissions) return false;
    return permissions.roleTypes.includes('super_admin');
  };

  // Check if user is admin (any type)
  const isAdmin = (): boolean => {
    if (!permissions) return false;
    return permissions.roleTypes.some(role => 
      ['super_admin', 'admin', 'restricted_admin'].includes(role)
    );
  };

  // Check if user is job viewer only
  const isJobViewer = (): boolean => {
    if (!permissions) return false;
    return permissions.roleTypes.includes('job_viewer');
  };

  return {
    permissions,
    isLoading,
    
    // Permission check functions
    canAccessPage,
    canUseMenu,
    canViewComponent,
    canViewClientNames,
    canViewJob,
    
    // Helper functions
    getAllowedNavigation,
    isSuperAdmin,
    isAdmin,
    isJobViewer,
    
    // Raw data
    userRoleTypes: permissions?.roleTypes || [],
    allowedJobIds: permissions?.allowedJobIds || []
  };
}

// Shortcut hook for quick checks
export function usePermissionCheck() {
  const { canAccessPage, canUseMenu, canViewComponent } = useDetailedPermissions();
  
  return {
    // Common page checks
    canManageCandidates: canAccessPage('create_candidates') && canAccessPage('edit_candidates'),
    canManageJobs: canAccessPage('create_jobs') && canAccessPage('edit_jobs'),
    canManageClients: canAccessPage('create_clients') && canAccessPage('edit_clients'),
    canManageUsers: canAccessPage('manage_users'),
    canManageSettings: canAccessPage('manage_system_settings'),
    
    // Common menu checks
    canQuickAdd: canUseMenu('view_quick_actions'),
    canViewClientNames: canUseMenu('view_client_names'),
    canExportData: canUseMenu('export_data'),
    canUseAdvancedSearch: canUseMenu('use_advanced_search'),
    
    // Common component checks
    canViewSidebar: canViewComponent('view_sidebar'),
    canViewNavbar: canViewComponent('view_navbar'),
    canViewStats: canViewComponent('view_statistics')
  };
}