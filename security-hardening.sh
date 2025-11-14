#!/bin/bash

# ============================================
# Security Hardening Script
# Run after initial deployment
# ============================================

set -e

echo "🔒 Security Hardening Script"
echo "============================"

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Check if running as root
if [ "$EUID" -ne 0 ]; then 
    echo -e "${RED}❌ Please run as root${NC}"
    exit 1
fi

# ============================================
# 1. Create Non-Root User
# ============================================

echo ""
echo "👤 Step 1: Creating non-root user..."

read -p "Create new user? (y/n): " CREATE_USER

if [ "$CREATE_USER" = "y" ]; then
    read -p "Username: " NEW_USER
    adduser ${NEW_USER}
    usermod -aG sudo ${NEW_USER}
    echo -e "${GREEN}✅ User ${NEW_USER} created${NC}"
fi

# ============================================
# 2. SSH Hardening
# ============================================

echo ""
echo "🔑 Step 2: SSH Hardening..."

SSH_CONFIG="/etc/ssh/sshd_config"
SSH_BACKUP="/etc/ssh/sshd_config.backup"

# Backup original config
cp ${SSH_CONFIG} ${SSH_BACKUP}

# Change SSH port
read -p "Change SSH port from 22? (y/n): " CHANGE_PORT

if [ "$CHANGE_PORT" = "y" ]; then
    read -p "New SSH port (e.g., 2222): " NEW_PORT
    sed -i "s/#Port 22/Port ${NEW_PORT}/" ${SSH_CONFIG}
    sed -i "s/Port 22/Port ${NEW_PORT}/" ${SSH_CONFIG}
    
    # Update UFW
    ufw allow ${NEW_PORT}/tcp
    ufw delete allow 22/tcp
    
    echo -e "${GREEN}✅ SSH port changed to ${NEW_PORT}${NC}"
    echo -e "${YELLOW}⚠️  Remember to use: ssh -p ${NEW_PORT} user@server${NC}"
fi

# Disable root login
sed -i 's/#PermitRootLogin yes/PermitRootLogin no/' ${SSH_CONFIG}
sed -i 's/PermitRootLogin yes/PermitRootLogin no/' ${SSH_CONFIG}

# Disable password authentication (force key-based)
read -p "Disable password authentication? (requires SSH key setup) (y/n): " DISABLE_PASS

if [ "$DISABLE_PASS" = "y" ]; then
    sed -i 's/#PasswordAuthentication yes/PasswordAuthentication no/' ${SSH_CONFIG}
    sed -i 's/PasswordAuthentication yes/PasswordAuthentication no/' ${SSH_CONFIG}
    echo -e "${YELLOW}⚠️  Make sure you have SSH key configured!${NC}"
fi

# Restart SSH
systemctl restart sshd

echo -e "${GREEN}✅ SSH hardened${NC}"

# ============================================
# 3. Install Fail2Ban
# ============================================

echo ""
echo "🛡️ Step 3: Installing Fail2Ban..."

apt-get install -y fail2ban

# Configure Fail2Ban
cat > /etc/fail2ban/jail.local << 'EOF'
[DEFAULT]
bantime = 3600
findtime = 600
maxretry = 5
destemail = admin@lelangbot.com
sendername = Fail2Ban
action = %(action_mwl)s

[sshd]
enabled = true
port = ssh
filter = sshd
logpath = /var/log/auth.log
maxretry = 3

[nginx-http-auth]
enabled = true
filter = nginx-http-auth
port = http,https
logpath = /var/log/nginx/error.log

[nginx-limit-req]
enabled = true
filter = nginx-limit-req
port = http,https
logpath = /var/log/nginx/error.log
EOF

systemctl enable fail2ban
systemctl start fail2ban

echo -e "${GREEN}✅ Fail2Ban installed and configured${NC}"

# ============================================
# 4. Enable Automatic Security Updates
# ============================================

echo ""
echo "🔄 Step 4: Enabling automatic security updates..."

apt-get install -y unattended-upgrades apt-listchanges

# Configure unattended upgrades
cat > /etc/apt/apt.conf.d/50unattended-upgrades << 'EOF'
Unattended-Upgrade::Allowed-Origins {
    "${distro_id}:${distro_codename}-security";
};
Unattended-Upgrade::AutoFixInterruptedDpkg "true";
Unattended-Upgrade::MinimalSteps "true";
Unattended-Upgrade::Mail "admin@lelangbot.com";
Unattended-Upgrade::Automatic-Reboot "false";
EOF

echo -e "${GREEN}✅ Automatic security updates enabled${NC}"

# ============================================
# 5. Configure Firewall
# ============================================

echo ""
echo "🔥 Step 5: Configuring firewall rules..."

# Reset UFW
ufw --force reset

# Default policies
ufw default deny incoming
ufw default allow outgoing

# Allow SSH (use custom port if changed)
if [ ! -z "$NEW_PORT" ]; then
    ufw allow ${NEW_PORT}/tcp comment 'SSH'
