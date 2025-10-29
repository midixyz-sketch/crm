# מדריך פריסה ל-VPS
## Recruitment Management System - VPS Deployment Guide

---

## 📦 קבצי הגיבוי

**קובץ הגיבוי המלא:** `database_vps_deployment_backup.sql`
- גודל: 6.6 MB
- שורות: 12,922
- כולל: סכמה מלאה + כל הנתונים + אינדקסים + אילוצים

---

## 🚀 שלבי הפריסה ב-VPS

### שלב 1: הכנת סביבת ה-VPS

```bash
# עדכון המערכת
sudo apt update && sudo apt upgrade -y

# התקנת Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# התקנת PostgreSQL 16
sudo apt install -y postgresql postgresql-contrib

# התקנת PM2 לניהול תהליכים
sudo npm install -g pm2

# התקנת Nginx (אופציונלי - לפרודקשן)
sudo apt install -y nginx
```

---

### שלב 2: הכנת PostgreSQL

```bash
# כניסה ל-PostgreSQL כ-superuser
sudo -u postgres psql

# יצירת משתמש ומסד נתונים
CREATE USER recruitment_user WITH PASSWORD 'your_secure_password_here';
CREATE DATABASE recruitment_db OWNER recruitment_user;

# מתן הרשאות
GRANT ALL PRIVILEGES ON DATABASE recruitment_db TO recruitment_user;

# יציאה
\q
```

---

### שלב 3: שחזור המסד נתונים

```bash
# העתקת קובץ הגיבוי ל-VPS (מהמחשב המקומי)
scp database_vps_deployment_backup.sql user@your-vps-ip:/home/user/

# ב-VPS: שחזור המסד נתונים
psql -U recruitment_user -d recruitment_db -f database_vps_deployment_backup.sql

# אימות שהנתונים נטענו
psql -U recruitment_user -d recruitment_db -c "\dt"
psql -U recruitment_user -d recruitment_db -c "SELECT COUNT(*) FROM candidates;"
psql -U recruitment_user -d recruitment_db -c "SELECT COUNT(*) FROM jobs;"
```

---

### שלב 4: פריסת הקוד

```bash
# יצירת תיקיית הפרויקט
mkdir -p /var/www/recruitment-system
cd /var/www/recruitment-system

# העתקת הקוד (באמצעות git או scp)
# דרך 1: Git
git clone your-repo-url .

# דרך 2: העתקה ישירה (מהמחשב המקומי)
# scp -r /path/to/project/* user@your-vps-ip:/var/www/recruitment-system/

# התקנת תלויות
npm install

# בניית הפרויקט
npm run build
```

---

### שלב 5: הגדרת משתני סביבה

צור קובץ `.env` בתיקיית הפרויקט:

```bash
nano .env
```

הוסף את המשתנים הבאים:

```env
# Database
DATABASE_URL=postgresql://recruitment_user:your_secure_password_here@localhost:5432/recruitment_db

# Node Environment
NODE_ENV=production

# Session Secret (צור מחרוזת אקראית חזקה)
SESSION_SECRET=your-super-secret-random-string-here-at-least-32-chars

# Server Port
PORT=5000

# Email Settings (אם יש)
SMTP_HOST=your-smtp-host
SMTP_PORT=587
SMTP_USER=your-email@domain.com
SMTP_PASS=your-email-password
SMTP_FROM=noreply@yourdomain.com

# WhatsApp (אופציונלי)
WHATSAPP_ENABLED=true

# SendGrid (אם יש)
SENDGRID_API_KEY=your-sendgrid-api-key
```

**חשוב:** שמור את הקובץ והגדר הרשאות:
```bash
chmod 600 .env
```

---

### שלב 6: הרצת האפליקציה עם PM2

```bash
# התחלת האפליקציה
pm2 start npm --name "recruitment-system" -- run start

# שמירת התצורה
pm2 save

# הגדרת הפעלה אוטומטית בהפעלה מחדש של השרת
pm2 startup
# הרץ את הפקודה שPM2 מציג

# בדיקת סטטוס
pm2 status
pm2 logs recruitment-system
```

---

### שלב 7: הגדרת Nginx (Reverse Proxy)

צור קובץ תצורה:
```bash
sudo nano /etc/nginx/sites-available/recruitment-system
```

הוסף את התצורה הבאה:

```nginx
server {
    listen 80;
    server_name your-domain.com www.your-domain.com;

    client_max_body_size 50M;

    location / {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        
        # WebSocket support for WhatsApp
        proxy_read_timeout 86400;
    }
}
```

הפעל את האתר:
```bash
sudo ln -s /etc/nginx/sites-available/recruitment-system /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

---

### שלב 8: הגדרת SSL (HTTPS) עם Let's Encrypt

```bash
# התקנת Certbot
sudo apt install -y certbot python3-certbot-nginx

# קבלת תעודת SSL
sudo certbot --nginx -d your-domain.com -d www.your-domain.com

