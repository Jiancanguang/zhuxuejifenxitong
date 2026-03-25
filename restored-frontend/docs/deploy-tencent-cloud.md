# 腾讯云轻量应用服务器部署指南

## 一、购买服务器

1. 打开 [腾讯云轻量应用服务器](https://cloud.tencent.com/product/lighthouse)
2. 选择配置：
   - **地域**：选离你最近的（如广州、上海）
   - **镜像**：选 **应用镜像 → 宝塔Linux面板**（自动安装宝塔）
   - **配置**：2核2G 即可（约 50-70元/月）
   - **带宽**：4-6Mbps 够用
3. 购买后，在控制台找到服务器的 **公网IP**
4. 在控制台 → 防火墙，开放以下端口：
   - `8888`（宝塔面板）
   - `80`（HTTP）
   - `443`（HTTPS，如果要用域名）

## 二、登录宝塔面板

1. SSH 登录服务器（密码在腾讯云控制台重置）：
   ```bash
   ssh root@你的服务器IP
   ```

2. 获取宝塔面板登录信息：
   ```bash
   bt default
   ```
   记下面板地址、用户名、密码

3. 浏览器打开宝塔面板地址，登录

## 三、安装软件

在宝塔面板中安装：

1. **软件商店** → 搜索安装：
   - **Nginx**（任意版本）
   - **PostgreSQL 15**（或更高版本）
   - **PM2管理器**（Node.js 进程管理）

2. 在 **PM2管理器** 中，设置 Node.js 版本为 **20** 或 **22**

## 四、创建数据库

1. 宝塔面板 → **数据库** → **PostgreSQL**
2. 点击 **添加数据库**：
   - 数据库名：`zhuxue`
   - 用户名：`zhuxue`
   - 密码：自己设一个强密码（记下来！）
3. 记录连接信息，后面要用：
   ```
   postgresql://zhuxue:你的密码@127.0.0.1:5432/zhuxue
   ```

## 五、部署代码

### 方法 A：直接上传（推荐新手）

1. SSH 登录服务器
2. 执行以下命令：

```bash
# 安装 git
apt update && apt install -y git

# 克隆代码
cd /www
git clone https://github.com/Jiancanguang/zhuxuejifenxitong.git
cd zhuxuejifenxitong/restored-frontend

# 安装依赖
npm install

# 创建环境配置
cp .env.example .env
```

3. 编辑 `.env` 文件（**重要！**）：

```bash
nano .env
```

写入以下内容（替换对应值）：

```env
NODE_ENV=production
PORT=3001

# 数据库连接（用第四步创建的信息）
DATABASE_URL=postgresql://zhuxue:你的数据库密码@127.0.0.1:5432/zhuxue
DATABASE_SSL=false

# 安全配置（必须修改！）
JWT_SECRET=这里填一个随机字符串至少32位
ADMIN_USERNAME=admin
ADMIN_PASSWORD=你的管理员密码

# 备份目录
BACKUP_DIR=./backups

# CORS（如果前后端同域，留空即可）
CORS_ORIGIN=
```

> **生成随机 JWT_SECRET**：运行 `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`

4. 构建前端：

```bash
npm run build
```

5. 启动服务：

```bash
# 创建备份目录
mkdir -p backups

# 用 PM2 启动
pm2 start ecosystem.config.cjs
pm2 save
pm2 startup
```

6. 验证运行：

```bash
curl http://127.0.0.1:3001/api/health
```

应该返回类似 `{"success":true,"data":{"ok":true,...}}`

## 六、配置 Nginx 反向代理

### 方式 A：有域名

1. 宝塔面板 → **网站** → **添加站点**
2. 输入你的域名
3. 在站点设置中 → **反向代理** → 添加：
   - 代理名称：`zhuxue`
   - 目标URL：`http://127.0.0.1:3001`
4. 然后编辑 Nginx 配置，替换为 `deploy/nginx/zhuxue-jifen.conf` 的内容
5. **SSL证书**：在宝塔面板 → 站点设置 → SSL → Let's Encrypt，一键申请免费证书

### 方式 B：没有域名（直接用IP访问）

1. 宝塔面板 → **网站** → **添加站点**
2. 域名填你的服务器IP
3. 编辑配置文件，将 `server_name` 改为你的IP：
   ```nginx
   server_name 你的服务器IP;
   ```
4. 其余配置同上

## 七、验证

1. 浏览器访问 `http://你的域名或IP`
2. 应该看到登录页面
3. 先访问 `http://你的域名或IP/admin/login` 用管理员账号登录测试
4. 然后在首页注册一个老师账号测试

## 八、日常维护

### 查看日志
```bash
# 查看应用日志
pm2 logs zhuxue-jifen

# 查看错误日志
pm2 logs zhuxue-jifen --err
```

### 更新代码
```bash
cd /www/zhuxuejifenxitong/restored-frontend
git pull
npm install
npm run build
pm2 restart zhuxue-jifen
```

### 数据库备份
系统内置了自动备份功能，备份文件在 `backups/` 目录。
也可以在管理后台手动触发备份。

### 重启服务
```bash
pm2 restart zhuxue-jifen
```

## 常见问题

**Q: 访问网站显示 502 Bad Gateway**
A: Node.js 服务没启动，运行 `pm2 restart zhuxue-jifen` 然后 `pm2 logs` 看错误

**Q: 登录提示"无法连接到服务器"**
A: 检查 Nginx 反向代理是否配置正确，`curl http://127.0.0.1:3001/api/health` 是否正常

**Q: 数据库连接失败**
A: 检查 `.env` 中的 `DATABASE_URL` 是否正确，PostgreSQL 是否在运行

**Q: 忘记管理员密码**
A: 修改 `.env` 中的 `ADMIN_PASSWORD`，然后 `pm2 restart zhuxue-jifen`（仅首次启动时生效，之后需要在数据库中修改）
