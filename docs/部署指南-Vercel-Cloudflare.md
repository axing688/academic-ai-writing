# 部署指南：Vercel + Cloudflare + Koyeb

本方案针对「研究生智能学术写作助手」的整体架构：

| 组件 | 承载平台 | 说明 |
|------|----------|------|
| 前端 (React + Vite 静态站点) | **Vercel** | 自动构建、CDN、HTTPS，绑定你的域名 |
| LLM 请求转发 (`/llm/*`) | **Cloudflare Worker** | 替代本地 Vite 中间件，免费额度 10 万次/天 |
| 域名 DNS + 防护 | **Cloudflare** | 域名 NS 迁到 Cloudflare，CDN 加速 + SSL |
| Go 后端 (Gin + GORM) | **Koyeb** | 免费常驻容器（512MB / 0.1 vCPU），不休眠 |
| MySQL | **TiDB Cloud Serverless** | MySQL 协议兼容，免费额度充足，强制 TLS |
| Redis | **Upstash** | Serverless Redis，免费额度足够 |

> 为什么后端不放 Vercel / Cloudflare？两者只支持静态站点和边缘函数，无法运行带 MySQL/Redis 连接池的长驻 Go 服务。Koyeb 的免费 Web 服务不会休眠，比 Render 免费版（15 分钟闲置即休眠、冷启动约 1 分钟）更适合 API 服务。
>
> 后端备选方案：Railway（$5/月，MySQL/Redis 一键开通，体验最顺）、任意 VPS（Docker Compose 直接跑现有编排）。

---

## 第 0 步：前置准备

