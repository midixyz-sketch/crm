import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import type { EnrichedCandidate } from "@shared/schema";

export default function RecentlyUpdated() {
  const { toast } = useToast();
  const { isAuthenticated, isLoading } = useAuth();
  const PAGE_SIZE = 50;
  const [page, setPage] = useState(0);
  const offset = page * PAGE_SIZE;

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      toast({
        title: "לא מורשה",
        description: "אתה מנותק. מתחבר שוב...",
        variant: "destructive",
      });
      setTimeout(() => {
        window.location.href = "/login";
      }, 500);
      return;
    }
  }, [isAuthenticated, isLoading, toast]);

  const { data: candidatesData, isLoading: candidatesLoading } = useQuery<{ candidates: EnrichedCandidate[]; total: number }>({
    queryKey: ["/api/candidates/recently-updated", { 
      limit: PAGE_SIZE,
      offset
    }],
    enabled: isAuthenticated,
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'sent_to_employer': return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
      case 'rejected': return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'sent_to_employer': return 'נשלח למעסיק';
      case 'rejected': return 'נדחה';
      default: return status || 'לא הוגדר';
    }
  };

  return (
    <div className="min-h-screen w-full max-w-full space-y-6 p-6" dir="rtl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">עודכנו לאחרונה</h1>
        <p className="text-gray-600 dark:text-gray-400 mt-2">מועמדים שנפסלו או נשלחו למעסיק</p>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
        <div className="flex justify-between items-center mb-4">
          <div className="text-sm text-gray-600 dark:text-gray-400">
            {candidatesData?.candidates && candidatesData?.total ? (
              <>
                {candidatesData.candidates.length > 0 ? (
                  `מציג ${offset + 1}-${offset + candidatesData.candidates.length} מתוך ${candidatesData.total} מועמדים`
                ) : (
                  `0 מועמדים`
                )}
              </>
            ) : ""}
          </div>
        </div>

        {candidatesLoading ? (
          <div className="animate-pulse">
            <div className="h-8 bg-gray-200 rounded mb-4"></div>
            <div className="space-y-2">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-12 bg-gray-200 rounded"></div>
              ))}
            </div>
          </div>
        ) : (
          <>
            {candidatesData?.candidates && candidatesData.candidates.length > 0 ? (
              <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden w-full">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-gray-50 dark:bg-gray-900 text-sm">
                        <TableHead className="text-right font-medium text-gray-700 dark:text-gray-300">שם מלא</TableHead>
                        <TableHead className="text-right font-medium text-gray-700 dark:text-gray-300">שם המשרה</TableHead>
                        <TableHead className="text-right font-medium text-gray-700 dark:text-gray-300">שם החברה</TableHead>
                        <TableHead className="text-right font-medium text-gray-700 dark:text-gray-300">יוזר שטיפל</TableHead>
                        <TableHead className="text-right font-medium text-gray-700 dark:text-gray-300">סטטוס</TableHead>
                        <TableHead className="text-right font-medium text-gray-700 dark:text-gray-300">תאריך עדכון</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {candidatesData.candidates.map((candidate: EnrichedCandidate) => (
                        <TableRow 
                          key={candidate.id} 
                          className="hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer" 
                          data-testid={`row-candidate-${candidate.id}`}
                          onClick={() => window.location.href = `/candidates/${candidate.id}`}
                        >
                          <TableCell className="font-medium text-sm">
                            <p className="text-secondary dark:text-white" data-testid={`text-candidate-name-${candidate.id}`}>
                              {candidate.firstName} {candidate.lastName}
                            </p>
                          </TableCell>
                          <TableCell className="text-sm">
                            {candidate.lastJobTitle || "-"}
                          </TableCell>
                          <TableCell className="text-sm">
                            {candidate.lastReferralClient || "-"}
                          </TableCell>
                          <TableCell className="text-sm">
                            {candidate.creatorUsername || "-"}
                          </TableCell>
                          <TableCell className="text-sm">
                            <Badge className={getStatusColor(candidate.status || 'available')}>
                              {getStatusText(candidate.status || 'available')}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-sm whitespace-nowrap">
                            {candidate.lastStatusChange ? new Date(candidate.lastStatusChange).toLocaleDateString('he-IL') : "-"}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            ) : (
              <div className="text-center py-12">
                <p className="text-gray-500 text-lg">לא נמצאו מועמדים שעודכנו לאחרונה</p>
              </div>
            )}
          </>
        )}

        {/* Pagination Controls */}
        {candidatesData?.candidates && candidatesData.candidates.length > 0 && candidatesData.total > PAGE_SIZE && (
          <div className="flex justify-center items-center gap-4 mt-6">
            <Button
              variant="outline"
              onClick={() => setPage(p => Math.max(0, p - 1))}
              disabled={page === 0 || candidatesLoading}
              data-testid="button-previous-page"
            >
              הקודם
            </Button>
            <span className="text-sm text-gray-600 dark:text-gray-400">
              עמוד {page + 1} מתוך {Math.ceil(candidatesData.total / PAGE_SIZE)}
            </span>
            <Button
              variant="outline"
              onClick={() => setPage(p => p + 1)}
              disabled={offset + PAGE_SIZE >= candidatesData.total || candidatesLoading}
              data-testid="button-next-page"
            >
              הבא
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