else
    ufw allow 22/tcp comment 'SSH'
fi

# Allow HTTP/HTTPS
ufw allow 80/tcp comment 'HTTP'
ufw allow 443/tcp comment 'HTTPS'

# Enable UFW
ufw --force enable

# Show status
ufw status verbose

echo -e "${GREEN}✅ Firewall configured${NC}"

# ============================================
# 6. Secure Shared Memory
# ============================================

echo ""
echo "🔒 Step 6: Securing shared memory..."

if ! grep -q "tmpfs /run/shm" /etc/fstab; then
    echo "tmpfs /run/shm tmpfs defaults,noexec,nosuid 0 0" >> /etc/fstab
    mount -o remount /run/shm
    echo -e "${GREEN}✅ Shared memory secured${NC}"
else
    echo -e "${YELLOW}⚠️  Shared memory already secured${NC}"
fi

# ============================================
# 7. Install and Configure ModSecurity (WAF)
# ============================================

echo ""
echo "🛡️ Step 7: Installing ModSecurity..."

read -p "Install ModSecurity WAF? (y/n): " INSTALL_MODSEC

if [ "$INSTALL_MODSEC" = "y" ]; then
    apt-get install -y libmodsecurity3 modsecurity-crs
    
    # Enable ModSecurity in Nginx (requires compilation with ModSecurity module)
    echo -e "${YELLOW}⚠️  ModSecurity requires Nginx compiled with ModSecurity module${NC}"
    echo -e "${YELLOW}   Follow: https://github.com/SpiderLabs/ModSecurity-nginx${NC}"
fi

# ============================================
# 8. Setup Log Monitoring
# ============================================

echo ""
echo "📊 Step 8: Setting up log monitoring..."

# Install logwatch
apt-get install -y logwatch

# Configure logwatch
cat > /etc/cron.daily/00logwatch << 'EOF'
#!/bin/bash
/usr/sbin/logwatch --output mail --mailto admin@lelangbot.com --detail high
EOF

chmod +x /etc/cron.daily/00logwatch

echo -e "${GREEN}✅ Log monitoring configured${NC}"

# ============================================
# 9. Secure File Permissions
# ============================================

echo ""
echo "📁 Step 9: Setting secure file permissions..."

APP_DIR="/var/www/lelangbot"

# Application files
chown -R www-data:www-data ${APP_DIR}
find ${APP_DIR} -type d -exec chmod 755 {} \;
find ${APP_DIR} -type f -exec chmod 644 {} \;

# Config files (more restrictive)
chmod 600 ${APP_DIR}/server/config.env

# Scripts (executable)
chmod +x ${APP_DIR}/*.sh 2>/dev/null || true

echo -e "${GREEN}✅ File permissions secured${NC}"

# ============================================
# 10. Kernel Hardening
# ============================================

echo ""
echo "🔧 Step 10: Kernel hardening..."

cat >> /etc/sysctl.conf << 'EOF'

# Lelang Bot Security Settings
# IP Forwarding
net.ipv4.ip_forward = 0

# Ignore ICMP ping requests
net.ipv4.icmp_echo_ignore_all = 1

# SYN flood protection
net.ipv4.tcp_syncookies = 1
net.ipv4.tcp_max_syn_backlog = 2048
net.ipv4.tcp_synack_retries = 2
net.ipv4.tcp_syn_retries = 5

# IP Spoofing protection
net.ipv4.conf.all.rp_filter = 1
net.ipv4.conf.default.rp_filter = 1

# Ignore ICMP redirects
net.ipv4.conf.all.accept_redirects = 0
net.ipv6.conf.all.accept_redirects = 0

# Ignore send redirects
net.ipv4.conf.all.send_redirects = 0

# Disable source packet routing
net.ipv4.conf.all.accept_source_route = 0
net.ipv6.conf.all.accept_source_route = 0

# Log Martians
net.ipv4.conf.all.log_martians = 1
EOF

sysctl -p

echo -e "${GREEN}✅ Kernel hardened${NC}"

# ============================================
# Summary
# ============================================

echo ""
echo "╔════════════════════════════════════════╗"
echo "║   🔒 SECURITY HARDENING COMPLETED!     ║"
echo "╚════════════════════════════════════════╝"
echo ""
echo -e "${GREEN}✅ Security measures implemented:${NC}"
echo "  • SSH hardening"
echo "  • Fail2Ban installed"
echo "  • Automatic security updates"
echo "  • Firewall configured"
echo "  • Shared memory secured"
echo "  • Log monitoring setup"
echo "  • File permissions secured"
echo "  • Kernel hardened"
echo ""
echo -e "${YELLOW}⚠️  Additional recommendations:${NC}"
echo "  • Setup SSH key authentication"
echo "  • Install and configure ClamAV"
echo "  • Regular security audits"
echo "  • Monitor logs daily"
echo "  • Keep system updated"
echo ""
echo "🔍 Security audit tools:"
echo "  • lynis audit system"
echo "  • rkhunter --check"
echo "  • chkrootkit"
echo ""