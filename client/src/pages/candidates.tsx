import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { usePermissions } from "@/hooks/usePermissions";
import { useToast } from "@/hooks/use-toast";
import { PermissionWrapper } from "@/components/permissions/permission-wrapper";
import { PermissionButton, AddButton, EditButton, DeleteButton, ExportButton } from "@/components/permissions/button-permission";
import { useDataFiltering } from "@/components/permissions/permission-wrapper";
import { isUnauthorizedError } from "@/lib/authUtils";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import CandidateForm from "@/components/forms/candidate-form";
import SearchFilter from "@/components/search-filter";
import { EmailDialog } from "@/components/email-dialog";
import { MultiSelect } from "@/components/ui/multi-select";
import { Plus, Search, Phone, Mail, FileText, Edit, Trash2, Send, Users, Calendar } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import type { Candidate, EnrichedCandidate } from "@shared/schema";

export default function Candidates() {
  const { toast } = useToast();
  const { filterCandidates, canViewClientNames } = useDataFiltering();
  const { isAuthenticated, isLoading } = useAuth();
  const { isSuperAdmin } = usePermissions();

  // Status color and text helpers
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'available': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'pending': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
      case 'pending_approval': return 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200';
      case 'sent_to_employer': return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
      case 'in_interview': return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200';
      case 'hired': return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200';
      case 'rejected': return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
      case 'not_relevant': return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
      case 'rejected_by_employer': return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
      case 'invited_to_interview': return 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200';
      case 'whatsapp_sent': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'phone_contact_made': return 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900 dark:text-cyan-200';
      case 'waiting_employer_response': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
      case 'attended_interview': return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
      case 'missed_interview': return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
      case 'passed_interview': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'employment_ended': return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
      case 'employed': return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
      case 'inactive': return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
      case 'blacklisted': return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
      case 'submitted': return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200';
      case 'reviewed': return 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200';
      case 'interview': return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200';
      case 'interview_scheduled': return 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200';
      case 'accepted': return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200';
      case 'new_application': return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
    }
  };

  const getStatusText = (status: string, recruitmentSource?: string | null) => {
    switch (status) {
      case 'available': return 'זמין';
      case 'pending': return 'ממתין';
      case 'pending_approval': return 'ממתין לאישור';
      case 'sent_to_employer': 
        return recruitmentSource ? `נשלח ע"י ${recruitmentSource}` : 'נשלח למעסיק';
      case 'in_interview': return 'בתהליך ראיון';
      case 'hired': return 'התקבל';
      case 'rejected': return 'נדחה';
      case 'not_relevant': return 'לא רלוונטי';
      case 'rejected_by_employer': return 'נפסל בראיון';
      case 'invited_to_interview': return 'זומן לראיון';
      case 'whatsapp_sent': return 'נשלחה הודעת ווצאפ';
      case 'phone_contact_made': return 'נוצר קשר טלפוני';
      case 'waiting_employer_response': return 'ממתין לתשובת מעסיק';
      case 'attended_interview': return 'הגיע לראיון';
      case 'missed_interview': return 'לא הגיע לראיון';
      case 'passed_interview': return 'עבר ראיון';
      case 'employment_ended': return 'סיים העסקה';
      case 'employed': return 'מועסק';
      case 'inactive': return 'לא פעיל';
      case 'blacklisted': return 'ברשימה שחורה';
      case 'submitted': return 'הוגש';
      case 'reviewed': return 'נסקר';
      case 'interview': return 'ראיון';
      case 'interview_scheduled': return 'זומן לראיון';
      case 'accepted': return 'התקבל';
      case 'new_application': return 'מועמדות חדשה';
      default: return status || 'לא הוגדר';
    }
  };

  const [, setLocation] = useLocation();
  const navigate = (path: string) => setLocation(path);
  const [search, setSearch] = useState("");
  const [dateFilter, setDateFilter] = useState("");
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([]);
  const [selectedJobs, setSelectedJobs] = useState<string[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [selectedCandidate, setSelectedCandidate] = useState<Candidate | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  
  // Pagination
  const PAGE_SIZE = 50;
  const [page, setPage] = useState(0);
  const offset = page * PAGE_SIZE;
  const [emailDialog, setEmailDialog] = useState<{
    isOpen: boolean;
    type: "candidate" | "interview" | "shortlist";
    candidateId?: string;
    candidateIds?: string[];
    candidateName?: string;
  }>({
    isOpen: false,
    type: "candidate",
  });
  const [selectedCandidates, setSelectedCandidates] = useState<string[]>([]);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [candidateToDelete, setCandidateToDelete] = useState<string | null>(null);

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

  // Load jobs
  const { data: jobsData } = useQuery<{ jobs: any[] }>({
    queryKey: ["/api/jobs"],
    enabled: isAuthenticated,
  });

  // Load users
  const { data: usersData } = useQuery<any[]>({
    queryKey: ["/api/users/all"],
    enabled: isAuthenticated,
  });

  // Reset page when filters change
  useEffect(() => {
    setPage(0);
  }, [search, dateFilter, selectedStatuses, selectedJobs, selectedUsers, dateFrom, dateTo]);

  const { data: candidatesData, isLoading: candidatesLoading } = useQuery<{ candidates: EnrichedCandidate[]; total: number }>({
    queryKey: ["/api/candidates/enriched", { 
      limit: PAGE_SIZE,
      offset,
      search, 
      dateFilter, 
      statuses: selectedStatuses, 
      jobs: selectedJobs, 
      users: selectedUsers,
      dateFrom,
      dateTo
    }],
    enabled: isAuthenticated,
  });

  // Status options
  const statusOptions = [
    { label: "נשלח למעסיק", value: "sent_to_employer" },
    { label: "נדחה", value: "rejected" },
    { label: "לא מתאים", value: "not_relevant" },
    { label: "ממתין", value: "pending" },
  ];

  // Job options
  const jobOptions = (jobsData?.jobs || []).map((job: any) => ({
    label: job.title,
    value: job.id,
  }));

  // User options
  const userOptions = (usersData || []).map((user: any) => ({
    label: `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email || user.username,
    value: user.id,
  }));

  const deleteCandidate = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/candidates/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/candidates"] });
      queryClient.invalidateQueries({ queryKey: ["/api/candidates/enriched"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] });
      toast({
        title: "הצלחה",
        description: "המועמד נמחק בהצלחה",
      });
    },
    onError: (error) => {
      if (isUnauthorizedError(error)) {
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
      toast({
        title: "שגיאה",
        description: "שגיאה במחיקת המועמד",
        variant: "destructive",
      });
    },
  });

  const bulkDeleteCandidates = useMutation({
    mutationFn: async (ids: string[]) => {
      await apiRequest("POST", "/api/candidates/bulk-delete", { candidateIds: ids });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/candidates"] });
      queryClient.invalidateQueries({ queryKey: ["/api/candidates/enriched"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] });
      setSelectedCandidates([]);
      toast({
        title: "הצלחה",
        description: "המועמדים נמחקו בהצלחה",
      });
    },
    onError: (error) => {
      if (isUnauthorizedError(error)) {
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
      toast({
        title: "שגיאה",
        description: "שגיאה במחיקת המועמדים",
        variant: "destructive",
      });
    },
  });

  const handleAddCandidate = () => {
    setSelectedCandidate(null);
    setIsFormOpen(true);
  };

  const handleEditCandidate = (candidate: Candidate) => {
    setSelectedCandidate(candidate);
    setIsFormOpen(true);
  };

  const handleDeleteCandidate = (id: string) => {
    setCandidateToDelete(id);
    setDeleteDialogOpen(true);
  };

  const handleSelectAll = () => {
    if (selectedCandidates.length === candidatesData?.candidates.length) {
      setSelectedCandidates([]);
    } else {
      setSelectedCandidates(candidatesData?.candidates.map(c => c.id) || []);
    }
  };

  const handleSelectCandidate = (id: string) => {
    setSelectedCandidates(prev => 
      prev.includes(id) ? prev.filter(cId => cId !== id) : [...prev, id]
    );
  };

  const handleBulkDelete = () => {
    if (selectedCandidates.length === 0) return;
    
    if (confirm(`האם אתה בטוח שברצונך למחוק ${selectedCandidates.length} מועמדים?`)) {
      bulkDeleteCandidates.mutate(selectedCandidates);
    }
  };

  const confirmDeleteCandidate = () => {
    if (candidateToDelete) {
      deleteCandidate.mutate(candidateToDelete);
      setDeleteDialogOpen(false);
      setCandidateToDelete(null);
    }
  };

  const cancelDeleteCandidate = () => {
    setDeleteDialogOpen(false);
    setCandidateToDelete(null);
  };


  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
          <p className="mt-4 text-lg">טוען...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  return (
    <div dir="rtl" className="min-h-screen w-full max-w-full space-y-6 p-6">
      <div className="flex items-center gap-2 mb-6">
        <Users className="h-6 w-6" />
        <h1 className="text-2xl font-bold">מועמדים</h1>
      </div>
          <div className="mb-6 flex flex-col gap-4">
            <div className="flex flex-col sm:flex-row gap-4 flex-wrap">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <Input
                  placeholder="חיפוש מועמדים..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pr-10"
                  data-testid="input-search-candidates"
                />
              </div>
              
              <div className="min-w-[200px]">
                <MultiSelect
                  options={statusOptions}
                  selected={selectedStatuses}
                  onChange={setSelectedStatuses}
                  placeholder="סטטוס"
                  data-testid="select-status-filter"
                />
              </div>

              <div className="min-w-[200px]">
                <MultiSelect
                  options={jobOptions}
                  selected={selectedJobs}
                  onChange={setSelectedJobs}
                  placeholder="שם המשרה"
                  data-testid="select-job-filter"
                />
              </div>

              <div className="min-w-[200px]">
                <MultiSelect
                  options={userOptions}
                  selected={selectedUsers}
                  onChange={setSelectedUsers}
                  placeholder="רכז"
                  data-testid="select-user-filter"
                />
              </div>

              <div className="flex gap-2 items-center min-w-[200px]">
                <Input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  placeholder="מתאריך"
                  className="text-sm"
                  data-testid="input-date-from"
                />
                <span className="text-gray-500">-</span>
                <Input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  placeholder="עד תאריך"
                  className="text-sm"
                  data-testid="input-date-to"
                />
              </div>
            </div>
            
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-3">
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
                {selectedCandidates.length > 0 && isSuperAdmin && (
                  <DeleteButton
                    onClick={handleBulkDelete}
                    className="bg-red-600 hover:bg-red-700 text-white"
                    data-testid="button-bulk-delete"
                  >
                    <Trash2 className="h-4 w-4 ml-2" />
                    מחק {selectedCandidates.length} נבחרים
                  </DeleteButton>
                )}
              </div>
              <PermissionWrapper permission="create_candidates">
              <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
                <DialogTrigger asChild>
                  <AddButton 
                    onClick={handleAddCandidate}
                    className="btn-primary"
                    data-testid="button-add-candidate"
                  >
                    <Plus className="h-4 w-4 ml-2" />
                    הוסף מועמד
                  </AddButton>
                </DialogTrigger>
                <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
                  <DialogHeader className="sr-only">
                    <DialogTitle>
                      {selectedCandidate ? "עריכת מועמד" : "הוספת מועמד חדש"}
                    </DialogTitle>
                    <DialogDescription>
                      {selectedCandidate ? "ערוך פרטי המועמד" : "הוסף מועמד חדש למאגר"}
                    </DialogDescription>
                  </DialogHeader>
                  <CandidateForm 
                    candidate={selectedCandidate || undefined}
                    onSuccess={() => {
                      // לא סוגר את הטופס - נשאר פתוח לפרטים נוספים
                      toast({
                        title: "הצלחה",
                        description: "המועמד נשמר בהצלחה. תוכל להוסיף פרטים נוספים",
                      });
                    }}
                  />
                </DialogContent>
              </Dialog>
            </PermissionWrapper>
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
                          {isSuperAdmin && (
                            <TableHead className="w-12 bg-gray-50 dark:bg-gray-900">
                              <Checkbox
                                checked={selectedCandidates.length === candidatesData?.candidates.length && candidatesData?.candidates.length > 0}
                                onCheckedChange={handleSelectAll}
                                data-testid="checkbox-select-all"
                              />
                            </TableHead>
                          )}
                          <TableHead className="text-right font-medium text-gray-700 dark:text-gray-300 sticky right-0 bg-gray-50 dark:bg-gray-900 z-10">שם המועמד</TableHead>
                          <TableHead className="text-right font-medium text-gray-700 dark:text-gray-300 whitespace-nowrap">עיר</TableHead>
                          <TableHead className="text-right font-medium text-gray-700 dark:text-gray-300 whitespace-nowrap">נייד</TableHead>
                          <TableHead className="text-right font-medium text-gray-700 dark:text-gray-300 whitespace-nowrap">סטטוס</TableHead>
                          <TableHead className="text-right font-medium text-gray-700 dark:text-gray-300 whitespace-nowrap">מס' מועמד</TableHead>
                          <TableHead className="text-right font-medium text-gray-700 dark:text-gray-300 sticky left-0 bg-gray-50 dark:bg-gray-900 z-10">פעולות</TableHead>
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
                          {isSuperAdmin && (
                            <TableCell className="w-12" onClick={(e) => e.stopPropagation()}>
                              <Checkbox
                                checked={selectedCandidates.includes(candidate.id)}
                                onCheckedChange={() => handleSelectCandidate(candidate.id)}
                                data-testid={`checkbox-candidate-${candidate.id}`}
                              />
                            </TableCell>
                          )}
                          <TableCell className="font-medium sticky right-0 bg-white dark:bg-gray-800 text-sm">
                            <p className="text-secondary dark:text-white" data-testid={`text-candidate-name-${candidate.id}`}>
                              {candidate.firstName} {candidate.lastName}
                            </p>
                          </TableCell>
                          <TableCell className="text-sm">
                            {candidate.city || "-"}
                          </TableCell>
                          <TableCell data-testid={`text-candidate-mobile-${candidate.id}`} className="text-sm">
                            {candidate.mobile || "-"}
                          </TableCell>
                          <TableCell className="text-sm">
                            <Badge className={getStatusColor(candidate.status || 'available')}>
                              {getStatusText(candidate.status || 'available', candidate.recruitmentSource)}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-sm">
                            <span className="font-mono text-gray-700 dark:text-gray-300">
                              {candidate.candidateNumber || "-"}
                            </span>
                          </TableCell>
                          <TableCell className="sticky left-0 bg-white dark:bg-gray-800">
                            <div className="flex space-x-1 space-x-reverse" onClick={(e) => e.stopPropagation()}>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setEmailDialog({
                                    isOpen: true,
                                    type: "candidate",
                                    candidateId: candidate.id,
                                    candidateName: `${candidate.firstName} ${candidate.lastName}`,
                                  });
                                }}
                                className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-200"
                                data-testid={`button-email-profile-${candidate.id}`}
                                title="שלח פרופיל במייל"
                              >
                                <Mail className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setEmailDialog({
                                    isOpen: true,
                                    type: "interview",
                                    candidateId: candidate.id,
                                    candidateName: `${candidate.firstName} ${candidate.lastName}`,
                                  });
                                }}
                                className="text-green-600 hover:text-green-800 dark:text-green-400 dark:hover:text-green-200"
                                data-testid={`button-interview-invite-${candidate.id}`}
                                title="שלח הזמנה לראיון"
                              >
                                <Send className="h-4 w-4" />
                              </Button>
                              <EditButton
                                permission="edit_candidates"
                                variant="ghost"
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleEditCandidate(candidate);
                                }}
                                className="text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200"
                                data-testid={`button-edit-candidate-${candidate.id}`}
                                hideWhenNoAccess={true}
                              >
                                <Edit className="h-4 w-4" />
                              </EditButton>
                              <DeleteButton
                                permission="delete_candidates"
                                variant="ghost"
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeleteCandidate(candidate.id);
                                }}
                                className="text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                                data-testid={`button-delete-candidate-${candidate.id}`}
                                hideWhenNoAccess={true}
                              >
                                <Trash2 className="h-4 w-4" />
                              </DeleteButton>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              ) : (
                <div className="text-center py-12">
                  <p className="text-gray-500 text-lg">לא נמצאו מועמדים</p>
                  <AddButton 
                    onClick={handleAddCandidate}
                    className="mt-4 btn-primary"
                    data-testid="button-add-first-candidate"
                    hideWhenNoAccess={true}
                  >
                    הוסף מועמד ראשון
                  </AddButton>
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

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="sm:max-w-md" dir="rtl">
          <DialogHeader>
            <DialogTitle className="text-red-600">מחיקת מועמד</DialogTitle>
            <DialogDescription className="text-gray-600">
              האם למחוק מועמד לצמיתות?
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-3 justify-end mt-6">
            <Button
              variant="outline"
              onClick={cancelDeleteCandidate}
              className="px-6"
            >
              לא
            </Button>
            <Button
              onClick={confirmDeleteCandidate}
              className="bg-red-600 hover:bg-red-700 text-white px-6"
              disabled={deleteCandidate.isPending}
            >
              {deleteCandidate.isPending ? "מוחק..." : "כן"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <EmailDialog
        isOpen={emailDialog.isOpen}
        onClose={() => setEmailDialog({ ...emailDialog, isOpen: false })}
        type={emailDialog.type}
        candidateId={emailDialog.candidateId}
        candidateIds={emailDialog.candidateIds}
        candidateName={emailDialog.candidateName}
      />
    </div>
  );
}
