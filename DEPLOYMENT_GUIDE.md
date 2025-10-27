# VPS Deployment Guide - Recruitment Management System

## Table of Contents
1. [Database Information](#database-information)
2. [System Requirements](#system-requirements)
3. [Pre-Deployment Setup](#pre-deployment-setup)
4. [Database Setup](#database-setup)
5. [Application Deployment](#application-deployment)
6. [Environment Configuration](#environment-configuration)
7. [Process Management](#process-management)
8. [Web Server Configuration](#web-server-configuration)
9. [SSL/TLS Setup](#ssltls-setup)
10. [Post-Deployment](#post-deployment)
11. [Maintenance & Monitoring](#maintenance--monitoring)

---

## Database Information

### Database Used
- **Database:** PostgreSQL 14+ (recommended PostgreSQL 15 or 16)
- **ORM:** Drizzle ORM (type-safe, lightweight)
- **Connection Pool:** `pg` (node-postgres)
- **Migration Tool:** Drizzle Kit (push-based migrations)

### Database Features
- Session storage (PostgreSQL-backed sessions)
- Full-text search capabilities
- JSONB for flexible data structures
- UUID primary keys
- Automatic timestamps
- Foreign key relationships with cascading deletes

---

## System Requirements

### Minimum Requirements
- **OS:** Ubuntu 20.04 LTS or newer (Ubuntu 22.04 LTS recommended)
- **CPU:** 2 cores
- **RAM:** 4 GB
- **Storage:** 50 GB SSD
- **Network:** Static IP or domain name

### Recommended Requirements
- **OS:** Ubuntu 22.04 LTS
- **CPU:** 4+ cores
- **RAM:** 8+ GB
- **Storage:** 100+ GB SSD
- **Network:** Domain with DNS configured

### Software Requirements
- Node.js 20.x LTS
- PostgreSQL 15+
- Nginx (reverse proxy)
- PM2 (process manager)
- Certbot (SSL certificates)
- Git

---

## Pre-Deployment Setup

### 1. Update System
```bash
sudo apt update && sudo apt upgrade -y
```

### 2. Install Node.js 20.x
```bash
# Install Node.js 20.x LTS
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Verify installation
node --version  # Should show v20.x.x
npm --version
```

### 3. Install PostgreSQL 15
```bash
# Add PostgreSQL APT repository
sudo sh -c 'echo "deb http://apt.postgresql.org/pub/repos/apt $(lsb_release -cs)-pgdg main" > /etc/apt/sources.list.d/pgdg.list'
wget --quiet -O - https://www.postgresql.org/media/keys/ACCC4CF8.asc | sudo apt-key add -

# Install PostgreSQL
sudo apt update
sudo apt install -y postgresql-15 postgresql-contrib-15

# Verify installation
sudo systemctl status postgresql
```

### 4. Install PM2 (Process Manager)
```bash
sudo npm install -g pm2
pm2 --version
```

### 5. Install Nginx
```bash
sudo apt install -y nginx
sudo systemctl status nginx
```

### 6. Install Certbot (for SSL)
```bash
sudo apt install -y certbot python3-certbot-nginx
```

### 7. Install Build Tools (for native dependencies)
```bash
sudo apt install -y build-essential python3 git
```

---

## Database Setup

### 1. Create Database and User
```bash
# Switch to postgres user
sudo -u postgres psql

# Inside PostgreSQL prompt, run:
CREATE DATABASE recruitment_db;
CREATE USER recruitment_user WITH ENCRYPTED PASSWORD 'your_secure_password_here';
GRANT ALL PRIVILEGES ON DATABASE recruitment_db TO recruitment_user;

# PostgreSQL 15+ requires additional permissions
\c recruitment_db
GRANT ALL ON SCHEMA public TO recruitment_user;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO recruitment_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO recruitment_user;

# Exit PostgreSQL
\q
```

### 2. Configure PostgreSQL for Remote Access (if needed)
```bash
# Edit postgresql.conf
sudo nano /etc/postgresql/15/main/postgresql.conf

# Find and modify:
listen_addresses = 'localhost'  # Keep as localhost for local access only

# Edit pg_hba.conf
sudo nano /etc/postgresql/15/main/pg_hba.conf

# Add this line (local connections only for security):
local   recruitment_db    recruitment_user                    scram-sha-256

# Restart PostgreSQL
sudo systemctl restart postgresql
```

### 3. Test Database Connection
```bash
psql -U recruitment_user -d recruitment_db -h localhost
# Enter your password when prompted
# If successful, you'll see the PostgreSQL prompt
\q
```

---

## Application Deployment

### 1. Create Application User
```bash
# Create a dedicated user for the application
sudo adduser --system --group --home /opt/recruitment recruitment

# Switch to the application user
sudo su - recruitment
```

### 2. Clone the Repository
```bash
# If using Git (recommended)
cd /opt/recruitment
git clone https://github.com/your-username/your-repo.git app
cd app

# OR copy files from your local machine using SCP:
# From your local machine:
# scp -r /path/to/project user@your-vps-ip:/opt/recruitment/app
```

### 3. Install Dependencies
```bash
cd /opt/recruitment/app

# Install Node.js dependencies
npm install --production

# Install dev dependencies (needed for build)
npm install
```

### 4. Create Environment File
```bash
# Copy example env file
cp .env.example .env

# Edit environment variables
nano .env
```

---

## Environment Configuration

### Complete .env File Configuration
```bash
# Node Environment
NODE_ENV=production
PORT=5000

# Database Configuration - PostgreSQL
DATABASE_URL=postgresql://recruitment_user:your_secure_password_here@localhost:5432/recruitment_db
PGHOST=localhost
PGPORT=5432
PGUSER=recruitment_user
PGPASSWORD=your_secure_password_here
PGDATABASE=recruitment_db

# Session Security
# Generate a strong random key: openssl rand -base64 64
SESSION_SECRET=your_very_long_random_secret_key_at_least_64_characters_long_replace_this

# Admin User (Initial Setup)
ADMIN_EMAIL=admin@yourdomain.com
ADMIN_PASSWORD=change_this_after_first_login

# Email Configuration - cPanel
CPANEL_EMAIL_USER=noreply@yourdomain.com
CPANEL_EMAIL_PASSWORD=your-email-password
CPANEL_EMAIL_HOST=mail.yourdomain.com
CPANEL_IMAP_PORT=993
CPANEL_SMTP_PORT=465

# Email Configuration - Gmail (Alternative)
# If using Gmail, generate an app password from Google Account settings
GMAIL_USER=your-gmail@gmail.com
GMAIL_PASSWORD=your-gmail-app-password

# File Upload Configuration
UPLOAD_DIR=/opt/recruitment/app/uploads
MAX_FILE_SIZE=10485760

# Application URL (after SSL setup)
APP_URL=https://yourdomain.com
```

### Generate Session Secret
```bash
# Generate a secure session secret
openssl rand -base64 64
# Copy the output and paste it into SESSION_SECRET in .env
```

---

## Build and Database Setup

### 1. Build the Application
```bash
cd /opt/recruitment/app

# Build frontend and backend
npm run build

# This creates:
# - dist/ folder with compiled backend
# - dist/public/ folder with frontend assets
```

### 2. Initialize Database Schema
```bash
# Push database schema to PostgreSQL
npm run db:push

# If you get a warning about data loss (first time setup), force it:
npm run db:push -- --force
```

### 3. Create Required Directories
```bash
# Create uploads and WhatsApp directories
mkdir -p /opt/recruitment/app/uploads
mkdir -p /opt/recruitment/app/uploads/whatsapp-media
mkdir -p /opt/recruitment/app/whatsapp_auth

# Set permissions
chmod 755 /opt/recruitment/app/uploads
chmod 755 /opt/recruitment/app/whatsapp_auth
```

---

## Process Management

### 1. Create PM2 Ecosystem File
```bash
nano /opt/recruitment/app/ecosystem.config.js
```

```javascript
module.exports = {
  apps: [{
    name: 'recruitment-rms',
    script: './dist/index.js',
    instances: 1,
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'production',
      PORT: 5000
    },
    error_file: '/opt/recruitment/logs/error.log',
    out_file: '/opt/recruitment/logs/out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    merge_logs: true,
    autorestart: true,
    max_restarts: 10,
    min_uptime: '10s',
    max_memory_restart: '1G',
    watch: false,
    ignore_watch: ['node_modules', 'uploads', 'whatsapp_auth', 'logs']
  }]
};
```

### 2. Create Logs Directory
```bash
mkdir -p /opt/recruitment/logs
```

### 3. Start Application with PM2
```bash
# Start the application
pm2 start ecosystem.config.js

# Save PM2 configuration
pm2 save

# Setup PM2 to start on system boot
pm2 startup systemd -u recruitment --hp /opt/recruitment
# Copy and run the command that PM2 outputs
```

### 4. Monitor Application
```bash
# View logs
pm2 logs recruitment-rms

# Monitor processes
pm2 monit

# Check status
pm2 status

# Restart app
pm2 restart recruitment-rms

# Stop app
pm2 stop recruitment-rms
```

---

## Web Server Configuration

### 1. Create Nginx Configuration
```bash
# Exit from recruitment user
exit

# Create Nginx config
sudo nano /etc/nginx/sites-available/recruitment
```

```nginx
# Redirect HTTP to HTTPS
server {
    listen 80;
    listen [::]:80;
    server_name yourdomain.com www.yourdomain.com;
    
    # Let's Encrypt SSL verification
    location /.well-known/acme-challenge/ {
        root /var/www/html;
    }
    
    # Redirect all other traffic to HTTPS
    location / {
        return 301 https://$server_name$request_uri;
    }
}

# HTTPS Server
server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name yourdomain.com www.yourdomain.com;

    # SSL Configuration (will be added by Certbot)
    ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;
    include /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;

    # Security Headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "no-referrer-when-downgrade" always;

    # Client max body size (for file uploads)
    client_max_body_size 50M;

    # Logs
    access_log /var/log/nginx/recruitment-access.log;
    error_log /var/log/nginx/recruitment-error.log;

    # Proxy to Node.js application
    location / {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        
        # WebSocket support
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        
        # Headers
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # Timeouts
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }

    # Static files (uploads)
    location /uploads/ {
        alias /opt/recruitment/app/uploads/;
        expires 30d;
        add_header Cache-Control "public, immutable";
    }
}
```

### 2. Enable Site and Test Configuration
```bash
# Create symbolic link
sudo ln -s /etc/nginx/sites-available/recruitment /etc/nginx/sites-enabled/

# Test Nginx configuration
sudo nginx -t

# If test passes, reload Nginx
sudo systemctl reload nginx
```

---

## SSL/TLS Setup

### 1. Obtain SSL Certificate with Certbot
```bash
# Make sure your domain points to your VPS IP address first!

# Obtain certificate
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com

# Follow the prompts:
# - Enter your email address
# - Agree to terms of service
# - Choose whether to redirect HTTP to HTTPS (recommended: yes)
```

### 2. Test SSL Auto-Renewal
```bash
# Certbot automatically sets up renewal
# Test the renewal process
sudo certbot renew --dry-run

# Certificate will auto-renew via systemd timer
sudo systemctl status certbot.timer
```

---

## Post-Deployment

### 1. Verify Application is Running
```bash
# Check PM2 status
pm2 status

# Check Nginx status
sudo systemctl status nginx

# Check application logs
pm2 logs recruitment-rms --lines 50

# Test application
curl http://localhost:5000/api/health
curl https://yourdomain.com
```

### 2. Access Application
- Open browser: `https://yourdomain.com`
- Login with admin credentials from .env:
  - Email: `admin@yourdomain.com` (or ADMIN_EMAIL value)
  - Password: `change_this_after_first_login` (or ADMIN_PASSWORD value)

### 3. Security Hardening

#### Enable Firewall
```bash
# Enable UFW
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'
sudo ufw enable

# Check status
sudo ufw status
```

#### Disable Root Login
```bash
sudo nano /etc/ssh/sshd_config

# Set these values:
PermitRootLogin no
PasswordAuthentication no  # If using SSH keys

# Restart SSH
sudo systemctl restart sshd
```

#### Set Up Automatic Security Updates
```bash
sudo apt install unattended-upgrades
sudo dpkg-reconfigure --priority=low unattended-upgrades
```

### 4. Create Admin User via CLI
```bash
# Connect to PostgreSQL
sudo -u postgres psql -d recruitment_db

# Create admin user manually (if needed)
-- Check existing users
SELECT id, email, "firstName", "lastName" FROM users;

# Exit
\q
```

---

## Maintenance & Monitoring

### Application Updates
```bash
# As recruitment user
sudo su - recruitment
cd /opt/recruitment/app

# Pull latest code
git pull origin main

# Install dependencies
npm install

# Build application
npm run build

# Push database changes (if any)
npm run db:push

# Restart application
pm2 restart recruitment-rms

# Check logs
pm2 logs recruitment-rms
```

### Database Backup
```bash
# Create backup script
sudo nano /usr/local/bin/backup-recruitment-db.sh
```

```bash
#!/bin/bash
BACKUP_DIR="/opt/recruitment/backups"
DATE=$(date +%Y%m%d_%H%M%S)
DB_NAME="recruitment_db"
DB_USER="recruitment_user"

mkdir -p $BACKUP_DIR

# Create backup
PGPASSWORD="your_password_here" pg_dump -U $DB_USER -h localhost $DB_NAME | gzip > $BACKUP_DIR/recruitment_db_$DATE.sql.gz

# Keep only last 30 days
find $BACKUP_DIR -name "recruitment_db_*.sql.gz" -mtime +30 -delete

echo "Backup completed: recruitment_db_$DATE.sql.gz"
```

```bash
# Make executable
sudo chmod +x /usr/local/bin/backup-recruitment-db.sh

# Create backups directory
sudo mkdir -p /opt/recruitment/backups
sudo chown recruitment:recruitment /opt/recruitment/backups

# Setup cron job for daily backups at 2 AM
sudo crontab -e

# Add this line:
0 2 * * * /usr/local/bin/backup-recruitment-db.sh >> /var/log/recruitment-backup.log 2>&1
```

### Restore from Backup
```bash
# Restore database from backup
PGPASSWORD="your_password_here" gunzip -c /opt/recruitment/backups/recruitment_db_YYYYMMDD_HHMMSS.sql.gz | psql -U recruitment_user -h localhost recruitment_db
```

### Log Rotation
```bash
# Create logrotate configuration
sudo nano /etc/logrotate.d/recruitment
```

```
/opt/recruitment/logs/*.log {
    daily
    missingok
    rotate 14
    compress
    delaycompress
    notifempty
    create 0640 recruitment recruitment
    sharedscripts
    postrotate
        pm2 reloadLogs
    endscript
}
```

### Monitoring Commands
```bash
# System resources
htop
df -h
free -h

# Application status
pm2 status
pm2 monit

# Database connections
sudo -u postgres psql -c "SELECT count(*) FROM pg_stat_activity WHERE datname='recruitment_db';"

# Nginx access logs
sudo tail -f /var/log/nginx/recruitment-access.log

# Application logs
pm2 logs recruitment-rms --lines 100
```

---

## Troubleshooting

### Application Won't Start
```bash
# Check PM2 logs
pm2 logs recruitment-rms

# Check if port is in use
sudo lsof -i :5000

# Check database connection
sudo -u recruitment psql -U recruitment_user -h localhost -d recruitment_db
```

### Database Connection Issues
```bash
# Check PostgreSQL status
sudo systemctl status postgresql

# Check PostgreSQL logs
sudo tail -f /var/log/postgresql/postgresql-15-main.log

# Test connection
PGPASSWORD="your_password" psql -U recruitment_user -h localhost -d recruitment_db
```

### SSL Certificate Issues
```bash
# Check certificate status
sudo certbot certificates

# Renew manually
sudo certbot renew

# Check Nginx config
sudo nginx -t
```

### High Memory Usage
```bash
# Check PM2 processes
pm2 monit

# Restart app
pm2 restart recruitment-rms

# Check for memory leaks in logs
pm2 logs recruitment-rms | grep -i memory
```

---

## Performance Optimization

### PostgreSQL Tuning
```bash
sudo nano /etc/postgresql/15/main/postgresql.conf

# Recommended settings for 8GB RAM server:
shared_buffers = 2GB
effective_cache_size = 6GB
maintenance_work_mem = 512MB
checkpoint_completion_target = 0.9
wal_buffers = 16MB
default_statistics_target = 100
random_page_cost = 1.1
effective_io_concurrency = 200
work_mem = 10MB
min_wal_size = 1GB
max_wal_size = 4GB

# Restart PostgreSQL
sudo systemctl restart postgresql
```

### Nginx Caching
```bash
# Add to nginx config (inside http block)
sudo nano /etc/nginx/nginx.conf

# Add:
proxy_cache_path /var/cache/nginx levels=1:2 keys_zone=app_cache:10m max_size=1g inactive=60m use_temp_path=off;
```

---

## Support & Additional Resources

### Useful Commands Cheat Sheet
```bash
# PM2
pm2 list                    # List all processes
pm2 restart all             # Restart all apps
pm2 stop all                # Stop all apps
pm2 delete all              # Delete all apps
pm2 logs --lines 200        # Show last 200 log lines

# Database
sudo -u postgres psql       # Access PostgreSQL as postgres user
\l                          # List databases
\c database_name            # Connect to database
\dt                         # List tables
\du                         # List users

# Nginx
sudo nginx -t               # Test config
sudo systemctl reload nginx # Reload config
sudo systemctl restart nginx # Restart nginx

# System
sudo systemctl status service_name
sudo journalctl -u service_name -f
```

### Documentation Links
- Node.js: https://nodejs.org/docs/
- PostgreSQL: https://www.postgresql.org/docs/
- Drizzle ORM: https://orm.drizzle.team/docs/overview
- PM2: https://pm2.keymetrics.io/docs/
- Nginx: https://nginx.org/en/docs/

---

## License
This deployment guide is part of the Recruitment Management System project.
