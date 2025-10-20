import { Button, type ButtonProps } from "@/components/ui/button";
import { useDetailedPermissions, type Permission } from "@/hooks/useDetailedPermissions";
import { ReactNode, forwardRef } from "react";

interface PermissionButtonProps extends ButtonProps {
  permission: Permission;
  fallback?: ReactNode;
  hideWhenNoAccess?: boolean; // true = מסתיר כפתור, false = מציג כפתור מושבת
}

// כפתור עם הרשאות
export const PermissionButton = forwardRef<HTMLButtonElement, PermissionButtonProps>(({
  permission,
  children,
  fallback = null,
  hideWhenNoAccess = false,
  disabled,
  ...props
}, ref) => {
  const { canAccessPage, canUseMenu, canViewComponent } = useDetailedPermissions();
  
  let hasPermission = false;
  
  // בדוק סוג ההרשאה
  if (permission.startsWith('view_') || permission.startsWith('create_') || 
      permission.startsWith('edit_') || permission.startsWith('delete_') ||
      permission.startsWith('manage_') || permission.startsWith('access_')) {
    hasPermission = canAccessPage(permission as any);
  } else if (permission.startsWith('quick_') || permission.includes('_')) {
    hasPermission = canUseMenu(permission as any);
  } else {
    hasPermission = canViewComponent(permission as any);
  }
  
  // אם אין הרשאה
  if (!hasPermission) {
    if (hideWhenNoAccess) {
      return <>{fallback}</>;
    }
    
    // מציג כפתור מושבת
    return (
      <Button 
        {...props} 
        ref={ref}
        disabled={true}
        variant="outline"
        className="opacity-50 cursor-not-allowed"
        title="אין הרשאה לפעולה זו"
      >
        {children}
      </Button>
    );
  }
  
  return (
    <Button {...props} ref={ref} disabled={disabled}>
      {children}
    </Button>
  );
});

PermissionButton.displayName = "PermissionButton";

// כפתורי פעולה נפוצים עם הרשאות
export const AddButton = forwardRef<HTMLButtonElement, Omit<PermissionButtonProps, 'permission'>>(
  ({ children, ...props }, ref) => {
    return (
      <PermissionButton permission="create_candidates" {...props} ref={ref}>
        {children || "הוסף"}
      </PermissionButton>
    );
  }
);
AddButton.displayName = "AddButton";

export const EditButton = forwardRef<HTMLButtonElement, Partial<PermissionButtonProps>>(
  ({ permission = "edit_candidates", children, ...props }, ref) => {
    return (
      <PermissionButton permission={permission} {...props} ref={ref}>
        {children || "ערוך"}
      </PermissionButton>
    );
  }
);
EditButton.displayName = "EditButton";

export const DeleteButton = forwardRef<HTMLButtonElement, Partial<PermissionButtonProps>>(
  ({ permission = "delete_candidates", children, ...props }, ref) => {
    return (
      <PermissionButton permission={permission} {...props} ref={ref}>
        {children || "מחק"}
      </PermissionButton>
    );
  }
);
DeleteButton.displayName = "DeleteButton";

export const ExportButton = forwardRef<HTMLButtonElement, Omit<PermissionButtonProps, 'permission'>>(
  ({ children, ...props }, ref) => {
    return (
      <PermissionButton permission="export_data" {...props} ref={ref}>
        {children || "ייצא"}
      </PermissionButton>
    );
  }
);
ExportButton.displayName = "ExportButton";

export const SettingsButton = forwardRef<HTMLButtonElement, Omit<PermissionButtonProps, 'permission'>>(
  ({ children, ...props }, ref) => {
    return (
      <PermissionButton permission="access_settings" {...props} ref={ref}>
        {children || "הגדרות"}
      </PermissionButton>
    );
  }
);
SettingsButton.displayName = "SettingsButton";