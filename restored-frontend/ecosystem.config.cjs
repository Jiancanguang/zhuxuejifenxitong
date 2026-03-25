module.exports = {
  apps: [
    {
      name: 'zhuxue-jifen',
      cwd: __dirname,
      script: 'npm',
      args: 'start',
      env: {
        NODE_ENV: 'production',
      },
    },
  ],
};
