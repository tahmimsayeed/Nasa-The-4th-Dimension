// PM2 configuration for sandbox development.
// Uses wrangler pages dev with a LOCAL D1 database (auto-created SQLite).
module.exports = {
  apps: [
    {
      name: 'robo-pet-station',
      script: 'npx',
      args: 'wrangler pages dev dist --d1=webapp-production --local --ip 0.0.0.0 --port 3000',
      cwd: '/home/user/webapp',
      env: {
        NODE_ENV: 'development',
      },
      watch: false,
      instances: 1,
      exec_mode: 'fork',
    },
  ],
}
