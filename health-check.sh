#!/bin/bash

# ============================================
# Health Check & Monitoring Script
# Run via cron every 5 minutes
# ============================================

APP_NAME="lelangbot"
APP_URL="http://localhost:3000/health"
LOG_FILE="/var/www/${APP_NAME}/logs/health-check.log"
ALERT_EMAIL="admin@lelangbot.com"

# Timestamp
TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')

# Function to log
log_message() {
    echo "[${TIMESTAMP}] $1" >> ${LOG_FILE}
}

# Function to send alert
send_alert() {
    local subject="$1"
    local body="$2"
    
    # Send email (requires mailutils)
    echo "${body}" | mail -s "${subject}" ${ALERT_EMAIL}
    
    # Log alert
    log_message "ALERT SENT: ${subject}"
}

# Check if PM2 process is running
if ! pm2 list | grep -q "${APP_NAME}.*online"; then
    log_message "ERROR: PM2 process not running"
    send_alert "CRITICAL: ${APP_NAME} is DOWN" "PM2 process is not running. Attempting restart..."
    
    # Attempt restart
    pm2 restart ${APP_NAME}
    sleep 5
    
    if pm2 list | grep -q "${APP_NAME}.*online"; then
        log_message "SUCCESS: Auto-restart successful"
        send_alert "RECOVERY: ${APP_NAME} restarted" "Application has been automatically restarted and is now online."
    else
        log_message "ERROR: Auto-restart failed"
        send_alert "CRITICAL: Auto-restart FAILED" "Failed to restart application. Manual intervention required!"
    fi
fi

# Check HTTP health endpoint
if curl -sf ${APP_URL} > /dev/null 2>&1; then
    log_message "OK: Health check passed"
else
    log_message "ERROR: Health check failed"
    send_alert "WARNING: Health check failed" "Application is running but health endpoint is not responding."
fi

# Check memory usage
MEMORY_USAGE=$(pm2 show ${APP_NAME} | grep "memory" | awk '{print $4}' | tr -d 'M')
if [ ! -z "$MEMORY_USAGE" ] && [ "$MEMORY_USAGE" -gt 400 ]; then
    log_message "WARNING: High memory usage: ${MEMORY_USAGE}MB"
    send_alert "WARNING: High memory usage" "Application is using ${MEMORY_USAGE}MB of memory."
fi

# Check disk space
DISK_USAGE=$(df -h / | tail -1 | awk '{print $5}' | tr -d '%')
if [ "$DISK_USAGE" -gt 80 ]; then
    log_message "WARNING: Disk usage at ${DISK_USAGE}%"
    send_alert "WARNING: Low disk space" "Disk usage is at ${DISK_USAGE}%."
fi

# Clean up old logs (keep last 7 days)
find /var/www/${APP_NAME}/logs -name "*.log" -mtime +7 -delete

log_message "Health check completed"