#!/bin/bash

# ============================================
# Production Deployment Script - Updated
# Run this on your production server
# Supports HTTP-only deployment (no SSL)
# ============================================

set -e  # Exit on any error

echo "🚀 Starting Production Deployment..."
echo "===================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
APP_NAME="lelangExtension"
APP_DIR="/var/www/${APP_NAME}"
NGINX_CONF="/etc/nginx/sites-available/${APP_NAME}"
DOMAIN="assistbid.id"
USER="lelangbot"

# Check if running as root
if [ "$EUID" -ne 0 ]; then 
    echo -e "${RED}❌ Please run as root (use sudo)${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Running as root${NC}"

# ============================================
# 1. System Update & Dependencies
# ============================================

echo ""
echo "📦 Step 1: Updating system and installing dependencies..."

apt-get update
apt-get upgrade -y

# Install essential packages
apt-get install -y \
    curl \
    git \
    nginx \
    ufw \
    build-essential \
    wget \
    unzip

echo -e "${GREEN}✅ System updated and dependencies installed${NC}"

# ============================================
# 2. Install Node.js (LTS)
# ============================================

echo ""
echo "📦 Step 2: Installing Node.js..."

# Check if Node.js is already installed
if command -v node > /dev/null 2>&1; then
    echo -e "${YELLOW}Node.js already installed: $(node -v)${NC}"
else
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
    apt-get install -y nodejs
    echo -e "${GREEN}✅ Node.js installed: $(node -v)${NC}"
fi

# Install npm globally
npm install -g npm@latest
npm install -g pm2

echo -e "${GREEN}✅ npm version: $(npm -v)${NC}"
echo -e "${GREEN}✅ PM2 installed${NC}"

# ============================================
# 3. Create Application Directory
# ============================================

echo ""
echo "📁 Step 3: Setting up application directory..."

# Create user if not exists
if ! id -u ${USER} > /dev/null 2>&1; then
    useradd -r -s /bin/bash -d ${APP_DIR} ${USER}
    echo -e "${GREEN}✅ User ${USER} created${NC}"
fi

# Create directory if not exists
mkdir -p ${APP_DIR}
mkdir -p ${APP_DIR}/logs
mkdir -p /var/www/certbot

# Set permissions
chown -R ${USER}:${USER} ${APP_DIR}
chmod -R 755 ${APP_DIR}

echo -e "${GREEN}✅ Application directory created: ${APP_DIR}${NC}"

# ============================================
# 4. Clone or Update Repository
# ============================================

echo ""
echo "📥 Step 4: Deploying application code..."

read -p "Git repository URL (or press Enter to skip): " REPO_URL

if [ ! -z "$REPO_URL" ]; then
    if [ -d "${APP_DIR}/.git" ]; then
        echo "Updating existing repository..."
        cd ${APP_DIR}
        sudo -u ${USER} git pull origin main
    else
        echo "Cloning repository..."
        sudo -u ${USER} git clone ${REPO_URL} ${APP_DIR}
        cd ${APP_DIR}
    fi
    echo -e "${GREEN}✅ Repository deployed${NC}"
else
    echo -e "${YELLOW}⚠️  Skipping git clone. Files should already be in ${APP_DIR}${NC}"
fi

# ============================================
# 5. Install Application Dependencies
# ============================================

echo ""
echo "📦 Step 5: Installing application dependencies..."

cd ${APP_DIR}

# Install server dependencies
if [ -d "server" ]; then
    cd server
    sudo -u ${USER} npm install --production
    cd ..
    echo -e "${GREEN}✅ Server dependencies installed${NC}"
fi

# ============================================
# 6. Configure Environment
# ============================================

echo ""
echo "🔐 Step 6: Setting up environment configuration..."

if [ ! -f "${APP_DIR}/server/config.env" ]; then
    echo -e "${YELLOW}⚠️  config.env not found. Creating from template...${NC}"
    
    read -p "Enter your Telegram Bot Token: " BOT_TOKEN
    read -p "Enter your domain (press Enter for ${DOMAIN}): " DOMAIN_INPUT
    DOMAIN=${DOMAIN_INPUT:-$DOMAIN}
    
    cat > ${APP_DIR}/server/config.env << EOF
NODE_ENV=production
PORT=3000
BOT_TOKEN='${BOT_TOKEN}'
LOG_LEVEL=info
CORS_ORIGIN=http://${DOMAIN}
TZ=Asia/Jakarta
EOF
    
    echo -e "${GREEN}✅ config.env created${NC}"
else
    echo -e "${GREEN}✅ config.env already exists${NC}"
fi

