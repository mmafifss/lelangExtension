#!/bin/bash

# ============================================
# Production Deployment Script
# Run this on your production server
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
DOMAIN="lelangbot.com"
USER="www-data"

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
    certbot \
    python3-certbot-nginx \
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
        git pull origin main
    else
        echo "Cloning repository..."
        git clone ${REPO_URL} ${APP_DIR}
        cd ${APP_DIR}
    fi
    echo -e "${GREEN}✅ Repository deployed${NC}"
else
    echo -e "${YELLOW}⚠️  Skipping git clone. Please upload files manually to ${APP_DIR}${NC}"
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
    npm install --production
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
    read -p "Enter your domain (e.g., lelangbot.com): " DOMAIN_INPUT
    
    cat > ${APP_DIR}/server/config.env << EOF
NODE_ENV=production
PORT=3000
BOT_TOKEN='${BOT_TOKEN}'
LOG_LEVEL=info
CORS_ORIGIN=https://${DOMAIN_INPUT:-lelangbot.com}
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
# 7. Configure Nginx
# ============================================

echo ""
echo "🌐 Step 7: Configuring Nginx..."

# Copy nginx configuration
if [ -f "${APP_DIR}/nginx-lelangbot.conf" ]; then
    cp ${APP_DIR}/nginx-lelangbot.conf ${NGINX_CONF}
    
    # Replace domain placeholder
    read -p "Enter your domain (press Enter for ${DOMAIN}): " DOMAIN_INPUT
    DOMAIN=${DOMAIN_INPUT:-$DOMAIN}
    
    sed -i "s/lelangbot\.com/${DOMAIN}/g" ${NGINX_CONF}
    
    # Create symbolic link
    ln -sf ${NGINX_CONF} /etc/nginx/sites-enabled/
    
    # Remove default nginx site
    rm -f /etc/nginx/sites-enabled/default
    
    # Test nginx configuration
    nginx -t
    
    echo -e "${GREEN}✅ Nginx configured${NC}"
else
    echo -e "${YELLOW}⚠️  nginx-lelangbot.conf not found${NC}"
fi

# ============================================
# 8. Setup SSL Certificate (Let's Encrypt)
# ============================================

echo ""
echo "🔒 Step 8: Setting up SSL certificate..."

read -p "Setup SSL certificate with Let's Encrypt? (y/n): " SETUP_SSL

if [ "$SETUP_SSL" = "y" ] || [ "$SETUP_SSL" = "Y" ]; then
    read -p "Enter your email for SSL certificate: " SSL_EMAIL
    
    # Stop nginx temporarily
    systemctl stop nginx
    
    # Get certificate
    certbot certonly --standalone \
        -d ${DOMAIN} \
        -d www.${DOMAIN} \
        --email ${SSL_EMAIL} \
        --agree-tos \
        --non-interactive
    
    # Setup auto-renewal
    systemctl enable certbot.timer
    systemctl start certbot.timer
    
    echo -e "${GREEN}✅ SSL certificate installed${NC}"
else
    echo -e "${YELLOW}⚠️  Skipping SSL setup. Using HTTP only.${NC}"
    # Comment out SSL lines in nginx config
    sed -i 's/listen 443/# listen 443/g' ${NGINX_CONF}
    sed -i 's/ssl_/# ssl_/g' ${NGINX_CONF}
fi

# ============================================
# 9. Configure Firewall
# ============================================

echo ""
echo "🔥 Step 9: Configuring firewall..."

# Enable UFW
ufw --force enable

# Allow SSH
ufw allow 22/tcp

# Allow HTTP and HTTPS
ufw allow 80/tcp
ufw allow 443/tcp

# Check status
ufw status

echo -e "${GREEN}✅ Firewall configured${NC}"

# ============================================
# 10. Start Application with PM2
# ============================================

echo ""
echo "🚀 Step 10: Starting application with PM2..."

cd ${APP_DIR}

# Stop if already running
pm2 delete ${APP_NAME} 2>/dev/null || true

# Start application
pm2 start ecosystem.config.js --env production

# Save PM2 process list
pm2 save

# Setup PM2 startup script
pm2 startup systemd -u ${USER} --hp /home/${USER}

# Install PM2 log rotate
pm2 install pm2-logrotate
pm2 set pm2-logrotate:max_size 50M
pm2 set pm2-logrotate:retain 7

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
pm2 status

# Check Nginx status
echo ""
echo "Nginx Status:"
systemctl status nginx --no-pager

# Check if app is responding
echo ""
echo "Testing application health..."
sleep 2

if curl -sf http://localhost:3000/health > /dev/null; then
    echo -e "${GREEN}✅ Application is healthy!${NC}"
else
    echo -e "${RED}❌ Application health check failed${NC}"
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
echo "• Domain: https://${DOMAIN}"
echo "• PM2 Status: pm2 status"
echo "• PM2 Logs: pm2 logs ${APP_NAME}"
echo "• Nginx Config: ${NGINX_CONF}"
echo "• Nginx Logs: /var/log/nginx/"
echo ""
echo "🔧 Useful Commands:"
echo "• Restart App: pm2 restart ${APP_NAME}"
echo "• Stop App: pm2 stop ${APP_NAME}"
echo "• View Logs: pm2 logs ${APP_NAME}"
echo "• Monitor: pm2 monit"
echo "• Reload Nginx: systemctl reload nginx"
echo ""
echo "🔒 Security Reminders:"
echo "• Change SSH port from default (22)"
echo "• Setup SSH key authentication"
echo "• Disable root login"
echo "• Enable automatic security updates"
echo "• Setup monitoring (Uptime Robot, etc.)"
echo ""
echo "📱 Next Steps:"
echo "1. Test your bot: Send /start to your Telegram bot"
echo "2. Setup monitoring and alerts"
echo "3. Configure daily backups"
echo "4. Document your setup"
echo ""
echo "Need help? Contact support@${DOMAIN}"
echo ""

# Create deployment log
echo "Deployment completed at $(date)" >> ${APP_DIR}/logs/deployment.log