import { useState } from 'react';
import { useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { queryClient } from '@/lib/queryClient';

export default function LoginPage() {
  const [, navigate] = useLocation();
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    password: ''
  });
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const response = await fetch('/api/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        const data = await response.json();
        toast({
          title: "התחברות בוצעה בהצלחה",
          description: "התחברת למערכת בהצלחה",
        });
        
        // Invalidate auth queries to refresh user data
        await queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
        await queryClient.invalidateQueries({ queryKey: ["/api/user"] });
        
        // Always navigate to "/" - HomePage will redirect based on role
        navigate('/');
      } else {
        const errorData = await response.json();
        toast({
          variant: "destructive",
          title: "שגיאת התחברות",
          description: errorData.message || "שגיאה לא ידועה",
        });
      }
    } catch (error) {
      console.error('Authentication error:', error);
      toast({
        variant: "destructive",
        title: "שגיאה",
        description: "שגיאה בחיבור לשרת",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <h1 className="text-2xl font-bold text-center mb-6">התחברות למערכת הגיוס</h1>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            type="email"
            placeholder="אימייל"
            value={formData.email}
            onChange={(e) => handleInputChange('email', e.target.value)}
            required
            data-testid="input-email"
          />
          <Input
            type="password"
            placeholder="סיסמה"
            value={formData.password}
            onChange={(e) => handleInputChange('password', e.target.value)}
            required
            data-testid="input-password"
          />
          <Button 
            type="submit" 
            className="w-full" 
            disabled={isLoading}
            data-testid="button-submit"
          >
            {isLoading ? 'טוען...' : 'התחברות'}
          </Button>
        </form>
      </div>
    </div>
  );
}