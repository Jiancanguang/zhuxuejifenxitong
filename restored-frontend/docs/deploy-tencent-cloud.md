# 腾讯云轻量应用服务器部署指南

## 当前生产更新规则（2026-10-18）

以下“购买/首次安装”是初始化参考；已运行实例的更新统一走本节，禁止在运行目录安装依赖或构建。

- 目标：仅积分系统`class-pet-garden`，服务器源码`/www/zhuxuejifenxitong`，发行`/www/zhuxue-points/releases`；端口3001。其它PM2应用不重启。
- 触发：老师明确要求部署时执行`bash /www/auto-deploy.sh --deploy`；没有固定轮询、cron或模型调用，空闲0轮/天。需要绑定已审版本时传入`POINTS_DEPLOY_COMMIT=<完整提交>`。候选须为origin/main祖先且包含上次已发版本，拒绝陈旧覆盖。
- 安装与构建：按Git提交归档到独立目录，先npm ci再构建；原网站目录、依赖和源码脏改动均不改。Git抓取最多60秒，安装/构建命令各最多900秒，部署全程互斥，构建失败即结束，不重试、不切换。
- 网络受限时：在本机核实候选提交已推送origin/main后，用Git bundle上传确切提交；显式提供`POINTS_SOURCE_BUNDLE`、`POINTS_SOURCE_BUNDLE_SHA256`及`POINTS_DEPLOY_COMMIT`。服务器验证包哈希、tip与前置历史后归档，回执记录包哈希；不伪造origin/main远程引用，不修改源码HEAD，也不跳过运行基线祖先检查。
- 切换与验证：PM2的reload会沿用旧cwd，因此仅删除并按新配置重建`class-pet-garden`这个命名进程，切换期间可能短暂不可用；其它进程不动。检查实际PM2选择、健康API、首页及入口JS/CSS字节一致性（最多40秒）；失败切回旧配置、实际核验旧页面后保存PM2状态。新旧发行均保留，不自动清理。
- 共享数据：新发行链接原`restored-frontend/.env`与`backups`，账号/密钥不进Git归档或构建输入，PostgreSQL与备份不迁移。代码回退不回退数据库；本次仅改发布程序，无新增迁移。
- 恢复：`bash /www/auto-deploy.sh --rollback`显式回退上一发行。切换前保存仅含进程路径/普通运行参数的恢复日志；若发布进程被强制中断，下次显式调用先恢复旧发行。健康检查失败且回退也失败时保留日志并报错，不无限重启。
- 生命周期/开销：这是一次性手动发布入口，结束即退出，无常驻检查。安装/构建时间、网络与资源属于部署轮次，与平时网站业务和每日数据备份分开统计。失败发行保留用于排障，后续清理由老师确认具体范围。

本次实现状态：待部署与双审回读。隔离测试使用真实Git归档/HTTP/文件系统，npm及PM2替换为测试入口；覆盖构建失败、启动失败、健康失败回退、成功切换/手动回退、进程中断恢复和互斥，生产故障不会主动注入。

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
bash /www/auto-deploy.sh --deploy
```

失败恢复与显式回退见本文“当前生产更新规则”；原地构建流程已废弃。

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
