import { useEffect } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";

const ALLOWED_ROUTES_FOR_EXTERNAL_RECRUITER = [
  "/my-jobs",
  "/upload-candidate",
  "/login",
  "/",
];

export function RouteGuard({ children }: { children: React.ReactNode }) {
  const [location, setLocation] = useLocation();
  
  const { data: currentUser } = useQuery({
    queryKey: ["/api/auth/user"],
  });

  const isExternalRecruiter = (currentUser as any)?.userRoles?.some(
    (ur: any) => ur.role?.type === "external_recruiter"
  );

  useEffect(() => {
    if (!currentUser || !isExternalRecruiter) return;

    // בדיקה אם הנתיב המבוקש מותר לרכז חיצוני
    const isAllowed = ALLOWED_ROUTES_FOR_EXTERNAL_RECRUITER.some(route => {
      if (route === "/") return location === "/";
      return location.startsWith(route);
    });

    // אם הנתיב לא מותר - הפנה ל-/my-jobs
    if (!isAllowed) {
      console.warn(`⛔ External recruiter blocked from accessing: ${location}`);
      setLocation("/my-jobs");
    }
  }, [location, currentUser, isExternalRecruiter, setLocation]);

  return <>{children}</>;
}
