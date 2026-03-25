# 学生积分系统

这是一个可独立部署的前后端项目：

- 前端：`React + Vite`
- 后端：`Node.js + Express`
- 数据库：`Postgres`，推荐 `Supabase`
- 推荐部署：前端上 `Vercel`，后端上 `Render`

当前版本已经不再依赖原站 `https://bjcwy.cjgsup.com`。前端、API 和本地宠物图片资源都由当前项目自身提供。

## 目录结构

- `src/`: 前端源码
- `server/`: Express API 与 Postgres 数据层
- `public/动物图片/`: 本地宠物图片资源
- `docs/deploy-render-vercel-supabase.md`: 推荐的线上部署文档
- `docs/deploy-nginx.md`: 自建 Linux 服务器部署文档

## 本地开发

首次安装：

```bash
npm install
cp .env.example .env
```

把 `.env` 里的 `DATABASE_URL` 改成你的 Supabase 连接串后，运行：

```bash
npm run dev
```

默认会启动两个服务：

- 前端开发服务器：`http://localhost:5173`
- 本地 API：`http://localhost:3001`

Vite 会把 `/api/*` 和 `/动物图片/*` 代理到本地 API。

## 本地生产运行

```bash
npm run build
npm run start
```

访问：

- 前台：`http://localhost:3001`
- 管理后台：`http://localhost:3001/admin/login`

## 推荐部署方式

如果你和当前工作室一样，平台用的是 `Supabase + Vercel`，推荐这样拆：

- 前端：`Vercel`
- 后端：`Render Web Service`
- 数据库：`Supabase Postgres`

直接看：

- `docs/deploy-render-vercel-supabase.md`

如果你以后改成自己买 Linux 服务器，也可以看：

- `docs/deploy-nginx.md`
- `deploy/nginx/class-pet-garden.conf.example`
- `ecosystem.config.cjs`

## 环境变量

常用变量：

- `PORT`: 后端监听端口，默认 `3001`
- `DATABASE_URL`: Postgres 连接串
- `DATABASE_SSL`: 是否启用数据库 SSL，默认 `true`
- `BACKUP_DIR`: 备份导出目录
- `CORS_ORIGIN`: 允许访问 API 的前端域名，多个域名用逗号分隔
- `JWT_SECRET`: 登录令牌密钥，生产环境必须修改
- `ADMIN_USERNAME`: 初始管理员账号
- `ADMIN_PASSWORD`: 初始管理员密码
- `VITE_API_URL`: 前端 API 地址。分离部署时必须填写后端地址
- `VITE_PET_ASSET_BASE_URL`: 可选。通常留空，继续走同域图片
- `VITE_SENTRY_DSN`: 可选

首次启动时会自动创建管理员账号。如果账号名已存在，则不会重复创建。

## 数据迁移与备份

项目内保留了两个脚本：

```bash
npm run db:migrate
npm run db:backup
```

- `db:migrate`: 检查并应用项目内置迁移
- `db:backup`: 导出当前数据库快照到 `backups/`，格式为 JSON

## 可用脚本

- `npm run dev`
- `npm run dev:api`
- `npm run dev:frontend`
- `npm run build`
- `npm run start`
- `npm run serve:local`
- `npm run db:migrate`
- `npm run db:backup`
- `npm run typecheck`
- `npm run mirror:images`

## 说明

- 当前默认以 `Supabase Postgres` 为目标数据库。
- 后端仍然可以在本地或自建服务器运行，不要求一定上 `Render`。
- `proxy/` 目录保留为早期恢复阶段的遗留文件，当前部署不依赖它。
