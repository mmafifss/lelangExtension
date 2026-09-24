// ============================================
// PM2 Ecosystem Configuration for Production
// ============================================

module.exports = {
  apps: [
    {
      // Application name
      name: 'lelang-bot',
      
      // Script to start
      script: './server/server.js',
      
      // Working directory
      cwd: './',
      
      // Execution mode
      exec_mode: 'cluster',
      
      // Number of instances (use 'max' for all CPU cores, or specify number)
      instances: 2,
      
      // Auto restart if app crashes
      autorestart: true,
      
      // Watch for file changes (disable in production for stability)
      watch: false,
      
      // Maximum memory before restart (important for long-running bots)
      max_memory_restart: '500M',
      
      // Environment variables for production
      env_production: {
        NODE_ENV: 'production',
        PORT: 3000
      },
      
      // Environment variables for staging
      env_staging: {
        NODE_ENV: 'staging',
        PORT: 3001
      },
      
      // Logging configuration
      error_file: './logs/error.log',
      out_file: './logs/out.log',
      log_file: './logs/combined.log',
      time: true,
      
      // Merge logs from all instances
      merge_logs: true,
      
      // Log date format
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      
      // Min uptime to consider app stable (avoid restart loops)
      min_uptime: '10s',
      
      // Max restarts within max_restarts interval
      max_restarts: 10,
      
      // Time window for max_restarts
      restart_delay: 4000,
      
      // Exponential backoff restart delay
      exp_backoff_restart_delay: 100,
      
      // Health check
      listen_timeout: 10000,
      kill_timeout: 5000,
      
      // Graceful shutdown
      wait_ready: true,
      
      // Arguments to pass to the script
      args: [],
      
      // Interpreter (default: node)
      interpreter: 'node',
      
      // Interpreter arguments
      interpreter_args: '--max-old-space-size=512',
      
      // Source map support
      source_map_support: true,
      
      // Disable automatic restart at specific times
      cron_restart: '0 3 * * *', // Restart every day at 3 AM
      
      // Force process to be running
      force: true,
      
      // Additional environment variables
      env: {
        NODE_PATH: '.',
        TZ: 'Asia/Jakarta'
      }
    }
  ],

  // Deployment configuration
  deploy: {
    production: {
      // SSH user
      user: 'root',
      
      // SSH host
      host: 'YOUR_SERVER_IP',
      
      // SSH port
      port: '22',
      
      // Git repository
      repo: 'git@github.com:username/lelang-bot.git',
      
      // Branch to pull
      ref: 'origin/main',
      
      // Path on server
      path: '/var/www/lelang-bot',
      
      // SSH key path
      key: '~/.ssh/id_rsa',
      
      // Pre-setup commands (run once on first deploy)
      'pre-setup': 'apt-get update && apt-get install -y git',
      
      // Post-setup commands
      'post-setup': 'npm install && pm2 install pm2-logrotate',
      
      // Pre-deploy commands (run before each deploy)
      'pre-deploy-local': 'echo "Deploying to production..."',
      
      // Post-deploy commands (run after each deploy)
      'post-deploy': 'npm install && pm2 reload ecosystem.config.js --env production',
      
      // Environment
      env: {
        NODE_ENV: 'production'
      }
    },
    
    staging: {
      user: 'root',
      host: 'YOUR_STAGING_IP',
      repo: 'git@github.com:username/lelang-bot.git',
      ref: 'origin/develop',
      path: '/var/www/lelang-bot-staging',
      'post-deploy': 'npm install && pm2 reload ecosystem.config.js --env staging'
    }
  }
};