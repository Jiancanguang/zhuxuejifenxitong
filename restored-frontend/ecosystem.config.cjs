module.exports = {
  apps: [
    {
      name: 'class-pet-garden',
      cwd: __dirname,
      script: 'npm',
      args: 'start',
      env: {
        NODE_ENV: 'production',
      },
    },
  ],
};
