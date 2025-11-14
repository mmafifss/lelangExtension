# 🚀 Production Deployment Guide - Lelang Bot System

## 📋 Pre-Deployment Checklist

- [ ] VPS purchased (DigitalOcean/Vultr recommended)
- [ ] Domain registered and DNS configured
- [ ] Bot token obtained from @BotFather
- [ ] SSH access to server
- [ ] Git repository ready (optional but recommended)

---

## 🎯 Step-by-Step Deployment

### 1️⃣ Initial Server Setup

```bash
# SSH into your server
ssh root@YOUR_SERVER_IP

# Update system
apt-get update && apt-get upgrade -y

# Create deployment directory
mkdir -p /var/www/lelangbot
cd /var/www/lelangbot
```

### 2️⃣ Upload Files to Server

**Option A: Using Git (Recommended)**
```bash
# Clone your repository
git clone https://github.com/yourusername/lelang-bot.git /var/www/lelangbot
```

**Option B: Using SCP**
```bash
# From your local machine
scp -r /path/to/lelangExtension/* root@YOUR_SERVER_IP:/var/www/lelangbot/
```

**Option C: Using SFTP**
```bash
# Use FileZilla or WinSCP
# Connect to: YOUR_SERVER_IP
# Upload all files to /var/www/lelangbot/
```

### 3️⃣ Run Deployment Script

```bash
cd /var/www/lelangbot

# Make scripts executable
chmod +x *.sh

# Run deployment script
sudo ./deploy-production.sh
```

Follow the prompts:
- Enter your Git repository URL (or skip)
- Enter your Telegram Bot Token
- Enter your domain name
- Choose whether to setup SSL
- Enter email for SSL certificate

### 4️⃣ Configure Environment

Edit config file:
```bash
nano /var/www/lelangbot/server/config.env
```

Ensure these are set correctly:
```env
BOT_TOKEN='YOUR_ACTUAL_BOT_TOKEN'
NODE_ENV=production
PORT=3000
TZ=Asia/Jakarta
```

### 5️⃣ Test Application

```bash
# Check PM2 status
pm2 status

# View logs
pm2 logs lelangbot

# Check if app is responding
curl http://localhost:3000/health
```

Expected output: `{"status":"healthy"...}`

### 6️⃣ Configure Domain DNS

In your domain registrar (Namecheap, Cloudflare, etc.):

**Add A Records:**
```
Type: A
Name: @
Value: YOUR_SERVER_IP
TTL: 3600

Type: A
Name: www
Value: YOUR_SERVER_IP
TTL: 3600
```

Wait 5-60 minutes for DNS propagation.

### 7️⃣ Setup SSL Certificate

```bash
# Install Let's Encrypt certificate
certbot --nginx -d lelangbot.com -d www.lelangbot.com

# Test auto-renewal
certbot renew --dry-run
```

### 8️⃣ Security Hardening

```bash
# Run security hardening script
sudo ./security-hardening.sh
```

Follow prompts for:
- Creating non-root user
- Changing SSH port
- Installing Fail2Ban
- etc.

### 9️⃣ Setup Monitoring

```bash
# Make health check executable
chmod +x health-check.sh

# Install cron jobs
crontab -e
```

Paste contents from `crontab-config.txt`

### 🔟 Final Verification

**Check all services:**
```bash
# PM2
pm2 status

# Nginx
systemctl status nginx

# Firewall
ufw status

# Fail2Ban
fail2ban-client status
```

**Test from browser:**
- Visit: https://lelangbot.com/health
- Should show: `{"status":"healthy"}`

**Test Telegram Bot:**
- Open Telegram
- Search for your bot
- Send `/start`
- Should receive welcome message

---

## 🔧 Post-Deployment Configuration

### Setup Monitoring (Uptime Robot)

1. Go to: https://uptimerobot.com
2. Create free account
3. Add monitor:
   - Type: HTTP(s)
   - URL: https://lelangbot.com/health
   - Interval: 5 minutes
   - Alert: Email/SMS

### Setup Log Rotation

```bash
# Install logrotate config
cat > /etc/logrotate.d/lelangbot << 'EOF'
/var/www/lelangbot/logs/*.log {
    daily
    missingok
    rotate 7
    compress
    delaycompress
    notifempty
    create 0640 www-data www-data
    sharedscripts
    postrotate
        pm2 reloadLogs
    endscript
}
EOF
```

### Setup Backup

