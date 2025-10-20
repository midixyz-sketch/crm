import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Mail, Send, Inbox, Users, Plus, X, Settings, CheckCircle, XCircle, Trash2 } from "lucide-react";

export default function SystemSettings() {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  
  // Email settings
  const [outgoingEmail, setOutgoingEmail] = useState({
    smtpHost: '',
    smtpPort: '587',
    smtpSecure: false,
    emailUser: '',
    emailPass: '',
  });

  const [incomingEmail, setIncomingEmail] = useState({
    imapHost: '',
    imapPort: '993',
    imapSecure: true,
    emailUser: '',
    emailPass: '',
  });

  // Recruitment sources
  const [recruitmentSources, setRecruitmentSources] = useState<string[]>([
    'LinkedIn',
    'JobBoard.com',
    'המלצות',
    'פרסום בפייסבוק',
    'אתר החברה'
  ]);
  const [newSource, setNewSource] = useState('');

  // Candidate statuses
  const [candidateStatuses, setCandidateStatuses] = useState<Array<{id: string, key: string, name: string, color: string, isSystem?: boolean, displayOrder?: number}>>([]);
  const [newStatusName, setNewStatusName] = useState('');
  const [selectedStatusColor, setSelectedStatusColor] = useState('bg-blue-100 text-blue-800');
  const [editingStatusId, setEditingStatusId] = useState<string | null>(null);
  const [editingStatusName, setEditingStatusName] = useState('');
  const [editingStatusColor, setEditingStatusColor] = useState('');

  // Load candidate statuses on component mount
  useEffect(() => {
    loadCandidateStatuses();
  }, []);

  const loadCandidateStatuses = async () => {
    try {
      const response = await fetch('/api/candidate-statuses');
      if (response.ok) {
        const statuses = await response.json();
        setCandidateStatuses(statuses);
      }
    } catch (error) {
      console.error('Error loading candidate statuses:', error);
    }
  };

  const handleSaveOutgoing = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setConnectionStatus('testing');

    try {
      const response = await fetch('/api/email/configure-outgoing', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(outgoingEmail),
      });

      if (response.ok) {
        setConnectionStatus('success');
        toast({
          title: "הגדרות מיילים יוצאים נשמרו",
          description: "ההגדרות נשמרו בהצלחה והחיבור נבדק",
        });
      } else {
        throw new Error('Failed to save outgoing email settings');
      }
    } catch (error) {
      setConnectionStatus('error');
      toast({
        title: "שגיאה",
        description: "לא ניתן לשמור את הגדרות המיילים היוצאים",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveIncoming = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const response = await fetch('/api/email/configure-incoming', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(incomingEmail),
      });

      if (response.ok) {
        toast({
          title: "הגדרות מיילים נכנסים נשמרו",
          description: "ההגדרות נשמרו בהצלחה",
        });
      } else {
        throw new Error('Failed to save incoming email settings');
      }
    } catch (error) {
      toast({
        title: "שגיאה",
        description: "לא ניתן לשמור את הגדרות המיילים הנכנסים",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const testOutgoingConnection = async () => {
    setConnectionStatus('testing');
    
    try {
      const response = await fetch('/api/email/test-outgoing', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(outgoingEmail),
      });

      if (response.ok) {
        setConnectionStatus('success');
        toast({
          title: "חיבור יוצא תקין",
          description: "החיבור לשרת SMTP פועל כראוי",
        });
      } else {
        throw new Error('Outgoing connection test failed');
      }
    } catch (error) {
      setConnectionStatus('error');
      toast({
        title: "בעיית חיבור יוצא",
        description: "לא ניתן להתחבר לשרת SMTP",
        variant: "destructive",
      });
    }
  };

  const testIncomingConnection = async () => {
    try {
      const response = await fetch('/api/email/test-incoming', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(incomingEmail),
      });

      if (response.ok) {
        toast({
          title: "חיבור נכנס תקין",
          description: "החיבור לשרת IMAP פועל כראוי",
        });
      } else {
        throw new Error('Incoming connection test failed');
      }
    } catch (error) {
      toast({
        title: "בעיית חיבור נכנס",
        description: "לא ניתן להתחבר לשרת IMAP",
        variant: "destructive",
      });
    }
  };

  const addRecruitmentSource = () => {
    if (newSource.trim() && !recruitmentSources.includes(newSource.trim())) {
      setRecruitmentSources([...recruitmentSources, newSource.trim()]);
      setNewSource('');
      toast({
        title: "מקור גיוס נוסף",
        description: `המקור "${newSource}" נוסף בהצלחה`,
      });
    }
  };

  const removeRecruitmentSource = (source: string) => {
    setRecruitmentSources(recruitmentSources.filter(s => s !== source));
    toast({
      title: "מקור גיוס הוסר",
      description: `המקור "${source}" הוסר בהצלחה`,
    });
  };

  const saveRecruitmentSources = async () => {
    try {
      const response = await fetch('/api/settings/recruitment-sources', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ sources: recruitmentSources }),
      });

      if (response.ok) {
        toast({
          title: "מקורות גיוס נשמרו",
          description: "רשימת מקורות הגיוס עודכנה בהצלחה",
        });
      }
    } catch (error) {
      toast({
        title: "שגיאה",
        description: "לא ניתן לשמור את מקורות הגיוס",
        variant: "destructive",
      });
    }
  };

  const addCandidateStatus = async () => {
    if (newStatusName.trim() && !candidateStatuses.find(s => s.name === newStatusName.trim())) {
      try {
        const response = await fetch('/api/candidate-statuses', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            key: newStatusName.trim().toLowerCase().replace(/\s+/g, '_'),
            name: newStatusName.trim(),
            color: selectedStatusColor,
            isSystem: false,
            displayOrder: candidateStatuses.length + 1
          }),
        });

        if (response.ok) {
          setNewStatusName('');
          await loadCandidateStatuses();
          toast({
            title: "סטטוס מועמד נוסף",
            description: `הסטטוס "${newStatusName}" נוסף בהצלחה`,
          });
        } else {
          throw new Error('Failed to add status');
        }
      } catch (error) {
        toast({
          title: "שגיאה",
          description: "לא ניתן להוסיף את הסטטוס",
          variant: "destructive",
        });
      }
    }
  };

  const removeCandidateStatus = async (statusId: string) => {
    const status = candidateStatuses.find(s => s.id === statusId);
    
    if (!status) return;

    if (status.isSystem) {
      toast({
        title: "לא ניתן למחוק",
        description: "לא ניתן למחוק סטטוס מערכת",
        variant: "destructive",
      });
      return;
    }
    
    try {
      const response = await fetch(`/api/candidate-statuses/${statusId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        await loadCandidateStatuses();
        toast({
          title: "סטטוס מועמד הוסר",
          description: `הסטטוס "${status.name}" הוסר בהצלחה`,
        });
      } else {
        const error = await response.json();
        throw new Error(error.error || 'Failed to delete status');
      }
    } catch (error: any) {
      toast({
        title: "שגיאה",
        description: error.message || "לא ניתן למחוק את הסטטוס",
        variant: "destructive",
      });
    }
  };

  const startEditingStatus = (status: {id: string, name: string, color: string}) => {
    setEditingStatusId(status.id);
    setEditingStatusName(status.name);
    setEditingStatusColor(status.color);
  };

  const cancelEditingStatus = () => {
    setEditingStatusId(null);
    setEditingStatusName('');
    setEditingStatusColor('');
  };

  const saveStatusEdit = async () => {
    if (!editingStatusId || !editingStatusName.trim()) return;

    const status = candidateStatuses.find(s => s.id === editingStatusId);
    if (!status) return;

    try {
      const response = await fetch(`/api/candidate-statuses/${editingStatusId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          key: status.key,
          name: editingStatusName.trim(),
          color: editingStatusColor,
          isSystem: status.isSystem,
          displayOrder: status.displayOrder
        }),
      });

      if (response.ok) {
        await loadCandidateStatuses();
        cancelEditingStatus();
        toast({
          title: "סטטוס עודכן",
          description: `הסטטוס "${editingStatusName}" עודכן בהצלחה`,
        });
      } else {
        throw new Error('Failed to update status');
      }
    } catch (error) {
      toast({
        title: "שגיאה",
        description: "לא ניתן לעדכן את הסטטוס",
        variant: "destructive",
      });
    }
  };


  const getStatusIcon = () => {
    switch (connectionStatus) {
      case 'testing':
        return <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600" />;
      case 'success':
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'error':
        return <XCircle className="h-4 w-4 text-red-600" />;
      default:
        return null;
    }
  };

  return (
    <div dir="rtl" className="space-y-6">
        
        <main className="flex-1 p-6 overflow-y-auto bg-background-light">
          <div className="max-w-4xl mx-auto">
            
            <Tabs defaultValue="outgoing" className="space-y-6">
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="outgoing" className="flex items-center gap-2">
                  <Send className="w-4 h-4" />
                  מיילים יוצאים
                </TabsTrigger>
                <TabsTrigger value="incoming" className="flex items-center gap-2">
                  <Inbox className="w-4 h-4" />
                  מיילים נכנסים
                </TabsTrigger>
                <TabsTrigger value="sources" className="flex items-center gap-2">
                  <Users className="w-4 h-4" />
                  מקורות גיוס
                </TabsTrigger>
                <TabsTrigger value="statuses" className="flex items-center gap-2">
                  <Settings className="w-4 h-4" />
                  סטטוסי מועמדים
                </TabsTrigger>
              </TabsList>

              {/* Outgoing Email Settings */}
              <TabsContent value="outgoing" className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Send className="w-5 h-5" />
                      הגדרות מיילים יוצאים (SMTP)
                      {getStatusIcon()}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <form onSubmit={handleSaveOutgoing} className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label htmlFor="outgoing-host">שרת SMTP</Label>
                          <Input
                            id="outgoing-host"
                            type="text"
                            placeholder="mail.yourdomain.com"
                            value={outgoingEmail.smtpHost}
                            onChange={(e) => setOutgoingEmail(prev => ({ ...prev, smtpHost: e.target.value }))}
                            required
                          />
                        </div>
                        <div>
                          <Label htmlFor="outgoing-port">פורט SMTP</Label>
                          <Input
                            id="outgoing-port"
                            type="number"
                            value={outgoingEmail.smtpPort}
                            onChange={(e) => setOutgoingEmail(prev => ({ ...prev, smtpPort: e.target.value }))}
                            required
                          />
                        </div>
                      </div>

                      <div>
                        <Label htmlFor="outgoing-user">כתובת מייל</Label>
                        <Input
                          id="outgoing-user"
                          type="email"
                          placeholder="your-email@yourdomain.com"
                          value={outgoingEmail.emailUser}
                          onChange={(e) => setOutgoingEmail(prev => ({ ...prev, emailUser: e.target.value }))}
                          required
                        />
                      </div>
                      
                      <div>
                        <Label htmlFor="outgoing-pass">סיסמה</Label>
                        <Input
                          id="outgoing-pass"
                          type="password"
                          value={outgoingEmail.emailPass}
                          onChange={(e) => setOutgoingEmail(prev => ({ ...prev, emailPass: e.target.value }))}
                          required
                        />
                      </div>

                      <div className="flex gap-3 pt-4">
                        <Button 
                          type="button" 
                          variant="outline" 
                          onClick={testOutgoingConnection}
                          disabled={isLoading}
                        >
                          בדוק חיבור יוצא
                        </Button>
                        <Button 
                          type="submit" 
                          disabled={isLoading}
                        >
                          {isLoading ? "שומר..." : "שמור הגדרות יוצאות"}
                        </Button>
                      </div>
                    </form>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Incoming Email Settings */}
              <TabsContent value="incoming" className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Inbox className="w-5 h-5" />
                      הגדרות מיילים נכנסים (IMAP)
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <form onSubmit={handleSaveIncoming} className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label htmlFor="incoming-host">שרת IMAP</Label>
                          <Input
                            id="incoming-host"
                            type="text"
                            placeholder="mail.yourdomain.com"
                            value={incomingEmail.imapHost}
                            onChange={(e) => setIncomingEmail(prev => ({ ...prev, imapHost: e.target.value }))}
                            required
                          />
                        </div>
                        <div>
                          <Label htmlFor="incoming-port">פורט IMAP</Label>
                          <Input
                            id="incoming-port"
                            type="number"
                            value={incomingEmail.imapPort}
                            onChange={(e) => setIncomingEmail(prev => ({ ...prev, imapPort: e.target.value }))}
                            required
                          />
                        </div>
                      </div>

                      <div>
                        <Label htmlFor="incoming-user">כתובת מייל</Label>
                        <Input
                          id="incoming-user"
                          type="email"
                          placeholder="your-email@yourdomain.com"
                          value={incomingEmail.emailUser}
                          onChange={(e) => setIncomingEmail(prev => ({ ...prev, emailUser: e.target.value }))}
                          required
                        />
                      </div>
                      
                      <div>
                        <Label htmlFor="incoming-pass">סיסמה</Label>
                        <Input
                          id="incoming-pass"
                          type="password"
                          value={incomingEmail.emailPass}
                          onChange={(e) => setIncomingEmail(prev => ({ ...prev, emailPass: e.target.value }))}
                          required
                        />
                      </div>

                      <div className="flex gap-3 pt-4">
                        <Button 
                          type="button" 
                          variant="outline" 
                          onClick={testIncomingConnection}
                          disabled={isLoading}
                        >
                          בדוק חיבור נכנס
                        </Button>
                        <Button 
                          type="submit" 
                          disabled={isLoading}
                        >
                          {isLoading ? "שומר..." : "שמור הגדרות נכנסות"}
                        </Button>
                      </div>
                    </form>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Recruitment Sources */}
              <TabsContent value="sources" className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Users className="w-5 h-5" />
                      ניהול מקורות גיוס
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    
                    {/* Add new source */}
                    <div className="flex gap-3">
                      <Input
                        placeholder="הוסף מקור גיוס חדש..."
                        value={newSource}
                        onChange={(e) => setNewSource(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && addRecruitmentSource()}
                      />
                      <Button 
                        onClick={addRecruitmentSource}
                        disabled={!newSource.trim()}
                        className="flex items-center gap-2"
                      >
                        <Plus className="w-4 h-4" />
                        הוסף
                      </Button>
                    </div>

                    {/* Current sources */}
                    <div className="space-y-4">
                      <h3 className="font-medium">מקורות גיוס קיימים:</h3>
                      <div className="flex flex-wrap gap-2">
                        {recruitmentSources.map((source, index) => (
                          <Badge 
                            key={index} 
                            variant="outline" 
                            className="flex items-center gap-2 px-3 py-1"
                          >
                            <span>{source}</span>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => removeRecruitmentSource(source)}
                              className="h-4 w-4 p-0 hover:bg-red-100 hover:text-red-600"
                            >
                              <X className="h-3 w-3" />
                            </Button>
                          </Badge>
                        ))}
                      </div>
                      
                      {recruitmentSources.length === 0 && (
                        <p className="text-gray-500 text-sm">אין מקורות גיוס. הוסף מקור ראשון...</p>
                      )}
                    </div>

                    <Button 
                      onClick={saveRecruitmentSources}
                      className="flex items-center gap-2"
                    >
                      <Settings className="w-4 h-4" />
                      שמור מקורות גיוס
                    </Button>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Candidate Statuses */}
              <TabsContent value="statuses" className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Settings className="w-5 h-5" />
                      ניהול סטטוסי מועמדים
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    
                    {/* Add new status */}
                    <div className="space-y-4">
                      <div className="flex gap-3">
                        <Input
                          placeholder="הוסף סטטוס מועמד חדש..."
                          value={newStatusName}
                          onChange={(e) => setNewStatusName(e.target.value)}
                          onKeyPress={(e) => e.key === 'Enter' && addCandidateStatus()}
                        />
                        <select 
                          value={selectedStatusColor}
                          onChange={(e) => setSelectedStatusColor(e.target.value)}
                          className="px-3 py-2 border rounded-md"
                        >
                          <option value="bg-green-100 text-green-800">ירוק</option>
                          <option value="bg-blue-100 text-blue-800">כחול</option>
                          <option value="bg-yellow-100 text-yellow-800">צהוב</option>
                          <option value="bg-orange-100 text-orange-800">כתום</option>
                          <option value="bg-red-100 text-red-800">אדום</option>
                          <option value="bg-purple-100 text-purple-800">סגול</option>
                          <option value="bg-pink-100 text-pink-800">ורוד</option>
                          <option value="bg-gray-100 text-gray-800">אפור</option>
                        </select>
                        <Button 
                          onClick={addCandidateStatus}
                          disabled={!newStatusName.trim()}
                          className="flex items-center gap-2"
                        >
                          <Plus className="w-4 h-4" />
                          הוסף
                        </Button>
                      </div>
                    </div>

                    {/* Current statuses - Editable Table */}
                    <div className="space-y-4">
                      <h3 className="font-medium">סטטוסי מועמדים קיימים:</h3>
                      <div className="border rounded-lg overflow-hidden">
                        <table className="w-full" dir="rtl">
                          <thead className="bg-gray-50">
                            <tr>
                              <th className="px-4 py-3 text-right text-sm font-medium text-gray-700">שם הסטטוס</th>
                              <th className="px-4 py-3 text-right text-sm font-medium text-gray-700">צבע</th>
                              <th className="px-4 py-3 text-right text-sm font-medium text-gray-700">תצוגה מקדימה</th>
                              <th className="px-4 py-3 text-right text-sm font-medium text-gray-700">פעולות</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-200">
                            {candidateStatuses.map((status) => (
                              <tr key={status.id} className="hover:bg-gray-50">
                                {editingStatusId === status.id ? (
                                  <>
                                    {/* Edit mode */}
                                    <td className="px-4 py-3">
                                      <Input
                                        value={editingStatusName}
                                        onChange={(e) => setEditingStatusName(e.target.value)}
                                        className="w-full"
                                        data-testid={`input-status-name-${status.id}`}
                                      />
                                    </td>
                                    <td className="px-4 py-3">
                                      <select
                                        value={editingStatusColor}
                                        onChange={(e) => setEditingStatusColor(e.target.value)}
                                        className="w-full px-3 py-2 border rounded-md"
                                        data-testid={`select-status-color-${status.id}`}
                                      >
                                        <option value="bg-green-100 text-green-800">ירוק</option>
                                        <option value="bg-blue-100 text-blue-800">כחול</option>
                                        <option value="bg-yellow-100 text-yellow-800">צהוב</option>
                                        <option value="bg-orange-100 text-orange-800">כתום</option>
                                        <option value="bg-red-100 text-red-800">אדום</option>
                                        <option value="bg-purple-100 text-purple-800">סגול</option>
                                        <option value="bg-pink-100 text-pink-800">ורוד</option>
                                        <option value="bg-gray-100 text-gray-800">אפור</option>
                                      </select>
                                    </td>
                                    <td className="px-4 py-3">
                                      <Badge className={editingStatusColor}>
                                        {editingStatusName}
                                      </Badge>
                                    </td>
                                    <td className="px-4 py-3">
                                      <div className="flex gap-2">
                                        <Button
                                          size="sm"
                                          onClick={saveStatusEdit}
                                          className="bg-green-600 hover:bg-green-700"
                                          data-testid={`button-save-status-${status.id}`}
                                        >
                                          <CheckCircle className="h-4 w-4" />
                                        </Button>
                                        <Button
                                          size="sm"
                                          variant="outline"
                                          onClick={cancelEditingStatus}
                                          data-testid={`button-cancel-edit-${status.id}`}
                                        >
                                          <X className="h-4 w-4" />
                                        </Button>
                                      </div>
                                    </td>
                                  </>
                                ) : (
                                  <>
                                    {/* View mode */}
                                    <td className="px-4 py-3 font-medium" data-testid={`text-status-name-${status.id}`}>
                                      {status.name}
                                      {status.isSystem && (
                                        <Badge variant="outline" className="mr-2 text-xs">
                                          סטטוס מערכת
                                        </Badge>
                                      )}
                                    </td>
                                    <td className="px-4 py-3 text-sm text-gray-600" data-testid={`text-status-color-${status.id}`}>
                                      {status.color.includes('green') && 'ירוק'}
                                      {status.color.includes('blue') && 'כחול'}
                                      {status.color.includes('yellow') && 'צהוב'}
                                      {status.color.includes('orange') && 'כתום'}
                                      {status.color.includes('red') && 'אדום'}
                                      {status.color.includes('purple') && 'סגול'}
                                      {status.color.includes('pink') && 'ורוד'}
                                      {status.color.includes('gray') && 'אפור'}
                                    </td>
                                    <td className="px-4 py-3">
                                      <Badge className={status.color} data-testid={`badge-status-${status.id}`}>
                                        {status.name}
                                      </Badge>
                                    </td>
                                    <td className="px-4 py-3">
                                      <div className="flex gap-2">
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          onClick={() => startEditingStatus(status)}
                                          className="text-blue-600 hover:bg-blue-100"
                                          data-testid={`button-edit-status-${status.id}`}
                                        >
                                          ערוך
                                        </Button>
                                        {!status.isSystem && (
                                          <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => removeCandidateStatus(status.id)}
                                            className="text-red-600 hover:bg-red-100"
                                            data-testid={`button-delete-status-${status.id}`}
                                          >
                                            <Trash2 className="h-4 w-4" />
                                          </Button>
                                        )}
                                      </div>
                                    </td>
                                  </>
                                )}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      
                      {candidateStatuses.length === 0 && (
                        <p className="text-gray-500 text-sm">אין סטטוסים. הוסף סטטוס ראשון...</p>
                      )}
                    </div>

                    <div className="pt-4 border-t">
                      <div className="bg-blue-50 p-4 rounded-lg mb-4">
                        <h4 className="font-medium mb-2">הערות שימוש:</h4>
                        <ul className="text-sm text-gray-700 space-y-1">
                          <li>• <strong>עריכת סטטוס:</strong> לחץ על כפתור "ערוך" בכל שורה לעריכת השם והצבע</li>
                          <li>• <strong>סטטוסי מערכת:</strong> 8 סטטוסים בסיסיים מסומנים כסטטוסי מערכת - ניתן לערוך אך לא למחוק</li>
                          <li>• <strong>סטטוסים מותאמים אישית:</strong> ניתן להוסיף, לערוך ולמחוק סטטוסים לפי צרכי הארגון</li>
                          <li>• <strong>תצוגה מקדימה:</strong> הצבע והשם מוצגים בזמן אמת בעת עריכה</li>
                        </ul>
                        <p className="text-sm text-muted-foreground mt-2">
                          💡 השינויים נשמרים מיידית לאחר לחיצה על כפתור השמירה
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>
        </main>
    </div>
  );
}