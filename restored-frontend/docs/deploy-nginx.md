# Nginx + PM2 部署说明

这份文档适用于你自己有 Linux 服务器的情况：

- `Nginx` 做反向代理
- `PM2` 守护 Node 服务
- 数据库使用外部 `Postgres`，推荐 `Supabase`

如果你当前平台是 `Supabase + Vercel`，优先看 `docs/deploy-render-vercel-supabase.md`。

## 1. 上传项目

```bash
mkdir -p /www/wwwroot/class-pet-garden
cd /www/wwwroot/class-pet-garden
```

把项目文件传到这个目录。

## 2. 安装 Node.js

建议 `Node 22`。

```bash
node -v
npm -v
```

## 3. 安装依赖并构建

```bash
cd /www/wwwroot/class-pet-garden
npm install
npm run build
```

## 4. 配置环境变量

```bash
cd /www/wwwroot/class-pet-garden
cp .env.example .env
```

至少修改这些：

```env
NODE_ENV=production
PORT=3001
DATABASE_URL=你的 Supabase Postgres 连接串
DATABASE_SSL=true
BACKUP_DIR=./backups
CORS_ORIGIN=https://your-domain.com
JWT_SECRET=换成你自己的长随机字符串
ADMIN_USERNAME=studioadmin
ADMIN_PASSWORD=换成你自己的后台密码
VITE_API_URL=
VITE_PET_ASSET_BASE_URL=
VITE_SENTRY_DSN=
```

如果服务器上 `3001` 已经被占用，就把 `PORT` 改成其他端口，例如 `3101`，同时把 Nginx 里的 `proxy_pass` 一起改掉。

## 5. 启动迁移

```bash
cd /www/wwwroot/class-pet-garden
npm run db:migrate
```

## 6. 用 PM2 启动

```bash
npm install -g pm2
cd /www/wwwroot/class-pet-garden
pm2 start ecosystem.config.cjs
pm2 save
pm2 startup
```

查看状态：

```bash
pm2 status
pm2 logs class-pet-garden
```

## 7. 配置 Nginx

项目里已经放了一份模板：

- `deploy/nginx/class-pet-garden.conf.example`

核心反向代理仍然是：

```nginx
server {
    listen 80;
    server_name your-domain.com;

    client_max_body_size 10m;

    location /api/sync/stream {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 3600s;
        proxy_send_timeout 3600s;
        proxy_buffering off;
        add_header X-Accel-Buffering no;
    }

    location / {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 300s;
        proxy_send_timeout 300s;
    }
}
```

## 8. 检查并重载 Nginx

```bash
nginx -t
systemctl reload nginx
```

## 9. 开 HTTPS

如果你用 `certbot`：

```bash
certbot --nginx -d your-domain.com
```

## 10. 更新项目

```bash
cd /www/wwwroot/class-pet-garden
npm install
npm run build
npm run db:migrate
pm2 restart class-pet-garden
```

更新前建议先做一次备份：

```bash
cd /www/wwwroot/class-pet-garden
npm run db:backup
```

## 常见问题

### 页面能开，但接口 502

先看 PM2：

```bash
pm2 logs class-pet-garden
```

再看端口：

```bash
lsof -iTCP:3001 -sTCP:LISTEN
```

### 登录后实时同步不工作

重点检查 Nginx 里 `/api/sync/stream` 这一段有没有：

- `proxy_buffering off`
- `add_header X-Accel-Buffering no`

### 后端启动失败

优先检查：

- `DATABASE_URL` 是否正确
- `DATABASE_SSL` 是否为 `true`
- `CORS_ORIGIN` 是否写成了前端真实域名