```bash
# Create backup script
cat > /var/www/lelangbot/backup.sh << 'EOF'
#!/bin/bash
BACKUP_DIR="/var/backups/lelangbot"
DATE=$(date +%Y%m%d)

mkdir -p ${BACKUP_DIR}

# Backup code
tar -czf ${BACKUP_DIR}/code-${DATE}.tar.gz /var/www/lelangbot

# Backup logs
tar -czf ${BACKUP_DIR}/logs-${DATE}.tar.gz /var/www/lelangbot/logs

# Remove backups older than 30 days
find ${BACKUP_DIR} -name "*.tar.gz" -mtime +30 -delete
EOF

chmod +x /var/www/lelangbot/backup.sh

# Add to crontab (daily at 2 AM)
echo "0 2 * * * /var/www/lelangbot/backup.sh" | crontab -
```

---

## 📊 Monitoring & Maintenance

### Daily Checks

```bash
# Check PM2 status
pm2 status

# View recent logs
pm2 logs lelangbot --lines 50

# Check system resources
htop

# Check disk space
df -h

# Check memory
free -h
```

### Weekly Checks

```bash
# Check for updates
apt-get update
apt-get upgrade

# Check SSL certificate expiry
certbot certificates

# Review Fail2Ban logs
fail2ban-client status sshd

# Check Nginx error logs
tail -100 /var/log/nginx/error.log
```

### Monthly Checks

```bash
# Review all logs
cd /var/www/lelangbot/logs
ls -lh

# Security audit
lynis audit system

# Check for rootkits
rkhunter --check

# Review firewall rules
ufw status verbose
```

---

## 🚨 Troubleshooting

### Bot Not Responding

```bash
# Check PM2
pm2 status

# If stopped, restart
pm2 restart lelangbot

# Check logs for errors
pm2 logs lelangbot --lines 100
```

### High CPU Usage

```bash
# Check processes
htop

# Restart app
pm2 restart lelangbot

# Check for memory leaks
pm2 monit
```

### SSL Certificate Issues

```bash
# Renew certificate manually
certbot renew

# Check certificate status
certbot certificates

# Reload Nginx
systemctl reload nginx
```

### Database Connection Issues (if you add DB later)

```bash
# Check database status
systemctl status postgresql

# Restart database
systemctl restart postgresql

# Check connections
netstat -an | grep 5432
```

---

## 🔄 Update Procedure

### For Code Updates

```bash
# Method 1: Using update script
cd /var/www/lelangbot
./update.sh

# Method 2: Manual
git pull origin main
cd server && npm install --production
pm2 reload lelangbot
```

### For System Updates

```bash
# Update packages
apt-get update
apt-get upgrade

# Reboot if kernel updated
reboot
```

---

## 💰 Cost Estimation

**Monthly Costs:**
- VPS (DigitalOcean): $24/month
- Domain (.com): ~$1/month ($12/year)
- SSL Certificate: FREE (Let's Encrypt)
- Monitoring (Uptime Robot): FREE
- **Total: ~$25/month**

**Budget Alternative:**
- VPS (Contabo): $8.5/month
- Domain (.id): ~$10/year
- **Total: ~$9.5/month**

---

## 🎯 Performance Optimization

### Enable Nginx Caching

```nginx
# Add to nginx config
proxy_cache_path /var/cache/nginx levels=1:2 keys_zone=api_cache:10m max_size=100m inactive=60m;

location /api/ {
    proxy_cache api_cache;
    proxy_cache_valid 200 1m;
    proxy_cache_key $request_uri;
    add_header X-Cache-Status $upstream_cache_status;
    # ... rest of proxy config
}
```

### PM2 Cluster Mode Optimization

```javascript
// In ecosystem.config.js
instances: 'max',  // Use all CPU cores
exec_mode: 'cluster'
```

### Database Optimization (if added)

```bash
# Increase PostgreSQL connections
# Edit /etc/postgresql/*/main/postgresql.conf
max_connections = 100
shared_buffers = 256MB
effective_cache_size = 1GB
```

---

## 📞 Support & Resources

**Documentation:**
- PM2: https://pm2.keymetrics.io/docs/
- Nginx: https://nginx.org/en/docs/
- Let's Encrypt: https://letsencrypt.org/docs/
- UFW: https://help.ubuntu.com/community/UFW

**Community:**
- Stack Overflow: Tag questions with `telegram-bot-api`, `pm2`, `nginx`
- PM2 Community: https://github.com/Unitech/pm2
- Telegram Bot API: https://core.telegram.org/bots/api

**Monitoring Tools:**
- Uptime Robot: https://uptimerobot.com
- Grafana: https://grafana.com
- New Relic: https://newrelic.com

---

## ✅ Deployment Complete!

Your Lelang Bot is now running in production with:
- ✅ PM2 process management
- ✅ Nginx reverse proxy
- ✅ SSL encryption
- ✅ Firewall protection
- ✅ Automatic restarts
- ✅ Log rotation
- ✅ Health monitoring
- ✅ Security hardening

**Next steps:**
1. Test all bot commands
2. Monitor logs for 24 hours
3. Setup alerting
4. Document your specific configurations
5. Create runbook for common issues

Good luck with your production deployment! 🚀