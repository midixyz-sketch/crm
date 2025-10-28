# 🚀 Ubuntu VPS Setup Guide - Complete Installation

## 📋 Prerequisites
- Ubuntu 20.04 or 22.04 VPS
- Root or sudo access
- At least 2GB RAM

---

## ⚡ Quick Install (Copy & Paste)

```bash
# 1. Update system
sudo apt-get update && sudo apt-get upgrade -y

# 2. Install PostgreSQL
sudo apt-get install -y postgresql postgresql-contrib

# 3. Install Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# 4. Verify installations
node --version    # Should show v20.x
psql --version    # Should show 12+ or higher
```

---

## 📥 Step-by-Step Installation

### Step 1: Install PostgreSQL

```bash
# Install PostgreSQL
sudo apt-get update
sudo apt-get install -y postgresql postgresql-contrib

# Start PostgreSQL service
sudo systemctl start postgresql
sudo systemctl enable postgresql

# Verify it's running
sudo systemctl status postgresql
```

### Step 2: Create Database and User

```bash
# Switch to postgres user
sudo -u postgres psql

# In PostgreSQL prompt, run:
CREATE DATABASE recruitment_db;
CREATE USER recruitment_user WITH PASSWORD 'your_secure_password';
GRANT ALL PRIVILEGES ON DATABASE recruitment_db TO recruitment_user;
\q
```

**Or create with postgres as owner (simpler):**

```bash
sudo -u postgres createdb recruitment_db
```

### Step 3: Install Node.js 20

```bash
# Install Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Verify
node --version
npm --version
```

### Step 4: Upload Files to VPS

**Option A: Using SCP (from your computer)**
```bash
# Upload project folder
scp -r /path/to/project root@your-vps-ip:/var/www/recruitment

# Upload database file
scp database_full_backup.sql root@your-vps-ip:/tmp/
```

**Option B: Using Git**
```bash
# On VPS
cd /var/www
git clone <your-repo-url> recruitment
cd recruitment
```

**Option C: Download from Replit**
```bash
# On VPS
cd /var/www
wget "https://replit.com/...download-link..." -O project.zip
unzip project.zip
mv <folder-name> recruitment
cd recruitment
```

### Step 5: Import Database

```bash
# Import the SQL file
sudo -u postgres psql recruitment_db < database_full_backup.sql

# Or if you created a user:
psql -U recruitment_user -d recruitment_db -f database_full_backup.sql
```

**Check if import succeeded:**
```bash
sudo -u postgres psql recruitment_db -c "SELECT COUNT(*) FROM candidates;"
# Should show 133+ candidates
```

### Step 6: Configure Application

```bash
cd /var/www/recruitment

# Create .env file
nano .env
```

**Add this to .env:**
```env
# Database
DATABASE_URL=postgresql://localhost/recruitment_db

# Session Secret (change this!)
SESSION_SECRET=your-very-secure-random-secret-key-min-32-chars

# Server
NODE_ENV=production
PORT=5000

# Email (optional - add if you have)
CPANEL_EMAIL=your@email.com
CPANEL_PASSWORD=your-password
SMTP_HOST=mail.yourhost.com
SMTP_PORT=465

# SendGrid (optional)
SENDGRID_API_KEY=your-key
```

**Save:** `Ctrl+O`, `Enter`, `Ctrl+X`

### Step 7: Install Dependencies

```bash
cd /var/www/recruitment

# Install npm packages
npm install

# This may take 5-10 minutes
```

### Step 8: Upload Files Directory

```bash
# Create uploads directory
mkdir -p uploads

# If you have uploads from Replit, copy them:
# (Upload via SCP from your computer)
scp -r /path/to/replit/uploads/* root@your-vps-ip:/var/www/recruitment/uploads/
```

### Step 9: Test Application

```bash
cd /var/www/recruitment

# Test run
npm run dev
```

**Open browser:** `http://your-vps-ip:5000`

If it works, press `Ctrl+C` to stop.

---

## 🔄 Setup PM2 (Production Process Manager)

```bash
# Install PM2 globally
sudo npm install -g pm2

# Start application with PM2
cd /var/www/recruitment
pm2 start npm --name "recruitment" -- run dev

# Save PM2 configuration
pm2 save

# Setup PM2 to start on boot
pm2 startup
# Copy and run the command it shows

# Check status
pm2 status
pm2 logs recruitment
```

**PM2 Commands:**
```bash
pm2 stop recruitment      # Stop app
pm2 restart recruitment   # Restart app
pm2 logs recruitment      # View logs
pm2 monit                # Monitor resources
```

---

## 🌐 Setup Nginx (Reverse Proxy)

```bash
# Install Nginx
sudo apt-get install -y nginx

# Create config file
sudo nano /etc/nginx/sites-available/recruitment
```

