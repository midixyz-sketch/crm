# 🚀 מדריך התקנה והרצה מקומית / VPS

## 🎯 מטרה: בסיס נתונים זהה 100% ל-Replit

---

## דרישות מערכת

1. **Node.js** גרסה 20 ומעלה
2. **PostgreSQL** גרסה 12 ומעלה
3. **npm** או **pnpm**

---

## 📥 הורדה מ-Replit

הורד את הקבצים הבאים:

1. ✅ **כל הקוד** (Download as ZIP)
2. ✅ **`database_full_backup.sql`** (6.6MB) - בסיס הנתונים המלא
3. ✅ **תיקיית `uploads/`** - קבצי CV ומסמכים

---

## 🚀 הוראות התקנה (שלב אחר שלב)

### 1. פרוס את הקוד
```bash
unzip <project-name>.zip
cd <project-folder>
```

### 2. התקן תלויות
```bash
npm install
```

### 3. הגדר משתני סביבה
צור קובץ **`.env`** בתיקייה הראשית:

```env
# Database
DATABASE_URL=postgresql://localhost/recruitment_db

# Session Secret (החלף במפתח חזק!)
SESSION_SECRET=your-random-secret-key-minimum-32-characters

# Email (אופציונלי - אם יש לך)
CPANEL_EMAIL=your@email.com
CPANEL_PASSWORD=your-password
SMTP_HOST=mail.yourhost.com
SMTP_PORT=465

# SendGrid (אופציונלי)
SENDGRID_API_KEY=your-sendgrid-key
```

### 4. צור בסיס נתונים
```bash
# יצירת בסיס נתונים ריק
createdb recruitment_db
```

### 5. ⭐ ייבא את בסיס הנתונים (הכי חשוב!)
```bash
# זה יוצר הכל - טבלאות + נתונים
psql recruitment_db < database_full_backup.sql
```

**✅ עכשיו בסיס הנתונים זהה 100% ל-Replit!**

### 6. העתק את תיקיית uploads
```bash
# העתק את תיקיית uploads שהורדת מ-Replit
cp -r /path/to/downloaded/uploads ./uploads
```

### 7. הרץ את האפליקציה
```bash
npm run dev
```

**✅ האפליקציה תרוץ על: http://localhost:5000**

---

## 🔑 כניסה ראשונית

השתמש באחד המשתמשים מבסיס הנתונים של Replit.

אם אין לך גישה, צור משתמש חדש דרך ה-admin.

---

## ⚠️ חשוב מאוד!

### ✅ התהליך הנכון:
```bash
createdb recruitment_db
psql recruitment_db < database_full_backup.sql  # מבנה + נתונים!
npm run dev
```

### ❌ אל תריץ את זה:
```bash
npm run db:push  # זה יוצר טבלאות ריקות - לא צריך!
```

**הקובץ `database_full_backup.sql` כבר כולל הכל!**

---

## 📊 מה כלול בבסיס הנתונים?

אחרי הייבוא של `database_full_backup.sql` תקבל:

✅ **מבנה מלא** - כל הטבלאות, אינדקסים, קשרים
✅ **כל הנתונים:**
  - מועמדים (133+)
  - לקוחות ואנשי קשר
  - משרות
  - משתמשים (עם סיסמאות)
  - הגדרות ורשאות
  - היסטוריית אירועים
  - שיחות WhatsApp והודעות
  - תבניות הודעות
  - תזכורות ופגישות
  - פעילות רכזים חיצוניים
  - סטטוסים מותאמים

**זהה 100% ל-Replit - אפס הבדלים!** 🎯

---

## 🔄 עדכון בסיס הנתונים

אם עבדת ב-Replit ורוצה לעדכן את המקומי:

### ב-Replit:
```bash
pg_dump $DATABASE_URL --no-owner --no-acl > database_full_backup.sql
# הורד את הקובץ החדש
```

### במחשב מקומי/VPS:
```bash
# מחק את הישן
dropdb recruitment_db

# צור מחדש עם הנתונים החדשים
createdb recruitment_db
psql recruitment_db < database_full_backup.sql

# הפעל מחדש
npm run dev
```

---

## 🛠️ פתרון בעיות נפוצות

