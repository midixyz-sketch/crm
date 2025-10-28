# ⚡ התקנה מהירה - 3 פקודות בלבד!

## 🎯 בסיס נתונים זהה 100% ל-Replit

---

## 📥 שלב 1: הורד מ-Replit

1. **קוד** - Download as ZIP
2. **`database_full_backup.sql`** (6.6MB) - לחץ על הקובץ → ⋮ → Download
3. **תיקיית `uploads/`** (אם יש) - Download

---

## ⚡ שלב 2: התקנה (3 פקודות!)

```bash
# פקודה 1: צור בסיס נתונים
createdb recruitment_db

# פקודה 2: ייבא הכל (מבנה + נתונים)
psql recruitment_db < database_full_backup.sql

# פקודה 3: התקן והרץ
npm install && npm run dev
```

**✅ זהו! האפליקציה רצה על http://localhost:5000**

---

## 🔧 הגדרות נוספות (אופציונלי)

צור קובץ `.env` אם אין:

```env
DATABASE_URL=postgresql://localhost/recruitment_db
SESSION_SECRET=your-secret-key-here
```

---

## ⚠️ חשוב!

### ✅ תריץ:
```bash
psql recruitment_db < database_full_backup.sql
```

### ❌ אל תריץ:
```bash
npm run db:push  # לא צריך! הקובץ כבר כולל הכל
```

---

## 🎯 מה תקבל?

✅ כל המועמדים (133+)
✅ כל הלקוחות
✅ כל המשרות
✅ כל המשתמשים
✅ כל ההגדרות
✅ כל היסטוריית האירועים
✅ כל שיחות WhatsApp
✅ **זהה 100% ל-Replit!**

---

## 🔄 אם יש שגיאה

```bash
# התחל מחדש
dropdb recruitment_db
createdb recruitment_db
psql recruitment_db < database_full_backup.sql
npm run dev
```

---

## 📖 מדריכים מפורטים

- **`DATABASE_RESTORE_GUIDE.md`** - פתרון בעיות ומידע נוסף
- **`LOCAL_SETUP_GUIDE.md`** - מדריך מלא כולל VPS

---

## ✅ סיכום

| שלב | פקודה |
|-----|-------|
| 1. צור DB | `createdb recruitment_db` |
| 2. ייבא | `psql recruitment_db < database_full_backup.sql` |
| 3. הרץ | `npm install && npm run dev` |

**בסיס הנתונים זהה 100% ל-Replit!** 🚀
