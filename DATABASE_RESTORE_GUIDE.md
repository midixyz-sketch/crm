# 📊 מדריך שחזור בסיס הנתונים

## ✅ הקובץ שנוצר:

**`database_backup.sql`** - 7.6MB, 76,204 שורות
- כולל את **כל הנתונים** מבסיס הנתונים של Replit
- מועמדים, לקוחות, משרות, משתמשים, הגדרות, היסטוריה - **הכל!**

---

## 🎯 הבעיה שזה פותר:

כשאתה מוריד את הקוד מ-Replit ומריץ `npm run db:push`:
- ✅ **נוצרות הטבלאות** (מבנה בסיס הנתונים)
- ❌ **אבל אין נתונים!** (הטבלאות ריקות)

**הפתרון:** ייבא את הקובץ `database_backup.sql` עם כל הנתונים!

---

## 📥 איך לייבא את הנתונים (שלב אחר שלב)

### שלב 1: הורד את הקובץ
1. מ-Replit, לחץ על **קובץ `database_backup.sql`**
2. לחץ על **3 נקודות (⋮)** → **Download**
3. שמור את הקובץ בתיקיית הפרויקט שלך

### שלב 2: צור בסיס נתונים ריק
```bash
# צור בסיס נתונים חדש
createdb recruitment_db

# או אם הוא כבר קיים, נקה אותו
dropdb recruitment_db
createdb recruitment_db
```

### שלב 3: הגדר את המבנה
```bash
# הרץ את ה-schema (יוצר טבלאות ריקות)
npm run db:push
```

### שלב 4: ייבא את הנתונים
```bash
# ייבא את כל הנתונים
psql recruitment_db < database_backup.sql
```

---

## 🚀 התהליך המלא (פקודות מוכנות להעתקה)

```bash
# 1. צור בסיס נתונים
createdb recruitment_db

# 2. הגדר משתני סביבה (צור קובץ .env)
echo "DATABASE_URL=postgresql://localhost/recruitment_db" > .env
echo "SESSION_SECRET=your-secret-key-here" >> .env

# 3. התקן תלויות
npm install

# 4. צור מבנה טבלאות
npm run db:push

# 5. ייבא את הנתונים
psql recruitment_db < database_backup.sql

# 6. הרץ את האפליקציה
npm run dev
```

---

## ✅ מה יהיה אחרי הייבוא?

אחרי שתייבא את `database_backup.sql`, האפליקציה המקומית שלך תכיל:

✅ כל המועמדים (עם קורות חיים וקבצים)
✅ כל הלקוחות ואנשי קשר
✅ כל המשרות
✅ כל המשתמשים (עם סיסמאות)
✅ כל ההגדרות והרשאות
✅ כל היסטוריית האירועים
✅ כל שיחות WhatsApp
✅ כל תבניות ההודעות
✅ כל התזכורות והפגישות
✅ כל פעילות הרכזים החיצוניים

**זה יהיה זהה 100% למה שרץ ב-Replit!**

---

## 🔄 עדכון הנתונים

אם אתה עובד ב-Replit ורוצה לעדכן את הנתונים המקומיים:

### ב-Replit (ייצוא מחדש):
```bash
pg_dump $DATABASE_URL --data-only --inserts --no-owner --no-acl > database_backup.sql
```

### במחשב המקומי (ייבוא מחדש):
```bash
# נקה את הנתונים הישנים
psql recruitment_db -c "TRUNCATE TABLE candidates, clients, jobs, users, applications, reminders, whatsapp_chats, whatsapp_messages CASCADE;"

# ייבא את הנתונים החדשים
psql recruitment_db < database_backup.sql
```

---

## ⚠️ בעיות נפוצות ופתרונות

### שגיאה: "relation already exists"
**פתרון:**
```bash
dropdb recruitment_db
createdb recruitment_db
npm run db:push
psql recruitment_db < database_backup.sql
```

### שגיאה: "duplicate key value"
**משמעות:** הנתונים כבר קיימים  
**פתרון:** נקה את הטבלאות לפני הייבוא:
```bash
psql recruitment_db -c "TRUNCATE TABLE candidates CASCADE;"
psql recruitment_db < database_backup.sql
```

### שגיאה: "psql: command not found"
**פתרון:** התקן PostgreSQL:
- **Mac:** `brew install postgresql`
- **Ubuntu/Linux:** `sudo apt-get install postgresql-client`
- **Windows:** הורד מ- https://www.postgresql.org/download/

---

## 📂 קבצים שצריך להעתיק בנפרד

**שים לב:** הקבצים הבאים **לא כלולים** ב-`database_backup.sql`:

1. **`uploads/`** - קבצים שהועלו (CVs, תמונות)
   - צריך להוריד את התיקייה הזו בנפרד מ-Replit
   - להעתיק אותה לפרויקט המקומי

2. **`whatsapp_auth/`** - קבצי סשן WhatsApp
   - **לא צריך להעתיק!**
   - תצטרך לסרוק QR קוד חדש במקומי

3. **קבצי `.env`** - משתני סביבה
   - צריך ליצור ידנית (ראה LOCAL_SETUP_GUIDE.md)

---

## 🎯 סיכום

1. **הורד:** `database_backup.sql` (7.6MB)
2. **הורד:** תיקיית `uploads/` (אם יש קבצים)
3. **הרץ:** `npm run db:push` (יוצר מבנה)
4. **ייבא:** `psql recruitment_db < database_backup.sql` (ממלא נתונים)
5. **הרץ:** `npm run dev`

**עכשיו האפליקציה המקומית זהה 100% ל-Replit!** 🎉

---

## 📞 תמיכה נוספת

אם יש בעיות:
1. וודא ש-PostgreSQL מותקן ורץ: `pg_isready`
2. וודא שבסיס הנתונים קיים: `psql -l | grep recruitment`
3. בדוק את הלוגים לשגיאות ספציפיות

**זכור:** `database_backup.sql` מכיל רק **נתונים**, לא מבנה טבלאות.  
תמיד הרץ `npm run db:push` לפני הייבוא!
