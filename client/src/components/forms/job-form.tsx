import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { insertJobSchema, type InsertJob, type JobWithClient, type Client } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useState } from "react";
import { X } from "lucide-react";

interface JobFormProps {
  job?: JobWithClient | null;
  onSuccess: () => void;
}

export default function JobForm({ job, onSuccess }: JobFormProps) {
  const { toast } = useToast();
  const [additionalCodesInput, setAdditionalCodesInput] = useState("");

  const { data: clientsData } = useQuery<{ clients: Client[]; total: number }>({
    queryKey: ["/api/clients"],
  });

  const form = useForm({
    resolver: zodResolver(insertJobSchema),
    defaultValues: {
      title: job?.title || "",
      description: job?.description || "",
      requirements: job?.requirements || "",
      location: job?.location || "",
      salaryRange: job?.salaryRange || "",
      jobType: job?.jobType || "",
      status: job?.status || "active",
      clientId: job?.clientId || "",
      positions: job?.positions || 1,
      additionalCodes: job?.additionalCodes || [],
      selectedContactPersonIds: job?.selectedContactPersonIds || [],
      isUrgent: job?.isUrgent || false,
      autoSendToClient: job?.autoSendToClient || false,
    },
  });

  // Get the selected client's contact persons
  const selectedClientId = form.watch("clientId");
  const selectedClient = clientsData?.clients.find(c => c.id === selectedClientId);
  const contactPersons = selectedClient?.contactPersons || [];
  
  // DEBUG: Log to help diagnose contact person display issue
  console.log('🔍 DEBUG - Job Form Contact Persons:');
  console.log('Total clients loaded:', clientsData?.clients?.length);
  console.log('Selected client ID:', selectedClientId);
  console.log('Selected client:', selectedClient);
  console.log('Contact persons array:', contactPersons);
  console.log('Number of contact persons:', contactPersons.length);

  const createJob = useMutation({
    mutationFn: async (data: InsertJob) => {
      await apiRequest("POST", "/api/jobs", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/jobs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/candidates/enriched"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] });
      toast({
        title: "הצלחה",
        description: "המשרה נוצרה בהצלחה",
      });
      onSuccess();
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
        description: "שגיאה ביצירת המשרה",
        variant: "destructive",
      });
    },
  });

  const updateJob = useMutation({
    mutationFn: async (data: InsertJob) => {
      await apiRequest("PUT", `/api/jobs/${job!.id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/jobs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/candidates/enriched"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] });
      toast({
        title: "הצלחה",
        description: "המשרה עודכנה בהצלחה",
      });
      onSuccess();
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
        description: "שגיאה בעדכון המשרה",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: any) => {
    const submitData = {
      ...data,
      requirements: data.requirements || null,
      location: data.location || null,
      salaryRange: data.salaryRange || null,
      jobType: data.jobType || null,
      additionalCodes: data.additionalCodes || [],
      selectedContactPersonIds: data.selectedContactPersonIds || [],
      isUrgent: data.isUrgent || false,
      autoSendToClient: data.autoSendToClient || false,
    };

    if (job) {
      updateJob.mutate(submitData);
    } else {
      createJob.mutate(submitData);
    }
  };

  return (
    <div className="bg-gray-50 min-h-screen" dir="rtl">
      <div className="max-w-4xl mx-auto pt-8 pb-12">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">{job ? "עריכת משרה" : "פרסום משרה חדשה"}</h1>
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
            {/* פרטי משרה */}
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-6">פרטי משרה</h2>

              <div className="space-y-6">
                <FormField
                  control={form.control}
                  name="title"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-right">שם המשרה:</FormLabel>
                      <FormControl>
                        <Input {...field} data-testid="input-job-title" className="text-right" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="clientId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-right">לקוח:</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-client" className="text-right">
                            <SelectValue placeholder="" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {clientsData?.clients?.map((client: Client) => (
                            <SelectItem key={client.id} value={client.id}>
                              {client.companyName}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="jobType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-right">סוג משרה:</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-job-type" className="text-right">
                            <SelectValue placeholder="" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="full-time">משרה מלאה</SelectItem>
                          <SelectItem value="part-time">משרה חלקית</SelectItem>
                          <SelectItem value="contract">חוזה</SelectItem>
                          <SelectItem value="freelance">פרילנס</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="positions"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-right">מספר משרות:</FormLabel>
                      <FormControl>
                        <Input 
                          type="number" 
                          min="1"
                          {...field}
                          onChange={(e) => field.onChange(e.target.value ? parseInt(e.target.value) : 1)}
                          data-testid="input-positions"
                          className="text-right"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="additionalCodes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-right">קודים נוספים (אופציונלי):</FormLabel>
                      <FormControl>
                        <div className="space-y-2">
                          <div className="flex gap-2">
                            <Input
                              value={additionalCodesInput}
                              onChange={(e) => setAdditionalCodesInput(e.target.value)}
                              placeholder="הקלד קוד נוסף"
                              className="text-right"
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' && additionalCodesInput.trim()) {
                                  e.preventDefault();
                                  const currentCodes = field.value || [];
                                  if (!currentCodes.includes(additionalCodesInput.trim())) {
                                    field.onChange([...currentCodes, additionalCodesInput.trim()]);
                                    setAdditionalCodesInput("");
                                  }
                                }
                              }}
                            />
                            <Button
                              type="button"
                              variant="outline"
                              onClick={() => {
                                if (additionalCodesInput.trim()) {
                                  const currentCodes = field.value || [];
                                  if (!currentCodes.includes(additionalCodesInput.trim())) {
                                    field.onChange([...currentCodes, additionalCodesInput.trim()]);
                                    setAdditionalCodesInput("");
                                  }
                                }
                              }}
                            >
                              הוסף
                            </Button>
                          </div>
                          {field.value && field.value.length > 0 && (
                            <div className="flex flex-wrap gap-2">
                              {field.value.map((code: string, index: number) => (
                                <div key={index} className="flex items-center gap-1 bg-blue-100 text-blue-800 px-2 py-1 rounded text-sm">
                                  <span>{code}</span>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const newCodes = field.value.filter((_: string, i: number) => i !== index);
                                      field.onChange(newCodes);
                                    }}
                                    className="text-blue-600 hover:text-blue-800"
                                  >
                                    <X size={14} />
                                  </button>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-right">*תיאור:</FormLabel>
                      <FormControl>
                        <Textarea 
                          {...field}
                          data-testid="textarea-job-description"
                          className="min-h-[120px] text-right"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="requirements"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-right">דרישות:</FormLabel>
                      <FormControl>
                        <Textarea 
                          {...field}
                          data-testid="textarea-job-requirements"
                          className="min-h-[120px] text-right"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="selectedContactPersonIds"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-right">אנשי קשר (מינימום 1):</FormLabel>
                      <FormControl>
                        <div className="space-y-3">
                          {!selectedClientId ? (
                            <p className="text-sm text-gray-500 text-right">נא לבחור לקוח תחילה</p>
                          ) : contactPersons.length === 0 ? (
                            <p className="text-sm text-amber-600 text-right">ללקוח זה אין אנשי קשר. נא להוסיף אנשי קשר בדף הלקוח.</p>
                          ) : (
                            <div className="border rounded-lg p-4 bg-white space-y-2">
                              <p className="text-sm text-gray-600 mb-2">בחר אנשי קשר שיקבלו מועמדים:</p>
                              {contactPersons.map((person: any, index: number) => {
                                const isSelected = field.value?.includes(person.id);
                                return (
                                  <div 
                                    key={person.id} 
                                    className="flex items-center space-x-2 space-x-reverse p-2 hover:bg-gray-50 rounded"
                                    data-testid={`contact-person-${index}`}
                                  >
                                    <Checkbox
                                      checked={isSelected}
                                      onCheckedChange={(checked) => {
                                        if (checked) {
                                          field.onChange([...(field.value || []), person.id]);
                                        } else {
                                          field.onChange(field.value?.filter((id: string) => id !== person.id) || []);
                                        }
                                      }}
                                      data-testid={`checkbox-contact-person-${index}`}
                                    />
                                    <div className="flex-1 text-right">
                                      <div className="text-sm font-medium">
                                        {person.name || "ללא שם"} 
                                        {person.title && <span className="text-gray-500"> ({person.title})</span>}
                                      </div>
                                      <div className="text-xs text-gray-600">
                                        {person.email}
                                        {person.mobile && <span className="mr-2">• {person.mobile}</span>}
                                      </div>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="flex gap-6">
                  <FormField
                    control={form.control}
                    name="isUrgent"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center space-x-3 space-x-reverse space-y-0">
                        <FormControl>
                          <Checkbox
                            checked={field.value}
                            onCheckedChange={field.onChange}
                            data-testid="checkbox-is-urgent"
                          />
                        </FormControl>
                        <div className="space-y-1 leading-none">
                          <FormLabel>משרה דחופה (יופיע בראש הרשימות מובלט בצבע ירוק)</FormLabel>
                        </div>
                      </FormItem>
                    )}
                  />
                </div>

                <div className="flex gap-6">
                  <FormField
                    control={form.control}
                    name="autoSendToClient"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center space-x-3 space-x-reverse space-y-0">
                        <FormControl>
                          <Checkbox
                            checked={field.value}
                            onCheckedChange={field.onChange}
                            data-testid="checkbox-auto-send"
                          />
                        </FormControl>
                        <div className="space-y-1 leading-none">
                          <FormLabel className="font-bold text-orange-600">שליחה אוטומטית ללקוח ללא סינון ידני</FormLabel>
                          <p className="text-xs text-gray-500">כל מועמד חדש (מייבוא, מייל, דף נחיתה) יישלח אוטומטית ללקוח</p>
                        </div>
                      </FormItem>
                    )}
                  />
                </div>

              </div>
            </div>

            {/* פרטים אדמיניסטרטיביים */}
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-6">פרטים אדמיניסטרטיביים</h2>

              <div className="space-y-6">
                <FormField
                  control={form.control}
                  name="status"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-right">סטטוס:</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-job-status" className="text-right">
                            <SelectValue placeholder="בחר סטטוס" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="active">פעילה</SelectItem>
                          <SelectItem value="paused">מושהית</SelectItem>
                          <SelectItem value="closed">סגורה</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="salaryRange"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-right">טווח שכר:</FormLabel>
                      <FormControl>
                        <Input 
                          {...field}
                          data-testid="input-salary-range"
                          className="text-right"
                          placeholder="לדוגמה: 10,000-15,000 ₪"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="location"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-right">מיקום:</FormLabel>
                      <FormControl>
                        <Input 
                          {...field}
                          data-testid="input-location"
                          className="text-right"
                          placeholder="לדוגמה: תל אביב, חיפה"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

              </div>
            </div>

            {/* כפתור שמירה */}
            <div className="flex justify-center">
              <Button 
                type="submit" 
                className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-2 rounded-lg"
                disabled={createJob.isPending || updateJob.isPending}
                data-testid="button-save-job"
              >
                {createJob.isPending || updateJob.isPending ? "שומר..." : job ? "עדכן משרה" : "צור משרה חדשה"}
              </Button>
            </div>
          </form>
        </Form>
      </div>
    </div>
  );
}
