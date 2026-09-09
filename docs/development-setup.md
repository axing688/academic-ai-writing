# 开发环境配置

## 创建 .env 文件

在项目根目录创建 `.env` 文件：

```bash
cp .env.example .env
```

然后编辑 `.env` 文件，填入必要的配置：

```env
# 数据库配置
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=password
DB_NAME=academic_writing

# Redis 配置
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=

# AI 服务配置
AI_API_KEY=your_dashscope_api_key_here
AI_MODEL=qwen-14b-chat

# JWT 配置
JWT_SECRET_KEY=your_jwt_secret_key_here
JWT_EXPIRES_IN=24h

# 服务器配置
SERVER_PORT=8080
SERVER_MODE=debug

# 文件存储配置
UPLOAD_DIR=./uploads
MAX_FILE_SIZE=10MB
```

## 数据库初始化

### 创建数据库
```sql
CREATE DATABASE academic_writing CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

### 运行数据库迁移
```bash
cd backend

# 使用 GORM 自动迁移
go run cmd/server/main.go
```

## 前端开发环境设置

1. 进入前端目录
```bash
cd frontend
```

2. 安装依赖
```bash
npm install
```

3. 配置 API 地址
在 `src/utils/api.ts` 中修改 API 地址：
```typescript
const API_BASE_URL = process.env.NODE_ENV === 'development' 
  ? 'http://localhost:8080/api' 
  : '/api';
```

4. 启动开发服务器
```bash
npm run dev
```

## IDE 配置

### VS Code
安装以下扩展：
- Go extension for Visual Studio Code
- ESLint
- Prettier
- TypeScript Importer

### Go 插件配置
创建 `.vscode/settings.json`：
```json
{
  "go.lintTool": "golint",
  "go.lintFlags": ["-min_confidence=0.8"],
  "go.formatTool": "goimports",
  "go.testFlags": ["-v"],
  "files.associations": {
    "*.go": "go"
  }
}
```

### ESLint 配置
创建 `.eslintrc.json`：
```json
{
  "extends": ["next/core-web-vitals", "@typescript-eslint/recommended"],
  "rules": {
    "@typescript-eslint/no-unused-vars": ["error", { "argsIgnorePattern": "^_" }],
    "@typescript-eslint/explicit-function-return-type": ["warn", {
      "allowExpressions": true,
      "allowTypedFunctionExpressions": true
    }]
  }
}
```

## Git 钩子配置

安装 Husky 和 lint-staged：
```bash
npm install husky lint-staged --save-dev
npx husky install
npx husky add .husky/pre-commit "npx lint-staged"
```

创建 `.husky/pre-commit` 钩子：
```bash
#!/usr/bin/env sh
. "$(dirname -- "$0")/_/husky.sh"

npx lint-staged
```

创建 `package.json` 配置：
```json
{
  "lint-staged": {
    "*.{js,jsx,ts,tsx}": [
      "eslint --fix",
      "prettier --write"
    ],
    "*.go": [
      "gofmt -w",
      "go vet ./...",
      "golint ./..."
    ]
  }
}
```

## 开发工作流

### 1. 代码风格
- Go 代码使用 `gofmt` 格式化
- TypeScript 使用 ESLint + Prettier
- 遵循统一的代码风格指南

### 2. 提交规范
使用 Conventional Commits：
- `feat`: 新功能
- `fix`: 修复 bug
- `docs`: 文档更新
- `style`: 代码格式化
- `refactor`: 重构
- `test`: 测试
- `chore`: 构建或辅助工具变动

### 3. 分支管理
- `main`: 主分支，保持稳定
- `develop`: 开发分支
- `feature/*`: 功能分支
- `hotfix/*`: 紧急修复分支

### 4. 代码审查
- 所有 pull request 需要经过 code review
- 使用 GitHub 的 Pull Request 功能
- 必须通过 CI/CD 检查

## 调试配置

### 后端调试
使用 Delve 调试器：
```bash
# 安装 delve
go install github.com/go-delve/delve/cmd/dlv@latest

# 调试模式运行
dlv debug cmd/server/main.go
```

### 前端调试
使用 Chrome DevTools：
- 打开 Chrome 开发者工具
- 切换到 Sources 标签
- 设置断点进行调试

## 性能监控

### 后端监控
集成 Prometheus：
```go
import "github.com/prometheus/client_golang/prometheus"

// 注册监控指标
var (
    requestCounter = prometheus.NewCounterVec(
        prometheus.CounterOpts{
            Name: "http_requests_total",
            Help: "Total number of HTTP requests",
        },
        []string{"method", "endpoint"},
    )
)
```

### 前端监控
集成 Sentry：
```javascript
import * as Sentry from "@sentry/react";

Sentry.init({
  dsn: "your-sentry-dsn",
  integrations: [
    new Sentry.BrowserTracing(),
    new Sentry.Replay(),
  ],
});
```

## 测试配置

### 单元测试
```bash
# 运行所有测试
go test ./...

# 运行特定测试
go test ./internal/api -v

# 生成覆盖率报告
go test -coverprofile=coverage.out ./...
go tool cover -html=coverage.out
```

### 集成测试
创建 `tests/` 目录，编写集成测试用例。

### 端到端测试
使用 Cypress 或 Playwright 进行 E2E 测试：
```bash
npm install cypress --save-dev
npx cypress open
```