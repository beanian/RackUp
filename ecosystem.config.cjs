module.exports = {
  apps: [
    {
      name: "rackup-server",
      script: "server/src/index.ts",
      interpreter: "npx",
      interpreter_args: "tsx",
      cwd: __dirname,
      max_restarts: 10,
      restart_delay: 3000,
      autorestart: true,
    },
  ],
};
