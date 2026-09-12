const path = require("node:path");
module.exports = {
  apps: [{
    name: "lms-completion-refresh",
    cwd: __dirname,
    script: path.join(__dirname, "scripts/process-course-completion-refresh.mjs"),
    interpreter: "node",
    node_args: "--env-file=.env.local",
    args: "--watch",
    instances: 1,
    autorestart: true,
    restart_delay: 5000,
    max_memory_restart: "256M",
  }],
};
