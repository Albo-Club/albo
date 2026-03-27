module.exports = {
  apps: [
    {
      name: "albote-workers",
      script: "dist/server.js",
      cwd: "/root/albo/apps/workers",
      instances: 1,
      env: {
        NODE_ENV: "production",
        PORT: 3001,
      },
      // Restart si > 500MB RAM
      max_memory_restart: "500M",
      // Logs
      error_file: "/root/albo/apps/workers/logs/error.log",
      out_file: "/root/albo/apps/workers/logs/out.log",
      merge_logs: true,
      log_date_format: "YYYY-MM-DD HH:mm:ss",
      // Auto-restart
      autorestart: true,
      watch: false,
      max_restarts: 10,
      restart_delay: 5000,
    },
  ],
};