- [ ] GitHub 上创建仓库，把本项目推上去（Vercel / Koyeb 都走 Git 部署）
- [ ] 注册 [Vercel](https://vercel.com)、[Cloudflare](https://dash.cloudflare.com)、[Koyeb](https://app.koyeb.com)、[TiDB Cloud](https://tidbcloud.com)、[Upstash](https://upstash.com) 账号
- [ ] 你已注册的域名准备就绪

---

## 第 1 步：域名 DNS 托管到 Cloudflare

1. Cloudflare 控制台 → **Add a domain** → 输入你的域名（如 `example.com`），选择 **Free 计划**
2. Cloudflare 会给出 **两个 NS 服务器地址**（如 `xxx.ns.cloudflare.com`）
3. 去你的域名注册商后台，把 **DNS 服务器** 改成这两个地址（生效需几分钟到几小时）
4. 回到 Cloudflare，点 **Check nameservers** 等待激活
5. 激活后，**SSL/TLS → Overview** 把加密模式设为 **Full**（后面接的是 Vercel，有自己的证书）

---

## 第 2 步：创建云数据库

### 2.1 MySQL（TiDB Cloud Serverless）

1. TiDB Cloud → 创建 **Serverless** 集群，选离用户近的区域
2. 集群页 → **Connect** → 记下连接信息：
   - Host：如 `gateway01.xxx.prod.aws.tidbcloud.com`
   - Port：`4000`
   - User / Password：创建集群时设置的凭据
3. 用内置 SQL 编辑器执行：`CREATE DATABASE academic_writing;`（建表由后端 GORM 自动迁移完成，无需手动建表）
4. **Network** 安全设置中，连接方式选 **TLS**（默认强制，后端已支持，见下方「后端 TLS 说明」）

### 2.2 Redis（Upstash）

1. Upstash 控制台 → **Create Database** → 选区域，勾选 **Eviction** 可选
2. 创建后进入详情页，找到 **endpoint** 和 **port**（如 `xxx.upstash.io:6379`），以及密码
3. 注意：Upstash 免费版按请求计费（1 万次命令/天免费），后端低频使用完全够用

---

## 第 3 步：部署 Go 后端到 Koyeb

1. Koyeb 控制台 → **Create App** → 选择 GitHub 仓库
2. 构建配置：
   - **Builder**: Dockerfile
   - **Dockerfile path**: `backend/Dockerfile`
   - **Working directory**: 留空或 `backend`（若 Koyeb 找不到 Dockerfile，把 path 改成 `backend/Dockerfile` 并将构建上下文设为 `backend`）
3. **Exposed port**: `8080`
4. **Environment variables**（关键，配置文件会自动被这些环境变量覆盖）：

| 变量 | 示例值 | 说明 |
|------|--------|------|
| `SERVER_MODE` | `production` | 运行模式 |
| `SERVER_PORT` | `8080` | 监听端口 |
| `SERVER_SECRET` | （随机长字符串） | 服务端密钥 |
| `DATABASE_HOST` | `gateway01.xxx.tidbcloud.com` | TiDB 主机 |
| `DATABASE_PORT` | `4000` | TiDB 端口 |
| `DATABASE_USER` | `xxx` | TiDB 用户 |
| `DATABASE_PASSWORD` | `***` | TiDB 密码 |
| `DATABASE_DBNAME` | `academic_writing` | 库名 |
| `DATABASE_SSLMODE` | `true` | **必须 true**（启用 TLS） |
| `REDIS_HOST` | `xxx.upstash.io` | Upstash 主机 |
| `REDIS_PORT` | `6379` | Upstash 端口 |
| `REDIS_PASSWORD` | `***` | Upstash 密码 |
| `JWT_SECRET_KEY` | （随机长字符串） | JWT 签名密钥，务必改掉默认值 |
| `AI_API_KEY` | `sk-***` | DashScope / 所用大模型 API Key |

5. 部署成功后会得到一个公网域名，如 `https://xxx-yyy.koyeb.app` —— 这就是后端地址，记下来
6. 验证：浏览器访问 `https://xxx.koyeb.app/api/auth/me`，返回 JSON（哪怕是 401）即说明服务通了

> **后端 TLS 说明**：本仓库已修改 `backend/cmd/server/internal/database/database.go`，当 `DATABASE_SSLMODE=true|require` 时 DSN 自动追加 `&tls=true`，以支持 TiDB Cloud 等强制加密连接的云数据库。本地开发不受影响（默认 false）。
>
> **Upstash 注意**：Upstash 走 TLS 时端口仍为 6379（其网关自动处理）；如果后端连接报 TLS 错误，可改用 Upstash 的 `rediss://` 或换用支持非 TLS 端口的 Redis 服务。

---

## 第 4 步：部署 Cloudflare Worker（LLM 转发）

代码在 `cloudflare/llm-proxy/`，与本地 Vite 中间件行为一致，且支持流式（SSE）响应。

```bash
cd cloudflare/llm-proxy
npx wrangler login        # 首次使用会打开浏览器授权
npx wrangler deploy
```

部署完成后会输出 Worker 地址，如 `https://awa-llm-proxy.<你的子域>.workers.dev` —— 记下来。

可选防滥用：在 `wrangler.toml` 的 `[vars]` 里取消注释 `ALLOWED_ORIGIN`，改成你的正式域名（如 `https://example.com`），Worker 将只接受来自该站点的请求。

---

## 第 5 步：部署前端到 Vercel

1. 修改 `frontend/vercel.json` 中的两个占位符：
   - `REPLACE-WITH-YOUR-BACKEND-HOST` → 第 3 步得到的 Koyeb 域名（如 `xxx-yyy.koyeb.app`，**不带** `https://` 前缀以外的路径；完整写法为 `https://xxx-yyy.koyeb.app`）
   - `REPLACE-WITH-YOUR-WORKER-HOST` → 第 4 步得到的 Worker 地址
2. 提交并推送代码
3. Vercel → **Add New → Project** → 导入 GitHub 仓库：
   - **Root Directory**: `frontend`
   - Framework Preset 会自动识别为 **Vite**
   - Build Command: `npm run build`（默认）
   - Output Directory: `dist`（默认）
4. **Deploy**，得到 `https://xxx.vercel.app` 预览地址，先验证功能：
   - 打开站点，登录/注册是否正常（走 `/api` 转发到 Koyeb）
   - 写作页 AI 功能是否正常（走 `/llm` 转发到 Worker）

### 绑定你的域名

1. Vercel 项目 → **Settings → Domains** → 添加 `example.com`（和/或 `www.example.com`）
2. Vercel 会提示添加 DNS 记录。到 **Cloudflare → DNS**：
   - `A` 记录：`@` → `76.76.21.21`（Vercel 的 anycast IP，以 Vercel 提示为准）
   - `CNAME` 记录：`www` → `cname.vercel-dns.com`
3. **关键**：把这两条记录的 Cloudflare 代理状态（橙色云朵）设为 **仅 DNS（灰色云朵）**，让 Vercel 直接签发证书。如果想保留 Cloudflare CDN，则开启代理并把 SSL/TLS 模式设为 **Full**，并在 Vercel 域名设置中跳过证书校验报错（推荐新手用「仅 DNS」，最省事）
4. 等待证书签发（几分钟），访问 `https://example.com` 即可

---

## 第 6 步：验收清单

- [ ] `https://你的域名` 打开正常，刷新子路由（如 `/documents`）不 404（SPA 回退生效）
- [ ] 注册/登录成功（前端 → Vercel rewrite → Koyeb → TiDB）
- [ ] 写作页 AI 生成可用（前端 → Worker → LLM 服务商）
- [ ] Koyeb 控制台日志无数据库连接错误
- [ ] Worker 免费额度：100,000 请求/天，个人使用绰绰有余

## 常见问题

| 现象 | 排查方向 |
|------|----------|
| 登录报 502 | Vercel rewrites 里的后端域名写错了，或 Koyeb 服务没起来（看 Koyeb 日志） |
| 数据库连接失败 `TLS handshake error` | `DATABASE_SSLMODE` 没设为 `true`，或 TiDB 主机/端口写错（注意端口是 4000 不是 3306） |
| Redis 连接报错 | Upstash 密码是否完整复制（含特殊字符），环境变量是否生效（Koyeb 改环境变量需重新部署） |
| AI 功能报 `missing X-AWA-Target` | Worker 未正确部署，或 Vercel 里 `/llm` rewrite 的 Worker 地址不对 |
| 自定义域名证书报错 | Cloudflare SSL 模式设为 Full（不是 Flexible），或 DNS 记录未生效 |
| 前端页面刷新 404 | `vercel.json` 的 SPA 回退 rewrite 被改动，确认 `/((?!api|llm).*)` 规则存在 |

## 费用小结

| 项目 | 费用 |
|------|------|
| Vercel Hobby | 免费（个人） |
| Cloudflare Free + Workers | 免费（10 万请求/天） |
| Koyeb 免费 Web 服务 | 免费（1 个服务，512MB） |
| TiDB Cloud Serverless | 免费（额度内） |
| Upstash Redis | 免费（1 万命令/天） |
| 域名 | 你已购买 |

全部在免费额度内即可运行。若后续用户量上来，优先升级后端（Koyeb 付费实例或迁 VPS）。
