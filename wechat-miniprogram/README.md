# 助学积分系统 - 微信小程序（家长端）

家长通过微信小程序查看孩子的课堂积分、宠物成长和荣誉徽章。

## 功能

- 输入查看码绑定学生
- 查看积分总数和可用积分
- 查看宠物成长阶段和进度
- 查看班级排名
- 查看完整积分记录（支持分页加载）
- 查看荣誉徽章墙
- 下拉刷新数据

## 部署步骤

### 1. 注册微信小程序

1. 访问 [微信公众平台](https://mp.weixin.qq.com/) 注册小程序账号
2. 在「设置 > 基本设置」中获取 **AppID**
3. 将 AppID 填入 `project.config.json` 的 `appid` 字段

### 2. 配置服务器域名

在微信公众平台「开发管理 > 开发设置 > 服务器域名」中：

- **request 合法域名**：添加你的服务器域名（如 `https://your-domain.com`）

> 注意：微信小程序正式版要求 HTTPS，需要为你的腾讯云服务器配置 SSL 证书和域名。

### 3. 配置服务器地址

编辑 `app.js`，修改 `apiBaseUrl` 为你的服务器地址：

```js
globalData: {
  apiBaseUrl: 'https://your-domain.com',  // 改为你的服务器地址
}
```

### 4. 服务器端配置

确保你的服务器（腾讯云）已经：

1. 配置了域名和 SSL 证书（HTTPS）
2. 在 `.env` 中配置了 `CORS_ORIGIN`，添加小程序的 servicewechat.com 域名
3. 运行了最新版本的后端代码（包含家长端 API）

服务器端新增的 API 端点：

| 端点 | 说明 |
|------|------|
| `POST /api/parent-codes/student/:id` | 为学生生成查看码 |
| `POST /api/parent-codes/class/:id/batch` | 批量生成全班查看码 |
| `GET /api/parent-codes/class/:id` | 获取班级所有查看码 |
| `DELETE /api/parent-codes/:id` | 停用查看码 |
| `GET /api/parent/student?code=XXX` | 家长查看学生信息 |
| `GET /api/parent/history?code=XXX` | 家长查看积分记录 |
| `GET /api/parent/ranking?code=XXX` | 家长查看排名 |

### 5. 使用微信开发者工具

1. 下载 [微信开发者工具](https://developers.weixin.qq.com/miniprogram/dev/devtools/download.html)
2. 导入此 `wechat-miniprogram` 目录
3. 填入你的 AppID
4. 开发时可在「详情 > 本地设置」中勾选「不校验合法域名」方便调试
5. 点击「预览」生成二维码在手机上测试
6. 测试通过后点击「上传」提交审核

### 6. 教师端使用

1. 在教师端系统中，点击工具栏的 **「家长码」** 按钮
2. 点击 **「一键生成全班查看码」**
3. 将查看码分发给对应学生的家长
4. 可以点击「导出」下载全班查看码列表

## 开发调试

开发时将 `app.js` 中的 `apiBaseUrl` 改为本地开发地址：

```js
apiBaseUrl: 'http://localhost:3001'
```

并在微信开发者工具中关闭域名校验。

## 项目结构

```
wechat-miniprogram/
├── app.js              # 小程序入口
├── app.json            # 全局配置
├── app.wxss            # 全局样式
├── project.config.json # 项目配置
├── utils/
│   ├── api.js          # API 请求封装
│   └── util.js         # 工具函数
└── pages/
    ├── index/          # 首页（引导绑定）
    ├── bindStudent/    # 输入查看码页
    ├── studentDetail/  # 学生详情（主页面）
    ├── history/        # 积分记录
    └── badges/         # 徽章墙
```
