import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { BarChart3, Users, Activity, Filter } from "lucide-react";
import { format, subDays } from "date-fns";

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#82CA9D', '#FFC658', '#FF6B9D'];

export default function ReportsPage() {
  // מועמדים לפי זמן ומקור גיוס - סינונים
  const [candidatesStartDate, setCandidatesStartDate] = useState(format(subDays(new Date(), 30), 'yyyy-MM-dd'));
  const [candidatesEndDate, setCandidatesEndDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [selectedRecruitmentSource, setSelectedRecruitmentSource] = useState<string>('all');
  
  // פעילות רכזים - סינונים
  const [recruitersStartDate, setRecruitersStartDate] = useState(format(subDays(new Date(), 30), 'yyyy-MM-dd'));
  const [recruitersEndDate, setRecruitersEndDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [selectedAction, setSelectedAction] = useState<string>('all');
  
  // דוח אישי - סינונים
  const [selectedRecruiter, setSelectedRecruiter] = useState<string>('');
  const [personalStartDate, setPersonalStartDate] = useState(format(subDays(new Date(), 30), 'yyyy-MM-dd'));
  const [personalEndDate, setPersonalEndDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [personalAction, setPersonalAction] = useState<string>('all');

  // שאילתות לנתונים
  const { data: candidatesData, isLoading: loadingCandidates } = useQuery<any>({
    queryKey: ['/api/reports/candidates-by-time', { 
      startDate: candidatesStartDate, 
      endDate: candidatesEndDate,
      recruitmentSource: selectedRecruitmentSource 
    }],
  });

  const { data: recruitersData, isLoading: loadingRecruiters } = useQuery<any>({
    queryKey: ['/api/reports/recruiter-activity', { 
      startDate: recruitersStartDate, 
      endDate: recruitersEndDate,
      action: selectedAction 
    }],
  });

  const { data: personalData, isLoading: loadingPersonal } = useQuery<any>({
    queryKey: [`/api/reports/recruiter-activity/${selectedRecruiter}`, { 
      startDate: personalStartDate, 
      endDate: personalEndDate,
      action: personalAction 
    }],
    enabled: !!selectedRecruiter,
  });

  return (
    <div className="container mx-auto p-6" dir="rtl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <BarChart3 className="w-8 h-8" />
          דוחות ואנליטיקה
        </h1>
        <p className="text-muted-foreground mt-2">
          סטטיסטיקות ודוחות מפורטים על מועמדים ופעילות רכזים
        </p>
      </div>

      <Tabs defaultValue="candidates" className="space-y-6">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="candidates" data-testid="tab-candidates">
            <Users className="w-4 h-4 ml-2" />
            מועמדים
          </TabsTrigger>
          <TabsTrigger value="recruiters" data-testid="tab-recruiters">
            <Activity className="w-4 h-4 ml-2" />
            פעילות רכזים
          </TabsTrigger>
          <TabsTrigger value="personal" data-testid="tab-personal">
            <BarChart3 className="w-4 h-4 ml-2" />
            דוח אישי לרכז
          </TabsTrigger>
        </TabsList>

        {/* Tab 1: מועמדים לפי זמן ומקור גיוס */}
        <TabsContent value="candidates" className="space-y-6">
          {/* פילטרים */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Filter className="w-5 h-5" />
                סינון נתונים
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="candidates-start-date">תאריך התחלה</Label>
                  <Input
                    id="candidates-start-date"
                    type="date"
                    value={candidatesStartDate}
                    onChange={(e) => setCandidatesStartDate(e.target.value)}
                    data-testid="input-candidates-start-date"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="candidates-end-date">תאריך סיום</Label>
                  <Input
                    id="candidates-end-date"
                    type="date"
                    value={candidatesEndDate}
                    onChange={(e) => setCandidatesEndDate(e.target.value)}
                    data-testid="input-candidates-end-date"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="recruitment-source">מקור גיוס</Label>
                  <Select value={selectedRecruitmentSource} onValueChange={setSelectedRecruitmentSource}>
                    <SelectTrigger id="recruitment-source" data-testid="select-recruitment-source">
                      <SelectValue placeholder="כל המקורות" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">כל המקורות</SelectItem>
                      {candidatesData?.availableSources?.map((source: string) => (
                        <SelectItem key={source} value={source}>
                          {source}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* סטטיסטיקה כללית */}
          <Card>
            <CardHeader>
              <CardTitle>סיכום כללי</CardTitle>
              <CardDescription>סך הכל מועמדים בתקופה שנבחרה</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-4xl font-bold text-primary" data-testid="text-total-candidates">
                {loadingCandidates ? '...' : candidatesData?.total || 0}
              </div>
              <p className="text-sm text-muted-foreground mt-2">מועמדים</p>
            </CardContent>
          </Card>

          {/* גרף מועמדים לפי זמן */}
          <Card>
            <CardHeader>
              <CardTitle>מועמדים לפי תאריך</CardTitle>
              <CardDescription>מספר מועמדים חדשים לפי יום</CardDescription>
            </CardHeader>
            <CardContent>
              {loadingCandidates ? (
                <div className="h-[300px] flex items-center justify-center">טוען...</div>
              ) : (
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={candidatesData?.byDate || []}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Line type="monotone" dataKey="count" stroke="#8884d8" strokeWidth={2} name="מועמדים" />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          {/* גרף מועמדים לפי מקור גיוס */}
          <Card>
            <CardHeader>
              <CardTitle>מועמדים לפי מקור גיוס</CardTitle>
              <CardDescription>התפלגות מועמדים לפי מקור</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col md:flex-row gap-6">
              <div className="flex-1">
                {loadingCandidates ? (
                  <div className="h-[300px] flex items-center justify-center">טוען...</div>
                ) : (
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={candidatesData?.bySource || []}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={(entry) => `${entry.source}: ${entry.count}`}
                        outerRadius={100}
                        fill="#8884d8"
                        dataKey="count"
                      >
                        {candidatesData?.bySource?.map((_: any, index: number) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </div>
              <div className="flex-1">
                {loadingCandidates ? (
                  <div className="h-[300px] flex items-center justify-center">טוען...</div>
                ) : (
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={candidatesData?.bySource || []}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="source" />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="count" fill="#82ca9d" name="מועמדים" />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 2: פעילות רכזים */}
        <TabsContent value="recruiters" className="space-y-6">
          {/* פילטרים */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Filter className="w-5 h-5" />
                סינון נתונים
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="recruiters-start-date">תאריך התחלה</Label>
                  <Input
                    id="recruiters-start-date"
                    type="date"
                    value={recruitersStartDate}
                    onChange={(e) => setRecruitersStartDate(e.target.value)}
                    data-testid="input-recruiters-start-date"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="recruiters-end-date">תאריך סיום</Label>
                  <Input
                    id="recruiters-end-date"
                    type="date"
                    value={recruitersEndDate}
                    onChange={(e) => setRecruitersEndDate(e.target.value)}
                    data-testid="input-recruiters-end-date"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="action-filter">סוג פעולה</Label>
                  <Select value={selectedAction} onValueChange={setSelectedAction}>
                    <SelectTrigger id="action-filter" data-testid="select-action-filter">
                      <SelectValue placeholder="כל הפעולות" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">כל הפעולות</SelectItem>
                      {recruitersData?.availableActions?.map((action: string) => (
                        <SelectItem key={action} value={action}>
                          {action}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* סטטיסטיקה כללית */}
          <Card>
            <CardHeader>
              <CardTitle>סיכום כללי</CardTitle>
              <CardDescription>סך הכל פעולות בתקופה שנבחרה</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-4xl font-bold text-primary" data-testid="text-total-activities">
                {loadingRecruiters ? '...' : recruitersData?.totalActivities || 0}
              </div>
              <p className="text-sm text-muted-foreground mt-2">פעולות</p>
            </CardContent>
          </Card>

          {/* טבלת פעילות רכזים */}
          <Card>
            <CardHeader>
              <CardTitle>פעילות לפי רכז</CardTitle>
              <CardDescription>מספר פעולות שכל רכז ביצע</CardDescription>
            </CardHeader>
            <CardContent>
              {loadingRecruiters ? (
                <div className="text-center py-8">טוען...</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-right">שם הרכז</TableHead>
                      <TableHead className="text-right">אימייל</TableHead>
                      <TableHead className="text-right">סה"כ פעולות</TableHead>
                      <TableHead className="text-right">פירוט פעולות</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {recruitersData?.recruiterActivity?.map((recruiter: any) => (
                      <TableRow key={recruiter.userId} data-testid={`row-recruiter-${recruiter.userId}`}>
                        <TableCell className="font-medium">{recruiter.userName}</TableCell>
                        <TableCell className="text-muted-foreground">{recruiter.userEmail}</TableCell>
                        <TableCell>
                          <span className="font-bold text-lg">{recruiter.totalActions}</span>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-2">
                            {Object.entries(recruiter.actionBreakdown).map(([action, count]: [string, any]) => (
                              <span key={action} className="text-xs bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded">
                                {action}: {count}
                              </span>
                            ))}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                    {(!recruitersData?.recruiterActivity || recruitersData.recruiterActivity.length === 0) && (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                          לא נמצאה פעילות בתקופה שנבחרה
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          {/* גרף עמודות פעילות רכזים */}
          <Card>
            <CardHeader>
              <CardTitle>השוואת רכזים</CardTitle>
              <CardDescription>סה"כ פעולות לפי רכז</CardDescription>
            </CardHeader>
            <CardContent>
              {loadingRecruiters ? (
                <div className="h-[300px] flex items-center justify-center">טוען...</div>
              ) : (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={recruitersData?.recruiterActivity || []}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="userName" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="totalActions" fill="#8884d8" name="סה״כ פעולות" />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 3: דוח אישי לרכז */}
        <TabsContent value="personal" className="space-y-6">
          {/* בחירת רכז ופילטרים */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Filter className="w-5 h-5" />
                בחירת רכז וסינון
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="recruiter-select">בחר רכז</Label>
                  <Select value={selectedRecruiter} onValueChange={setSelectedRecruiter}>
                    <SelectTrigger id="recruiter-select" data-testid="select-recruiter">
                      <SelectValue placeholder="בחר רכז..." />
                    </SelectTrigger>
                    <SelectContent>
                      {recruitersData?.recruiterActivity?.map((recruiter: any) => (
                        <SelectItem key={recruiter.userId} value={recruiter.userId}>
                          {recruiter.userName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="personal-start-date">תאריך התחלה</Label>
                  <Input
                    id="personal-start-date"
                    type="date"
                    value={personalStartDate}
                    onChange={(e) => setPersonalStartDate(e.target.value)}
                    data-testid="input-personal-start-date"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="personal-end-date">תאריך סיום</Label>
                  <Input
                    id="personal-end-date"
                    type="date"
                    value={personalEndDate}
                    onChange={(e) => setPersonalEndDate(e.target.value)}
                    data-testid="input-personal-end-date"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="personal-action">סוג פעולה</Label>
                  <Select value={personalAction} onValueChange={setPersonalAction}>
                    <SelectTrigger id="personal-action" data-testid="select-personal-action">
                      <SelectValue placeholder="כל הפעולות" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">כל הפעולות</SelectItem>
                      {personalData?.availableActions?.map((action: string) => (
                        <SelectItem key={action} value={action}>
                          {action}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          {selectedRecruiter ? (
            <>
              {/* פרטי הרכז */}
              <Card>
                <CardHeader>
                  <CardTitle>{personalData?.userName}</CardTitle>
                  <CardDescription>{personalData?.userEmail}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-4xl font-bold text-primary" data-testid="text-personal-total">
                    {loadingPersonal ? '...' : personalData?.totalActivities || 0}
                  </div>
                  <p className="text-sm text-muted-foreground mt-2">פעולות בתקופה שנבחרה</p>
                </CardContent>
              </Card>

              {/* גרף פעילות לפי ימים */}
              <Card>
                <CardHeader>
                  <CardTitle>פעילות לפי יום</CardTitle>
                  <CardDescription>מעקב יומיומי אחר פעילות הרכז</CardDescription>
                </CardHeader>
                <CardContent>
                  {loadingPersonal ? (
                    <div className="h-[300px] flex items-center justify-center">טוען...</div>
                  ) : (
                    <ResponsiveContainer width="100%" height={300}>
                      <LineChart data={personalData?.activityByDate || []}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="date" />
                        <YAxis />
                        <Tooltip />
                        <Legend />
                        <Line type="monotone" dataKey="totalActions" stroke="#82ca9d" strokeWidth={2} name="סה״כ פעולות" />
                      </LineChart>
                    </ResponsiveContainer>
                  )}
                </CardContent>
              </Card>

              {/* גרף עמודות לפי סוג פעולה */}
              <Card>
                <CardHeader>
                  <CardTitle>פעילות לפי סוג פעולה</CardTitle>
                  <CardDescription>התפלגות פעולות לפי יום וסוג</CardDescription>
                </CardHeader>
                <CardContent>
                  {loadingPersonal ? (
                    <div className="h-[400px] flex items-center justify-center">טוען...</div>
                  ) : (
                    <ResponsiveContainer width="100%" height={400}>
                      <BarChart data={personalData?.activityByDate || []}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="date" />
                        <YAxis />
                        <Tooltip />
                        <Legend />
                        {personalData?.availableActions?.map((action: string, index: number) => (
                          <Bar 
                            key={action} 
                            dataKey={`actionBreakdown.${action}`} 
                            stackId="a" 
                            fill={COLORS[index % COLORS.length]} 
                            name={action}
                          />
                        ))}
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </CardContent>
              </Card>
            </>
          ) : (
            <Card>
              <CardContent className="py-12">
                <div className="text-center text-muted-foreground">
                  <Users className="w-16 h-16 mx-auto mb-4 opacity-50" />
                  <p className="text-lg font-medium">בחר רכז כדי לראות את הדוח האישי</p>
                  <p className="text-sm mt-2">השתמש בתפריט למעלה כדי לבחור רכז</p>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
