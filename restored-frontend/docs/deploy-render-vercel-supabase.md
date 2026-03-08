# Supabase + Render + Vercel 部署说明

这是当前项目最推荐的上线方式：

- `Supabase`: 托管 Postgres
- `Render`: 托管 Node/Express API
- `Vercel`: 托管前端

## 1. 准备三个项目

你需要先有：

- 一个 `Supabase` 项目
- 一个 `Render Web Service`
- 一个 `Vercel` 前端项目

如果你的仓库根目录里还有别的内容，`Render` 和 `Vercel` 的 `Root Directory` 都填：

```txt
restored-frontend
```

## 2. 配置 Supabase

你需要两样东西：

- `Project URL`
- `Connection pooling / Session` 的 Postgres 连接串

连接串格式大致是：

```txt
postgresql://postgres.project-ref:your-password@aws-1-ap-southeast-1.pooler.supabase.com:5432/postgres
```

## 3. 配置 Render 后端

创建 `Web Service` 时：

- `Build Command`: `npm install`
- `Start Command`: `npm run start`
- `Health Check Path`: `/api/health`

环境变量至少填这些：

```env
NODE_ENV=production
DATABASE_URL=你的 Supabase 连接串
DATABASE_SSL=true
BACKUP_DIR=./backups
CORS_ORIGIN=https://你的-vercel-域名.vercel.app
JWT_SECRET=换成你自己的长随机字符串
ADMIN_USERNAME=studioadmin
ADMIN_PASSWORD=换成你自己的后台密码
```

`Render` 会自动提供 `PORT`，通常不用手动填。

如果你后面给前端绑了正式域名，比如 `https://app.example.com`，记得把 `CORS_ORIGIN` 改成正式域名并重新部署。

## 4. 首次验证 Render

后端部署完成后，先只测：

- `https://你的-render-域名/api/health`
- 管理员登录
- 普通用户注册

只要这三步正常，说明 API 和数据库已经接上了。

## 5. 配置 Vercel 前端

创建 Vercel 项目后，填这些环境变量：

```env
VITE_API_URL=https://你的-render-域名.onrender.com
VITE_PET_ASSET_BASE_URL=
VITE_SENTRY_DSN=
```

然后直接部署。

## 6. 首次验证 Vercel

前端部署成功后，按这个顺序测：

1. 打开首页
2. 注册普通用户
3. 创建班级
4. 添加学生
5. 后台登录

## 7. 绑定正式域名

推荐这样分：

- 前端：`app.example.com`
- 后端：`api.example.com`

先在 `Vercel` 给前端绑域名，再在 `Render` 给后端绑域名。  
绑完之后记得回到：

- `Vercel`，把 `VITE_API_URL` 改成 `https://api.example.com`
- `Render`，把 `CORS_ORIGIN` 改成 `https://app.example.com`

## 8. 常见问题

### Vercel 页面打开了，但接口报跨域

优先检查 Render 的：

- `CORS_ORIGIN`

必须和前端真实访问域名一致。

### Render 启动失败

优先检查：

- `DATABASE_URL`
- `DATABASE_SSL`
- `JWT_SECRET`

### 数据库连不上

优先确认你用的是 `Connection pooling / Session` 连接串，不要用 `Direct connection`。