# Set correct permissions
chown ${USER}:${USER} ${APP_DIR}/server/config.env
chmod 600 ${APP_DIR}/server/config.env

# ============================================
# 7. Configure Nginx (HTTP Only)
# ============================================

echo ""
echo "🌐 Step 7: Configuring Nginx (HTTP Only)..."

read -p "Enter your domain (press Enter for ${DOMAIN}): " DOMAIN_INPUT
DOMAIN=${DOMAIN_INPUT:-$DOMAIN}

# Create HTTP-only nginx config
cat > ${NGINX_CONF} << 'NGINXCONF'
# ============================================
# Nginx Configuration - HTTP Only (No SSL)
# ============================================

# Upstream configuration
upstream lelang_bot_backend {
    least_conn;
    server 127.0.0.1:3000 weight=1 max_fails=3 fail_timeout=30s;
    keepalive 32;
}

# Rate limiting zones
limit_req_zone $binary_remote_addr zone=api_limit:10m rate=10r/s;
limit_req_zone $binary_remote_addr zone=general_limit:10m rate=50r/s;

# HTTP Server
server {
    listen 80;
    listen [::]:80;
    server_name DOMAIN_PLACEHOLDER www.DOMAIN_PLACEHOLDER;
    
    # Logging
    access_log /var/log/nginx/lelangbot_access.log;
    error_log /var/log/nginx/lelangbot_error.log warn;
    
    # Root directory
    root /var/www/lelangExtension;
    
    # Client settings
    client_max_body_size 20M;
    client_body_timeout 60s;
    client_header_timeout 60s;
    
    # Gzip Compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_proxied any;
    gzip_comp_level 6;
    gzip_types text/plain text/css text/xml text/javascript 
               application/json application/javascript application/xml+rss 
               application/rss+xml font/truetype font/opentype 
               application/vnd.ms-fontobject image/svg+xml;
    
    # API Routes (with rate limiting)
    location /api/ {
        limit_req zone=api_limit burst=20 nodelay;
        limit_req_status 429;
        
        proxy_pass http://lelang_bot_backend;
        proxy_http_version 1.1;
        
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
        
        proxy_buffering off;
        proxy_cache_bypass $http_upgrade;
    }
    
    # Health check endpoint (no rate limit)
    location /health {
        proxy_pass http://lelang_bot_backend;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        access_log off;
    }
    
    # Main proxy (general rate limiting)
    location / {
        limit_req zone=general_limit burst=100 nodelay;
        
        proxy_pass http://lelang_bot_backend;
        proxy_http_version 1.1;
        
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
        
        proxy_buffering off;
        proxy_cache_bypass $http_upgrade;
    }
    
    # Deny access to hidden files
    location ~ /\. {
        deny all;
        access_log off;
        log_not_found off;
    }
    
    # Favicon and robots
    location = /favicon.ico {
        log_not_found off;
        access_log off;
    }
    
    location = /robots.txt {
        log_not_found off;
        access_log off;
    }
}
NGINXCONF

# Replace domain placeholder
sed -i "s/DOMAIN_PLACEHOLDER/${DOMAIN}/g" ${NGINX_CONF}

# Create symbolic link
ln -sf ${NGINX_CONF} /etc/nginx/sites-enabled/

# Remove default nginx site
rm -f /etc/nginx/sites-enabled/default

# Test nginx configuration
if nginx -t; then
    echo -e "${GREEN}✅ Nginx configured successfully (HTTP only)${NC}"
else
    echo -e "${RED}❌ Nginx configuration test failed${NC}"
    echo "Check error above and fix manually"
    exit 1
fi

# ============================================
# 8. SSL Setup (Skipped)
# ============================================

echo ""
echo "🔒 Step 8: SSL Setup - SKIPPED"
echo -e "${YELLOW}ℹ️  Running in HTTP-only mode${NC}"
echo -e "${YELLOW}ℹ️  To add SSL later, run: sudo certbot --nginx -d ${DOMAIN}${NC}"

# ============================================
# 9. Configure Firewall (HTTP Only)
# ============================================

echo ""
echo "🔥 Step 9: Configuring firewall (HTTP only)..."

# Enable UFW
ufw --force enable

# Allow SSH
ufw allow 22/tcp

# Allow HTTP only (no HTTPS)
ufw allow 80/tcp

# Check status
echo ""
echo "Firewall Status:"
ufw status

echo -e "${GREEN}✅ Firewall configured (HTTP only)${NC}"

# ============================================
# 10. Start Application with PM2
# ============================================

echo ""
echo "🚀 Step 10: Starting application with PM2..."

cd ${APP_DIR}

