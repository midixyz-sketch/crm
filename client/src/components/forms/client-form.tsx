import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { insertClientSchema, type InsertClient, type Client } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { X, Plus } from "lucide-react";
import { useState } from "react";
import { nanoid } from "nanoid";

interface ClientFormProps {
  client?: Client | null;
  onSuccess: () => void;
}

export default function ClientForm({ client, onSuccess }: ClientFormProps) {
  const { toast } = useToast();

  const form = useForm({
    resolver: zodResolver(insertClientSchema),
    defaultValues: {
      companyName: client?.companyName || "",
      contactName: "", // Legacy field - kept for backward compatibility
      email: client?.email || "", // שומר ערכים קיימים - לא מוצג בטופס
      phone: client?.phone || "", // שומר ערכים קיימים - לא מוצג בטופס
      address: client?.address || "",
      website: client?.website || "",
      industry: client?.industry || "",
      commissionRate: client?.commissionRate || undefined,
      paymentTerms: client?.paymentTerms || "",
      notes: client?.notes || "",
      contactPersons: client?.contactPersons || [],
      isActive: client?.isActive ?? true,
    },
  });

  const createClient = useMutation({
    mutationFn: async (data: InsertClient) => {
      await apiRequest("POST", "/api/clients", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clients"] });
      queryClient.invalidateQueries({ queryKey: ["/api/candidates/enriched"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] });
      toast({
        title: "הצלחה",
        description: "הלקוח נוצר בהצלחה",
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
        description: "שגיאה ביצירת הלקוח",
        variant: "destructive",
      });
    },
  });

  const updateClient = useMutation({
    mutationFn: async (data: InsertClient) => {
      await apiRequest("PUT", `/api/clients/${client!.id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clients"] });
      queryClient.invalidateQueries({ queryKey: ["/api/candidates/enriched"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] });
      toast({
        title: "הצלחה",
        description: "הלקוח עודכן בהצלחה",
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
        description: "שגיאה בעדכון הלקוח",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: InsertClient) => {
    if (client) {
      updateClient.mutate(data);
    } else {
      createClient.mutate(data);
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <FormField
          control={form.control}
          name="companyName"
          render={({ field }) => (
            <FormItem>
              <FormLabel>שם החברה *</FormLabel>
              <FormControl>
                <Input placeholder="הכנס שם החברה" {...field} data-testid="input-company-name" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="address"
          render={({ field }) => (
            <FormItem>
              <FormLabel>כתובת</FormLabel>
              <FormControl>
                <Input placeholder="כתובת החברה" {...field} value={field.value || ""} data-testid="input-address" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="website"
            render={({ field }) => (
              <FormItem>
                <FormLabel>אתר אינטרנט</FormLabel>
                <FormControl>
                  <Input placeholder="https://company.com" {...field} value={field.value || ""} data-testid="input-website" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="industry"
            render={({ field }) => (
              <FormItem>
                <FormLabel>תחום פעילות</FormLabel>
                <FormControl>
                  <Input placeholder="הייטק, פיננסים, וכו'" {...field} value={field.value || ""} data-testid="input-industry" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="commissionRate"
            render={({ field }) => (
              <FormItem>
                <FormLabel>אחוז עמלה (%)</FormLabel>
                <FormControl>
                  <Input 
                    type="number" 
                    placeholder="15"
                    {...field}
                    value={field.value || ""}
                    onChange={(e) => field.onChange(e.target.value ? parseInt(e.target.value) : undefined)}
                    data-testid="input-commission-rate"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="paymentTerms"
            render={({ field }) => (
              <FormItem>
                <FormLabel>תנאי תשלום</FormLabel>
                <FormControl>
                  <Input placeholder="שוטף+30, מראש, וכו'" {...field} value={field.value || ""} data-testid="input-payment-terms" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="notes"
          render={({ field }) => (
            <FormItem>
              <FormLabel>הערות</FormLabel>
              <FormControl>
                <Textarea 
                  placeholder="הערות נוספות על הלקוח"
                  className="min-h-[100px]"
                  {...field}
                  value={field.value || ""}
                  data-testid="textarea-notes"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="isActive"
          render={({ field }) => (
            <FormItem className="flex flex-row items-start space-x-3 space-x-reverse space-y-0">
              <FormControl>
                <Checkbox
                  checked={field.value || false}
                  onCheckedChange={field.onChange}
                  data-testid="checkbox-is-active"
                />
              </FormControl>
              <div className="space-y-1 leading-none">
                <FormLabel>לקוח פעיל</FormLabel>
              </div>
            </FormItem>
          )}
        />

        {/* Contact Persons Section */}
        <div className="border-t pt-6">
          <h3 className="text-lg font-medium mb-4">אנשי קשר (עד 20)</h3>
          
          <FormField
            control={form.control}
            name="contactPersons"
            render={({ field }) => (
              <FormItem>
                <div className="space-y-4">
                  {field.value && field.value.map((person: any, index: number) => (
                    <div key={index} className="border rounded-lg p-4 bg-gray-50">
                      <div className="flex justify-between items-start mb-3">
                        <h4 className="font-medium">איש קשר #{index + 1}</h4>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            const newPersons = field.value.filter((_: any, i: number) => i !== index);
                            field.onChange(newPersons);
                          }}
                          data-testid={`button-remove-contact-person-${index}`}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div>
                          <label className="text-sm font-medium">שם</label>
                          <Input
                            placeholder="שם מלא"
                            value={person.name || ""}
                            onChange={(e) => {
                              const newPersons = [...field.value];
                              newPersons[index] = { ...newPersons[index], name: e.target.value };
                              field.onChange(newPersons);
                            }}
                            data-testid={`input-contact-name-${index}`}
                          />
                        </div>
                        
                        <div>
                          <label className="text-sm font-medium">תפקיד</label>
                          <Input
                            placeholder="תפקיד"
                            value={person.title || ""}
                            onChange={(e) => {
                              const newPersons = [...field.value];
                              newPersons[index] = { ...newPersons[index], title: e.target.value };
                              field.onChange(newPersons);
                            }}
                            data-testid={`input-contact-title-${index}`}
                          />
                        </div>
                        
                        <div>
                          <label className="text-sm font-medium">מייל *</label>
                          <Input
                            type="email"
                            placeholder="email@example.com"
                            value={person.email || ""}
                            onChange={(e) => {
                              const newPersons = [...field.value];
                              newPersons[index] = { ...newPersons[index], email: e.target.value };
                              field.onChange(newPersons);
                            }}
                            data-testid={`input-contact-email-${index}`}
                          />
                        </div>
                        
                        <div>
                          <label className="text-sm font-medium">טלפון נייד</label>
                          <Input
                            placeholder="05X-XXXXXXX"
                            value={person.mobile || ""}
                            onChange={(e) => {
                              const newPersons = [...field.value];
                              newPersons[index] = { ...newPersons[index], mobile: e.target.value };
                              field.onChange(newPersons);
                            }}
                            data-testid={`input-contact-mobile-${index}`}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                  
                  {(!field.value || field.value.length < 20) && (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        const newPerson = { id: nanoid(), name: "", title: "", email: "", mobile: "" };
                        field.onChange([...(field.value || []), newPerson]);
                      }}
                      data-testid="button-add-contact-person"
                      className="w-full"
                    >
                      <Plus className="h-4 w-4 ml-2" />
                      הוסף איש קשר
                    </Button>
                  )}
                </div>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="flex justify-end space-x-4 space-x-reverse">
          <Button 
            type="button" 
            variant="outline" 
            onClick={onSuccess}
            data-testid="button-cancel"
          >
            ביטול
          </Button>
          <Button 
            type="submit" 
            className="btn-primary"
            disabled={createClient.isPending || updateClient.isPending}
            data-testid="button-save-client"
          >
            {createClient.isPending || updateClient.isPending ? "שומר..." : client ? "עדכן" : "שמור"}
          </Button>
        </div>
      </form>
    </Form>
  );
}
