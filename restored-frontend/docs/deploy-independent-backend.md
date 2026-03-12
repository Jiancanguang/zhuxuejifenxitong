# 从零搭建独立后端 —— 保姆级教程

> **目标**：让你拥有一套完全属于自己的后端，不再依赖任何别人的服务器。
>
> **费用**：全部免费（Supabase 免费版 + Render 免费版 + Vercel 免费版）。
>
> **耗时**：大约 30 分钟。

---

## 整体架构

```
浏览器
  │
  ▼
┌──────────────┐     API 请求      ┌──────────────┐     SQL 查询     ┌──────────────┐
│   Vercel     │ ───────────────▶  │   Render     │ ──────────────▶  │  Supabase    │
│  （前端页面） │                   │ （后端 API）  │                   │ （数据库）    │
└──────────────┘                   └──────────────┘                   └──────────────┘
```

三个平台各司其职：
- **Supabase**：提供免费的 PostgreSQL 数据库，存储你的班级、学生、积分等所有数据
- **Render**：运行后端 Express API 服务，处理登录、加分、兑换等业务逻辑
- **Vercel**：托管前端页面（React），用户通过浏览器直接访问

---

## 第一步：注册 Supabase 并创建数据库

### 1.1 注册账号

1. 打开浏览器，访问 **https://supabase.com**
2. 点击右上角 **Start your project** 或 **Sign Up**
3. 推荐使用 **GitHub 账号登录**（如果你有的话），也可以用邮箱注册

### 1.2 创建项目

1. 登录后，点击 **New Project**
2. 填写以下信息：
   - **Name**（项目名）：随意取，比如 `zhuxue-db`
   - **Database Password**（数据库密码）：**非常重要！请记下来或复制保存**
     - 建议用一个复杂密码，比如 `MyDb2024!SecurePass`
   - **Region**（区域）：选择 **Southeast Asia (Singapore)** — 离中国最近
3. 点击 **Create new project**
4. 等待约 1-2 分钟，项目创建完成

### 1.3 获取数据库连接字符串

1. 在左侧菜单中，点击 **⚙ Project Settings**（齿轮图标）
2. 点击左侧的 **Database**
3. 找到 **Connection string** 区域
4. 选择 **Session mode (port 5432)** 标签
5. 你会看到类似这样的连接字符串：
   ```
   postgresql://postgres.[你的项目ID]:[你的密码]@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres
   ```
6. 点击复制按钮，**保存到记事本里**

> ⚠️ 如果连接字符串中密码部分显示 `[YOUR-PASSWORD]`，需要手动替换成你在 1.2 步设置的数据库密码。

---

## 第二步：注册 Render 并部署后端

### 2.1 注册账号

1. 打开浏览器，访问 **https://render.com**
2. 点击右上角 **Get Started for Free**
3. 推荐使用 **GitHub 账号登录**

### 2.2 连接 GitHub 仓库

1. 登录后，点击 **New** → **Web Service**
2. 在 "Connect a repository" 页面，找到并选择仓库：
   ```
   Jiancanguang/zhuxuejifenxitong
   ```
   - 如果看不到这个仓库，点击 **Configure account** 授权 Render 访问你的 GitHub

### 2.3 配置服务

填写以下设置：

| 设置项 | 填写内容 |
|--------|----------|
| **Name** | `zhuxue-api`（或任意名字） |
| **Region** | Singapore (Southeast Asia) |
| **Branch** | `main` |
| **Root Directory** | `restored-frontend` |
| **Runtime** | Node |
| **Build Command** | `npm install` |
| **Start Command** | `npm run start` |
| **Instance Type** | Free |

### 2.4 添加环境变量

在同一个创建页面，找到 **Environment Variables** 区域，逐个添加：

| Key | Value | 说明 |
|-----|-------|------|
| `NODE_ENV` | `production` | 生产模式 |
| `DATABASE_URL` | `postgresql://postgres.xxx:xxx@xxx/postgres` | 第一步复制的 Supabase 连接字符串 |
| `DATABASE_SSL` | `true` | 启用 SSL 连接 |
| `BACKUP_DIR` | `./backups` | 备份目录 |
| `CORS_ORIGIN` | `https://zhuxuejifenxitong.vercel.app` | 你的 Vercel 前端地址（后面可改） |
| `JWT_SECRET` | `（生成一个长随机字符串）` | 用于登录令牌加密，见下方说明 |
| `ADMIN_USERNAME` | `studioadmin` | 管理员用户名 |
| `ADMIN_PASSWORD` | `（设置你的管理员密码）` | 管理员密码，请设一个强密码 |

**如何生成 JWT_SECRET？**

打开浏览器控制台（F12 → Console），输入：
```js
crypto.randomUUID() + crypto.randomUUID()
```
回车后会输出一串随机字符串，复制它作为 `JWT_SECRET` 的值。