**Add this configuration:**
```nginx
server {
    listen 80;
    server_name your-domain.com;  # Change this!

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
    }
}
```

**Enable site:**
```bash
# Create symlink
sudo ln -s /etc/nginx/sites-available/recruitment /etc/nginx/sites-enabled/

# Test config
sudo nginx -t

# Restart Nginx
sudo systemctl restart nginx
```

**Now access:** `http://your-domain.com`

---

## 🔒 Setup SSL (HTTPS) with Let's Encrypt

```bash
# Install Certbot
sudo apt-get install -y certbot python3-certbot-nginx

# Get SSL certificate
sudo certbot --nginx -d your-domain.com

# Follow prompts, select "Redirect HTTP to HTTPS"

# Auto-renewal is setup automatically
# Test renewal:
sudo certbot renew --dry-run
```

**Now access:** `https://your-domain.com`

---

## 🔥 Setup Firewall

```bash
# Allow SSH, HTTP, HTTPS
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# Enable firewall
sudo ufw enable

# Check status
sudo ufw status
```

---

## 💾 Setup Automatic Database Backup

```bash
# Create backup script
sudo nano /usr/local/bin/backup-db.sh
```

**Add this:**
```bash
#!/bin/bash
BACKUP_DIR="/var/backups/recruitment"
DATE=$(date +%Y%m%d_%H%M%S)

mkdir -p $BACKUP_DIR
pg_dump recruitment_db > $BACKUP_DIR/db_$DATE.sql
find $BACKUP_DIR -name "*.sql" -mtime +7 -delete
```

**Make executable:**
```bash
sudo chmod +x /usr/local/bin/backup-db.sh
```

**Setup cron job (daily at 2 AM):**
```bash
sudo crontab -e
```

**Add this line:**
```
0 2 * * * /usr/local/bin/backup-db.sh
```

---

## 📊 Monitor Application

```bash
# View application logs
pm2 logs recruitment

# View Nginx logs
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log

# View PostgreSQL logs
sudo tail -f /var/log/postgresql/postgresql-*.log

# Check disk space
df -h

# Check memory
free -h

# Check processes
pm2 monit
```

---

## 🔄 Update Application

When you make changes in Replit and want to update VPS:

```bash
# 1. Download new code
cd /var/www/recruitment
git pull  # or upload new files

# 2. Install new dependencies (if any)
npm install

# 3. Update database (if schema changed)
# Export from Replit first, then:
sudo -u postgres psql recruitment_db < new_database_backup.sql

# 4. Restart application
pm2 restart recruitment

# 5. Check logs
pm2 logs recruitment
```

---

## ⚠️ Troubleshooting

### Database connection error
```bash
# Check PostgreSQL is running
sudo systemctl status postgresql

# Check database exists
sudo -u postgres psql -l | grep recruitment

# Test connection
sudo -u postgres psql recruitment_db -c "SELECT 1;"
```

### Port 5000 already in use
```bash
# Find process using port 5000
sudo lsof -i :5000

# Kill it
sudo kill -9 <PID>

# Or change port in .env:
PORT=3000
```

### npm install fails
```bash
# Clear npm cache
npm cache clean --force

# Remove node_modules and reinstall
rm -rf node_modules package-lock.json
npm install
```

### Permission errors
```bash
# Fix ownership
sudo chown -R $USER:$USER /var/www/recruitment

# Fix permissions
chmod -R 755 /var/www/recruitment
```

---

## 📋 Complete Checklist

- [ ] PostgreSQL installed and running
- [ ] Node.js 20 installed
- [ ] Database created
- [ ] SQL file imported successfully
- [ ] .env file configured
- [ ] npm packages installed
- [ ] uploads folder copied
- [ ] Application runs with `npm run dev`
- [ ] PM2 installed and configured
- [ ] Nginx installed and configured
- [ ] SSL certificate installed
- [ ] Firewall configured
- [ ] Automatic backups setup
- [ ] Application accessible via domain

---

## 🎯 Quick Commands Summary

```bash
# Start application
pm2 start recruitment

# Stop application
pm2 stop recruitment

# Restart application
pm2 restart recruitment

# View logs
pm2 logs recruitment

# Restart Nginx
sudo systemctl restart nginx

# Database backup
pg_dump recruitment_db > backup.sql

# Restore database
psql recruitment_db < backup.sql
```

---

## ✅ After Setup

Your application will be:
- ✅ Running 24/7 with PM2
- ✅ Accessible via your domain
- ✅ Secured with HTTPS
- ✅ Protected by firewall
- ✅ Auto-backed up daily
- ✅ Same exactly as Replit database

**Your recruitment system is now live on production VPS!** 🚀
