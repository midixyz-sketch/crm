import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Filter } from "lucide-react";
import type { EnrichedCandidate, Job } from "@shared/schema";

export default function RecentlyUpdated() {
  const { toast } = useToast();
  const { isAuthenticated, isLoading } = useAuth();
  const PAGE_SIZE = 50;
  const [page, setPage] = useState(0);
  const offset = page * PAGE_SIZE;
  
  // Filters
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [jobFilter, setJobFilter] = useState<string>("");
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");

  // Reset page when filters change
  useEffect(() => {
    setPage(0);
  }, [statusFilter, jobFilter, dateFrom, dateTo]);

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

  // Load jobs for filter
  const { data: jobsData } = useQuery<{ jobs: Job[] }>({
    queryKey: ["/api/jobs"],
    enabled: isAuthenticated,
  });

  const { data: candidatesData, isLoading: candidatesLoading } = useQuery<{ candidates: EnrichedCandidate[]; total: number }>({
    queryKey: ["/api/candidates/recently-updated", { 
      limit: PAGE_SIZE,
      offset,
      status: statusFilter !== "all" ? statusFilter : undefined,
      jobs: jobFilter || undefined,
      dateFrom: dateFrom || undefined,
      dateTo: dateTo || undefined
    }],
    enabled: isAuthenticated,
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'sent_to_employer': return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
      case 'rejected_by_employer': return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
      case 'rejected': return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'sent_to_employer': return 'נשלח למעסיק';
      case 'rejected_by_employer': return 'נפסל ע"י מעסיק';
      case 'rejected': return 'נדחה';
      default: return status || 'לא הוגדר';
    }
  };

  const handleClearFilters = () => {
    setStatusFilter("all");
    setJobFilter("");
    setDateFrom("");
    setDateTo("");
    setPage(0);
  };

  return (
    <div className="min-h-screen w-full max-w-full space-y-6 p-6" dir="rtl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">עודכנו לאחרונה</h1>
        <p className="text-gray-600 dark:text-gray-400 mt-2">מועמדים שנפסלו או נשלחו למעסיק</p>
      </div>

      {/* Filters Section */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 mb-4">
        <div className="flex items-center gap-2 mb-4">
          <Filter className="h-5 w-5 text-gray-600" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">סינונים</h3>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="space-y-2">
            <Label htmlFor="status-filter">סטטוס</Label>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger id="status-filter" data-testid="select-status-filter">
                <SelectValue placeholder="בחר סטטוס" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">הכל</SelectItem>
                <SelectItem value="sent_to_employer">נשלח למעסיק</SelectItem>
                <SelectItem value="rejected_by_employer">נפסל ע"י מעסיק</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="job-filter">משרה</Label>
            <Select value={jobFilter} onValueChange={setJobFilter}>
              <SelectTrigger id="job-filter" data-testid="select-job-filter">
                <SelectValue placeholder="כל המשרות" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">כל המשרות</SelectItem>
                {jobsData?.jobs?.map((job) => (
                  <SelectItem key={job.id} value={job.id}>
                    {job.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="date-from">מתאריך</Label>
            <Input
              id="date-from"
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              data-testid="input-date-from"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="date-to">עד תאריך</Label>
            <Input
              id="date-to"
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              data-testid="input-date-to"
            />
          </div>
        </div>

        <div className="mt-4">
          <Button onClick={handleClearFilters} variant="outline" data-testid="button-clear-filters">
            נקה סינונים
          </Button>
        </div>
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
                            {candidate.lastReferralUserName || candidate.creatorUsername || "-"}
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