### 2.5 部署

1. 点击 **Create Web Service**
2. 等待部署完成（通常 2-5 分钟）
3. 部署成功后，你会在页面顶部看到你的后端地址，类似：
   ```
   https://zhuxue-api.onrender.com
   ```

### 2.6 验证后端

在浏览器中访问：
```
https://zhuxue-api.onrender.com/api/health
```

如果看到类似 `{"status":"ok"}` 的 JSON 响应，说明后端部署成功！

> 💡 Render 免费方案会在 15 分钟无请求后自动休眠。首次访问可能需要等 30 秒左右启动。

---

## 第三步：注册 Vercel 并部署前端

### 3.1 注册账号

1. 打开浏览器，访问 **https://vercel.com**
2. 点击 **Sign Up**
3. 推荐使用 **GitHub 账号登录**

### 3.2 导入项目

1. 登录后，点击 **Add New** → **Project**
2. 在 "Import Git Repository" 中找到：
   ```
   Jiancanguang/zhuxuejifenxitong
   ```
3. 点击 **Import**

### 3.3 配置项目

| 设置项 | 填写内容 |
|--------|----------|
| **Project Name** | `zhuxuejifenxitong`（或任意名字） |
| **Framework Preset** | Vite |
| **Root Directory** | `restored-frontend` |
| **Build Command** | 留空（自动检测） |
| **Output Directory** | 留空（自动检测） |

### 3.4 添加环境变量

在同一个配置页面中，找到 **Environment Variables** 区域，添加：

| Key | Value | 说明 |
|-----|-------|------|
| `VITE_API_URL` | `https://zhuxue-api.onrender.com` | 你在第二步获得的 Render 后端地址 |

> ⚠️ 注意：`VITE_API_URL` 的值**不要以 `/` 结尾**。

### 3.5 部署

1. 点击 **Deploy**
2. 等待构建完成（通常 1-2 分钟）
3. 部署成功后，你会得到前端地址，类似：
   ```
   https://zhuxuejifenxitong.vercel.app
   ```

### 3.6 回到 Render 更新 CORS

如果你的 Vercel 域名和之前在 Render 环境变量里填的 `CORS_ORIGIN` 不一致，需要回到 Render 更新：

1. 打开 Render 控制台 → 你的服务 → **Environment**
2. 把 `CORS_ORIGIN` 改成你实际的 Vercel 域名
3. 点击 **Save Changes**，服务会自动重新部署

---

## 第四步：验证整个系统

按以下顺序测试：

1. ✅ 打开前端页面，确认能正常加载
2. ✅ 注册一个普通用户账号
3. ✅ 创建一个班级
4. ✅ 添加几个学生
5. ✅ 给学生加分（签到）
6. ✅ 确认宠物正常成长
7. ✅ 用管理员账号登录后台（`ADMIN_USERNAME` / `ADMIN_PASSWORD`）
8. ✅ 测试小卖部兑换功能

全部通过说明系统已经完全运行在你自己的基础设施上了！

---

## 常见问题

### Q: 页面打开了但接口报错 / 显示跨域错误

**原因**：Render 的 `CORS_ORIGIN` 环境变量和前端实际域名不匹配。

**解决**：在 Render 环境变量中更新 `CORS_ORIGIN` 为你前端的完整域名（如 `https://zhuxuejifenxitong.vercel.app`），注意包含 `https://`。

### Q: Render 后端启动失败

**排查顺序**：
1. 检查 `DATABASE_URL` 是否完整且正确
2. 确认密码中的特殊字符已正确编码（如 `@` → `%40`）
3. 确认 `DATABASE_SSL=true`
4. 查看 Render 的 Logs 页面了解具体错误

### Q: 数据库连不上

确认你使用的是 Supabase 的 **Session mode (port 5432)** 连接串，而不是 Direct connection。

### Q: 每次首次打开很慢

Render 免费方案的服务会在空闲 15 分钟后自动休眠。首次访问需要等待 ~30 秒冷启动。如果需要更快的响应，可以：
- 升级到 Render 付费方案（$7/月起）
- 或者设置一个定时任务每 14 分钟 ping 一次后端的 `/api/health` 端点

### Q: 如何迁移旧数据？

新后端启动时会自动创建数据库表结构。但旧系统上的班级、学生等数据需要手动重新录入。如果数据量很大，可以考虑用 API 批量导入。

---

## 绑定自定义域名（可选）

推荐的域名分配：
- 前端：`app.你的域名.com`（在 Vercel 绑定）
- 后端：`api.你的域名.com`（在 Render 绑定）

绑定后记得更新：
- Vercel 的 `VITE_API_URL` → `https://api.你的域名.com`
- Render 的 `CORS_ORIGIN` → `https://app.你的域名.com`