### שגיאה: "EADDRINUSE: port 5000"
פורט 5000 תפוס:
```bash
# Mac/Linux
lsof -ti:5000 | xargs kill -9

# Windows
netstat -ano | findstr :5000
taskkill /PID <PID> /F
```

### שגיאה: "database already exists"
```bash
dropdb recruitment_db
createdb recruitment_db
psql recruitment_db < database_full_backup.sql
```

### שגיאה: "relation already exists"
```bash
# התחל מחדש
dropdb recruitment_db
createdb recruitment_db
psql recruitment_db < database_full_backup.sql
```

### שגיאה: "psql: command not found"
התקן PostgreSQL:
- **Mac:** `brew install postgresql`
- **Ubuntu:** `sudo apt-get install postgresql postgresql-client`
- **Windows:** https://www.postgresql.org/download/

### שגיאה: "connection refused"
וודא ש-PostgreSQL רץ:
```bash
# Mac/Linux
pg_isready
sudo service postgresql start

# Windows
net start postgresql
```

### WhatsApp לא מתחבר
1. תיקיית `whatsapp_auth/` תיווצר אוטומטית
2. סרוק QR קוד חדש מהאפליקציה
3. זה נורמלי - כל סביבה צריכה QR נפרד

---

## 📂 מבנה קבצים

```
recruitment-system/
├── server/              # קוד השרת (Express)
├── client/              # קוד הלקוח (React)
├── shared/              # סכמת DB משותפת
├── uploads/             # קבצי CV (העתק מ-Replit)
├── whatsapp_auth/       # יווצר אוטומטית
├── logs/                # יווצר אוטומטית
├── .env                 # צור ידנית
├── database_full_backup.sql  # הורד מ-Replit
└── package.json
```

---

## 🌐 פריסה ל-VPS (Production)

### 1. התקן תלויות מערכת
```bash
# Ubuntu/Debian
sudo apt-get update
sudo apt-get install -y nodejs npm postgresql
```

### 2. הגדר PostgreSQL
```bash
sudo -u postgres createdb recruitment_db
sudo -u postgres psql recruitment_db < database_full_backup.sql
```

### 3. הגדר .env לפרודקשן
```env
DATABASE_URL=postgresql://localhost/recruitment_db
SESSION_SECRET=<strong-random-key-for-production>
NODE_ENV=production
```

### 4. הרץ עם PM2
```bash
npm install -g pm2
npm run build
pm2 start npm --name "recruitment" -- start
pm2 save
pm2 startup
```

### 5. הגדר Nginx (Reverse Proxy)
```nginx
server {
    listen 80;
    server_name your-domain.com;
    
    location / {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

---

## 🔒 אבטחה (חובה לפרודקשן!)

1. **החלף SESSION_SECRET** במפתח חזק (32+ תווים רנדומליים)
2. **שנה סיסמאות משתמשים** בסיסיות
3. **הגדר HTTPS** (Let's Encrypt)
4. **הגדר Firewall** (רק פורטים 80, 443, 22)
5. **גיבוי אוטומטי** של בסיס הנתונים:
```bash
# Cron job - כל יום ב-2 AM
0 2 * * * pg_dump recruitment_db > /backup/db_$(date +\%Y\%m\%d).sql
```

---

## 🎯 סיכום מהיר

```bash
# 1. הורד: קוד + database_full_backup.sql + uploads/
# 2. התקן:
npm install

# 3. הגדר .env
echo "DATABASE_URL=postgresql://localhost/recruitment_db" > .env
echo "SESSION_SECRET=your-secret-here" >> .env

# 4. צור DB וייבא
createdb recruitment_db
psql recruitment_db < database_full_backup.sql

# 5. הרץ
npm run dev
```

**✅ עכשיו המערכת זהה 100% ל-Replit!**

---

## 📞 תמיכה נוספת

- **`DATABASE_RESTORE_GUIDE.md`** - מדריך מפורט לבסיס נתונים
- **`README_DOWNLOAD.md`** - סיכום מהיר

אם יש בעיות:
1. וודא PostgreSQL רץ: `pg_isready`
2. בדוק גרסת Node: `node --version` (צריך 20+)
3. וודא .env קיים ותקין
4. בדוק שפורט 5000 פנוי