# אימות חידוש אוטומטי
sudo certbot renew --dry-run
```

---

## 🔒 אבטחה

### 1. Firewall (UFW)
```bash
sudo ufw allow 22/tcp    # SSH
sudo ufw allow 80/tcp    # HTTP
sudo ufw allow 443/tcp   # HTTPS
sudo ufw enable
sudo ufw status
```

### 2. אבטחת PostgreSQL
```bash
sudo nano /etc/postgresql/16/main/pg_hba.conf
```
וודא שהגישה מוגבלת ל-localhost:
```
local   all             all                                     peer
host    all             all             127.0.0.1/32            md5
host    all             all             ::1/128                 md5
```

### 3. גיבויים אוטומטיים
צור סקריפט גיבוי:
```bash
nano /home/user/backup_db.sh
```

הוסף:
```bash
#!/bin/bash
BACKUP_DIR="/home/user/db_backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
mkdir -p $BACKUP_DIR
pg_dump -U recruitment_user recruitment_db > $BACKUP_DIR/backup_$TIMESTAMP.sql
# שמירת 7 ימים אחרונים בלבד
find $BACKUP_DIR -type f -mtime +7 -delete
```

הפעל אוטומטית עם cron:
```bash
chmod +x /home/user/backup_db.sh
crontab -e
# הוסף שורה זו (גיבוי יומי ב-2:00 בלילה):
0 2 * * * /home/user/backup_db.sh
```

---

## 📊 ניטור ובדיקות

### בדיקת התקינות
```bash
# סטטוס PM2
pm2 status

# לוגים
pm2 logs recruitment-system --lines 100

# ניטור משאבים
pm2 monit

# בדיקת חיבור למסד נתונים
psql -U recruitment_user -d recruitment_db -c "SELECT NOW();"

# בדיקת Nginx
sudo nginx -t
sudo systemctl status nginx
```

### מדדי ביצועים
```bash
# שימוש בדיסק
df -h

# שימוש בזיכרון
free -h

# תהליכים
top

# חיבורי PostgreSQL
psql -U recruitment_user -d recruitment_db -c "SELECT count(*) FROM pg_stat_activity;"
```

---

## 🔄 עדכונים

### עדכון הקוד
```bash
cd /var/www/recruitment-system
git pull origin main
npm install
npm run build
pm2 restart recruitment-system
```

### עדכון מסד נתונים
```bash
# אם יש migration חדש
npm run db:push
```

---

## 🆘 פתרון בעיות

### האפליקציה לא עולה
```bash
# בדוק לוגים
pm2 logs recruitment-system --err

# נסה הפעלה ידנית
cd /var/www/recruitment-system
NODE_ENV=production npm run start
```

### בעיות חיבור למסד נתונים
```bash
# בדוק שPG רץ
sudo systemctl status postgresql

# בדוק חיבור
psql -U recruitment_user -d recruitment_db -c "SELECT 1;"

# בדוק משתני סביבה
cat .env | grep DATABASE_URL
```

### בעיות Nginx
```bash
# בדוק תצורה
sudo nginx -t

# הצג שגיאות
sudo tail -f /var/log/nginx/error.log

# הפעל מחדש
sudo systemctl restart nginx
```

---

## 📝 נתונים חשובים

### משתמש ברירת מחדל
- **Email:** admin@example.com
- **Password:** admin123
- **חשוב:** שנה את הסיסמה מיד לאחר ההתחברות הראשונה!

### תיקיות חשובות
- קוד: `/var/www/recruitment-system`
- לוגים: `~/.pm2/logs/`
- גיבויים: `/home/user/db_backups/`
- WhatsApp sessions: `whatsapp_auth/`

---

## ✅ Checklist לפני הפעלה

- [ ] PostgreSQL מותקן ופועל
- [ ] מסד נתונים שוחזר בהצלחה
- [ ] Node.js 20 מותקן
- [ ] כל התלויות הותקנו (`npm install`)
- [ ] קובץ `.env` הוגדר עם כל המשתנים
- [ ] PM2 מותקן ומוגדר
- [ ] Nginx מותקן ומוגדר (אופציונלי)
- [ ] SSL מוגדר (לפרודקשן)
- [ ] Firewall מוגדר
- [ ] גיבויים אוטומטיים מוגדרים
- [ ] סיסמת admin שונתה

---

## 🎯 מצב ייצור מומלץ

```
[Internet] → [Cloudflare/DNS] → [VPS]
                                   ↓
                              [Nginx:80/443]
                                   ↓
                            [Node.js App:5000]
                                   ↓
                          [PostgreSQL:5432]
```

---

## 📞 תמיכה

לשאלות ובעיות:
1. בדוק את הלוגים תחילה (`pm2 logs`)
2. וודא ש-.env מוגדר נכון
3. בדוק חיבור למסד נתונים
4. בדוק שכל השירותים פועלים

---

**בהצלחה! 🚀**
