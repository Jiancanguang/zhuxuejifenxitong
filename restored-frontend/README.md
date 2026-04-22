# 学生积分系统

这是一个可独立部署的前后端同项目应用：

- 前端：`React + Vite`
- 后端：`Node.js + Express`（同进程托管前端 build 产物，默认端口 `3001`）
- 数据库：`Postgres`

> **当前生产环境**：腾讯云轻量应用服务器 + 宝塔面板 + PM2 + 本机 Postgres。详见 `docs/deploy-tencent-cloud.md`。
>
> 历史上的 Vercel/Render/Supabase 方案作为替代保留，但非当前线上使用。

当前版本已经不再依赖原站 `https://bjcwy.cjgsup.com`。前端、API 和本地宠物图片资源都由当前项目自身提供。

## 目录结构

- `src/`: 前端源码
- `server/`: Express API 与 Postgres 数据层
- `public/动物图片/`: 本地宠物图片资源
- `docs/deploy-tencent-cloud.md`: **当前生产使用的部署文档**（腾讯云 + 宝塔）
- `docs/deploy-nginx.md`: 通用自建 Linux 服务器部署文档
- `docs/deploy-render-vercel-supabase.md`: 替代方案（Vercel + Render + Supabase）
- `docs/deploy-independent-backend.md`: 替代方案（独立部署后端）

## 本地开发

首次安装：

```bash
npm install
cp .env.example .env
```

把 `.env` 里的 `DATABASE_URL` 改成你的 Postgres 连接串（本机或 Supabase 等）后，运行：

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

## 部署方式

### 当前生产：腾讯云 + 宝塔（推荐）

实际线上就是这个方案。看：

- `docs/deploy-tencent-cloud.md`
- `deploy/nginx/class-pet-garden.conf.example`
- `ecosystem.config.cjs`

PM2 进程在服务器上叫 `class-pet-garden`（不是 `ecosystem.config.cjs` 默认的 `zhuxue-jifen`，沿用的是更早的命名）。

### 替代方案：自建 Linux 服务器 / Vercel + Render + Supabase

- `docs/deploy-nginx.md`（通用 Nginx 自建）
- `docs/deploy-render-vercel-supabase.md`（Vercel + Render + Supabase）
- `docs/deploy-independent-backend.md`（后端独立部署）

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

- 数据库对接任何标准 Postgres（当前生产用的是腾讯云上本机安装的 Postgres）。
- 后端可在本地、腾讯云、自建服务器或 Render 等任意 Node 环境运行。
- `proxy/` 目录保留为早期恢复阶段的遗留文件，当前部署不依赖它。