# Stop if already running
sudo -u ${USER} pm2 delete ${APP_NAME} 2>/dev/null || true

# Start application
sudo -u ${USER} pm2 start ecosystem.config.js --env production

# Save PM2 process list
sudo -u ${USER} pm2 save

# Setup PM2 startup script
env PATH=$PATH:/usr/bin pm2 startup systemd -u ${USER} --hp ${APP_DIR}

# Install PM2 log rotate
sudo -u ${USER} pm2 install pm2-logrotate
sudo -u ${USER} pm2 set pm2-logrotate:max_size 50M
sudo -u ${USER} pm2 set pm2-logrotate:retain 7

echo -e "${GREEN}✅ Application started with PM2${NC}"

# ============================================
# 11. Start Nginx
# ============================================

echo ""
echo "🌐 Step 11: Starting Nginx..."

systemctl enable nginx
systemctl restart nginx

echo -e "${GREEN}✅ Nginx started${NC}"

# ============================================
# 12. Health Check
# ============================================

echo ""
echo "🏥 Step 12: Running health checks..."

sleep 5

# Check PM2 status
echo "PM2 Status:"
sudo -u ${USER} pm2 status

# Check Nginx status
echo ""
echo "Nginx Status:"
systemctl status nginx --no-pager | head -10

# Check if app is responding
echo ""
echo "Testing application health..."
sleep 2

if curl -sf http://localhost:3000/health > /dev/null; then
    echo -e "${GREEN}✅ Application is healthy!${NC}"
else
    echo -e "${RED}❌ Application health check failed${NC}"
    echo "Checking logs..."
    sudo -u ${USER} pm2 logs ${APP_NAME} --lines 20 --nostream
fi

# ============================================
# 13. Final Instructions
# ============================================

echo ""
echo "╔════════════════════════════════════════╗"
echo "║   🎉 DEPLOYMENT COMPLETED!             ║"
echo "╚════════════════════════════════════════╝"
echo ""
echo -e "${GREEN}✅ Your application is now running!${NC}"
echo ""
echo "📋 Important Information:"
echo "• App Directory: ${APP_DIR}"
echo "• Domain (HTTP): http://${DOMAIN}"
echo "• IP: http://$(curl -s ifconfig.me 2>/dev/null || echo 'YOUR_IP')"
echo "• User: ${USER}"
echo "• PM2 Status: sudo -u ${USER} pm2 status"
echo "• PM2 Logs: sudo -u ${USER} pm2 logs ${APP_NAME}"
echo "• Nginx Config: ${NGINX_CONF}"
echo "• Nginx Logs: /var/log/nginx/"
echo ""
echo "🔧 Useful Commands (as ${USER}):"
echo "• Restart App: pm2 restart ${APP_NAME}"
echo "• Stop App: pm2 stop ${APP_NAME}"
echo "• View Logs: pm2 logs ${APP_NAME}"
echo "• Monitor: pm2 monit"
echo ""
echo "🔧 Useful Commands (as root):"
echo "• Reload Nginx: systemctl reload nginx"
echo "• Test Nginx: nginx -t"
echo "• View Nginx logs: tail -f /var/log/nginx/lelangbot_error.log"
echo ""
echo "🔒 Security Setup:"
echo "• Next: Run ./security-hardening.sh"
echo "• Change SSH port from default (22)"
echo "• Setup SSH key authentication"
echo "• Disable root login"
echo ""
echo "🔐 Add SSL Later (Optional):"
echo "  sudo apt install certbot python3-certbot-nginx"
echo "  sudo certbot --nginx -d ${DOMAIN} -d www.${DOMAIN}"
echo ""
echo "📱 Next Steps:"
echo "1. Test: http://${DOMAIN}/health"
echo "2. Test bot: Send /start to your Telegram bot"
echo "3. Setup monitoring (Uptime Robot)"
echo "4. Configure cron jobs: crontab -e"
echo "5. Run security hardening: ./security-hardening.sh"
echo ""
echo "🆘 Troubleshooting:"
echo "• Logs: sudo -u ${USER} pm2 logs ${APP_NAME}"
echo "• Status: sudo -u ${USER} pm2 status"
echo "• Restart: sudo -u ${USER} pm2 restart ${APP_NAME}"
echo "• Nginx: sudo nginx -t && sudo systemctl restart nginx"
echo ""

# Create deployment log
echo "Deployment completed at $(date)" >> ${APP_DIR}/logs/deployment.log
echo "Deployment mode: HTTP only (no SSL)" >> ${APP_DIR}/logs/deployment.log
echo "Domain: ${DOMAIN}" >> ${APP_DIR}/logs/deployment.log