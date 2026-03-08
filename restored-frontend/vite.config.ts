import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  define: {
    __APP_VERSION__: JSON.stringify(process.env.npm_package_version ?? '0.0.0-restored'),
  },
  server: {
    proxy: {
      '^/api(?:/|$)': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
      '^/(?:%E5%8A%A8%E7%89%A9%E5%9B%BE%E7%89%87|动物图片)(?:/|$)': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
});
