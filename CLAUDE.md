# CLAUDE.md

本文件给 Claude（及任何 AI 协作者）提供项目上下文。读完本文再看其它文档。

## 部署环境（重要）

**实际生产部署在腾讯云轻量应用服务器 + 宝塔面板**，不是 `restored-frontend/README.md` 历史上推荐的 Vercel/Render/Supabase 方案。

权威部署文档：`restored-frontend/docs/deploy-tencent-cloud.md`。

## 生产坐标

- **服务器**：腾讯云 Lighthouse（OpenCloudOS），hostname 形如 `VM-0-16-opencloudos`
- **项目路径**：`/www/zhuxuejifenxitong/restored-frontend`
- **Node 版本**：v22（via nvm）
- **进程管理**：PM2
  - 进程名 `class-pet-garden`（id 通常为 `0`）—— 不是 `ecosystem.config.cjs` 里默认的 `zhuxue-jifen`
  - 同机还有另一个 PM2 进程 `student-tracking`（id 通常为 `1`），**属于另一套无关项目，不要动**
- **Express 监听端口**：`3001`，由 Nginx 反代到 `80/443`
- **前端托管方式**：`npm run build` 产出 `dist/` 后由同一个 Express 进程静态托管，**不是前后端分拆部署**
- **数据库**：本机 PostgreSQL，通过 `.env` 的 `DATABASE_URL` 连接
- **备份**：启用后自动写入 `backups/`，每 24 小时一份，保留 30 份

## 更新代码的正确流程

```bash
ssh root@<服务器IP>
cd /www/zhuxuejifenxitong/restored-frontend
git fetch origin
git checkout <target-branch>     # 或 git pull origin main（若无分叉）
npm install                       # 通常没新依赖，但保险
npm run build                     # 构建前端 dist/
pm2 restart 0                     # 只重启 class-pet-garden，id=1 不要碰
pm2 logs 0 --lines 30 --nostream  # 确认启动成功 + migration 是否执行
```

## 排障备忘

- **浏览器缓存**：前端更新后老师端需要 `Ctrl+Shift+R` 硬刷新才能拿到新 bundle
- **数据库迁移**：后端启动时 `runMigrations` 自动执行，日志会打印 `[db] 已执行 N 个数据库迁移: <id>`
- **历史坑：`students.pet_stage` 脏数据**
  - 早期版本会把 `pet_stage` 写成基于**原始** `food_count` 的 stage，没有扣除「已毕业次数 × 毕业阈值」
  - PR #18（`89c2e7e`）已让前端绕开此字段、按 `getPetProgress` 推导
  - Migration `007_recompute_pet_stage_after_graduation` 已一次性清理历史脏值
- **psql 快速连库**（不用手抄密码）：
  ```bash
  cd /www/zhuxuejifenxitong/restored-frontend
  psql "$(grep '^DATABASE_URL=' .env | cut -d= -f2-)"
  ```

## 仓库结构

- `restored-frontend/` —— 主应用（React 前端 + Express 后端同项目）
- `wechat-miniprogram/` —— 家长端微信小程序（只读查看学生积分）
- `docs/系统说明书.md` —— 面向老师/管理员的功能手册
- `restored-frontend/docs/deploy-tencent-cloud.md` —— 当前生产部署文档
- `restored-frontend/docs/deploy-render-vercel-supabase.md` —— 替代方案文档（当前未使用）
- `restored-frontend/docs/deploy-nginx.md` —— 其它自建方案文档

## 跟 AI 协作的注意事项

- Claude 没有跨会话记忆；每次新会话读的是本文件 + 仓库代码，**历史对话对它不可见**
- Claude 没有 SSH 到生产服务器的权限；运维命令由人类执行，AI 只提供命令串和诊断
- 改 `server/migrations.mjs` 是**写库操作**，即便 migration 框架自带事务回滚，上线前也优先在非生产环境演练一遍
