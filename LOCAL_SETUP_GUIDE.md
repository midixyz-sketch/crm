# מדריך התקנה והרצה מקומית

## הבעיה שנפתרה

כאשר הורדת את הקוד מ-Replit, היו הבדלים בגלל תיקיות שלא צריכות להיכלל בהורדה:
- `whatsapp_auth/` - קבצי סשן של WhatsApp (משתנים כל הזמן)
- `uploads/` - קבצים שהועלו על ידי משתמשים
- `logs/` - קבצי לוג

**✅ תוקן:** כל התיקיות האלה נוספו ל-`.gitignore` ולא ייכללו יותר בהורדות.

---

## דרישות מערכת

1. **Node.js** גרסה 20 ומעלה
2. **PostgreSQL** מותקן ופועל
3. **npm** או **pnpm**

---

## הוראות התקנה

### 1. הורד את הקוד
הורד את הפרויקט מ-Replit (Download as ZIP)

### 2. התקן תלויות
```bash
cd <project-folder>
npm install
```

### 3. הגדר משתני סביבה
צור קובץ `.env` בתיקייה הראשית:

```env
# Database
DATABASE_URL=postgresql://user:password@localhost:5432/recruitment_db

# Session Secret
SESSION_SECRET=your-secret-key-here

# Email (optional - for email features)
CPANEL_EMAIL=your@email.com
CPANEL_PASSWORD=your-password
SMTP_HOST=mail.yourhost.com
SMTP_PORT=465

# SendGrid (optional - for email features)  
SENDGRID_API_KEY=your-sendgrid-key
```

### 4. הקם את בסיס הנתונים
```bash
# יצירת בסיס נתונים
createdb recruitment_db

# הרצת סכמת DB (יוצר טבלאות ריקות)
npm run db:push
```

### 5. ייבא את הנתונים מ-Replit (חשוב!)
```bash
# ⚠️ ללא שלב זה, בסיס הנתונים יהיה ריק!
# הורד קודם את הקובץ database_backup.sql מ-Replit

psql recruitment_db < database_backup.sql
```

**📖 למידע מפורט:** ראה `DATABASE_RESTORE_GUIDE.md`

### 6. הרץ את האפליקציה
```bash
npm run dev
```

האפליקציה תרוץ על: `http://localhost:5000`

---

## כניסה ראשונית

**משתמש ברירת מחדל:**
- אימייל: `admin@localhost`
- סיסמה: `admin123`

**⚠️ חשוב:** שנה את הסיסמה מיד לאחר הכניסה הראשונה!

---

## ⚠️ חשוב מאוד: ייבוא נתונים!

**`npm run db:push` יוצר רק STRUCTURE (טבלאות ריקות)!**

כדי לקבל את כל הנתונים (מועמדים, לקוחות, משרות, וכו'):
1. **הורד** `database_backup.sql` מ-Replit (7.6MB)
2. **הרץ** `psql recruitment_db < database_backup.sql`

**ראה `DATABASE_RESTORE_GUIDE.md` למדריך מפורט!**

---

## הבדלים בין Replit לריצה מקומית

### ✅ זהה בדיוק:
- כל קוד ה-UI (React, TypeScript)
- כל קוד השרת (Express, API routes)
- מבנה בסיס הנתונים
- כל הספריות והתלויות

### 📥 צריך להוריד ולייבא:
- **`database_backup.sql`** - כל הנתונים (מועמדים, לקוחות, משרות)
- **`uploads/`** - קבצי CV ומסמכים שהועלו

### 🔄 יווצרו מחדש מקומית:
- תיקיית `whatsapp_auth/` - תיווצר כשתתחבר ל-WhatsApp
- תיקיית `logs/` - תיווצר אוטומטית

---

## פתרון בעיות נפוצות

### שגיאת "EADDRINUSE: port 5000"
פורט 5000 תפוס. הרוג את התהליך:
```bash
# Mac/Linux
lsof -ti:5000 | xargs kill -9

# Windows
netstat -ano | findstr :5000
taskkill /PID <PID> /F
```

### שגיאת חיבור לבסיס נתונים
בדוק ש-PostgreSQL רץ:
```bash
# Mac/Linux
pg_isready

# Windows
pg_ctl status
```

### WhatsApp לא מתחבר
1. מחק את תיקיית `whatsapp_auth/`
2. הפעל מחדש את השרת
3. סרוק QR קוד חדש

---

## מבנה הפריסה (RTL)

האפליקציה מוגדרת ל-RTL מלא (עברית):
- `client/index.html` - `<html lang="he" dir="rtl">`
- סיידבר בצד **ימין**
- תפריט עליון למעלה
- WhatsApp בפינה ימנית תחתונה

זה **זהה לחלוטין** למה שרץ ב-Replit.

---

## תמיכה

אם יש בעיות נוספות, בדוק:
1. ש-Node.js גרסה 20+
2. ש-PostgreSQL רץ ונגיש
3. שכל המשתנים ב-`.env` מוגדרים נכון
4. שהפורט 5000 לא תפוס

---

## אבטחה

**⚠️ לפני העלאה לפרודקשן:**
1. שנה `SESSION_SECRET` למפתח חזק
2. שנה סיסמת admin
3. הגדר SSL/TLS
4. אל תשתף את קבצי `.env`
