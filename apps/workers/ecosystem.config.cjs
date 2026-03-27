module.exports = {
  apps: [
    {
      name: "albote-workers",
      script: "dist/server.js",
      cwd: "/root/albote-workers",
      instances: 1,
      env: {
        NODE_ENV: "production",
        PORT: 3001,
      },
      // Restart si > 500MB RAM
      max_memory_restart: "500M",
      // Logs
      error_file: "/root/albote-workers/logs/error.log",
      out_file: "/root/albote-workers/logs/out.log",
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
