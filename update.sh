#!/bin/bash

# ============================================
# Quick Update Script
# Use this for quick code updates without full deployment
# ============================================

set -e

echo "🔄 Quick Update Script"
echo "======================"

APP_NAME="lelangbot"
APP_DIR="/var/www/${APP_NAME}"

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Check if running as root or with sudo
if [ "$EUID" -ne 0 ]; then 
    echo -e "${YELLOW}⚠️  Not running as root. Some operations may fail.${NC}"
fi

# Navigate to app directory
cd ${APP_DIR}

echo ""
echo "📥 Pulling latest code..."
git pull origin main

echo ""
echo "📦 Updating dependencies..."
cd server && npm install --production && cd ..

echo ""
echo "🔄 Reloading application..."
pm2 reload ${APP_NAME}

echo ""
echo "✅ Update completed!"
echo ""
echo "📊 Current Status:"
pm2 status