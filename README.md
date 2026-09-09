# 研究生智能学术写作助手

基于 AI 技术的学术写作辅助平台，专为研究生设计，提供智能写作、文献管理、格式规范等服务。

## 项目概述

### 核心功能
- 🤖 **智能写作助手** - 基于 AI 的内容生成和语法检查
- 📝 **文档管理** - 完整的文档创建、编辑、版本控制
- 🎯 **选题建议** - 基于用户背景的智能选题推荐
- ✅ **格式规范** - 自动格式检查和标准化
- 📊 **写作统计** - 写作进度和效率分析

### 技术栈
- **前端**: React 18 + TypeScript + Ant Design + Monaco Editor
- **后端**: Go 21 + Gin + GORM + MySQL
- **AI 服务**: Qwen-14B + DashScope API
- **缓存**: Redis
- **容器化**: Docker + Docker Compose

## 快速开始

### 环境要求
- Docker 20.10+
- Docker Compose 2.0+
- Node.js 18+
- Go 1.21+

### 方式一：使用 Docker Compose（推荐）

1. 克隆项目
```bash
git clone <repository-url>
cd academic-writing-assistant
```

2. 配置环境变量
```bash
cp .env.example .env
# 编辑 .env 文件，填入必要的 API 密钥
```

3. 启动服务
```bash
# Windows
start.bat

# Linux/Mac
./start.sh
```

4. 访问应用
- 前端: http://localhost:3000
- 后端: http://localhost:8080

### 方式二：本地开发

#### 后端开发
```bash
cd backend

# 安装依赖
go mod download

# 配置数据库
# 确保 MySQL 运行在 3306 端口
# 创建数据库 academic_writing

# 启动后端
go run cmd/server/main.go
```

#### 前端开发
```bash
cd frontend

# 安装依赖
npm install

# 启动开发服务器
npm run dev
```

## 项目结构

```
academic-writing-assistant/
├── backend/                 # Go 后端
│   ├── cmd/                # 应用入口
│   │   └── server/        
│   │       └── main.go     # 主程序
│   ├── internal/           # 内部包
│   │   ├── api/           # API 处理
│   │   ├── database/      # 数据库
│   │   ├── ai/           # AI 服务
│   │   └── utils/        # 工具函数
│   ├── pkg/              # 可复用包
│   ├── configs/          # 配置文件
│   └── go.mod
├── frontend/               # React 前端
│   ├── src/
│   │   ├── components/   # 组件
│   │   ├── pages/       # 页面
│   │   ├── utils/       # 工具
│   │   └── api/         # API 调用
│   └── package.json
├── docker/                # Docker 配置
│   └── nginx.conf
├── docker-compose.yml     # Docker 编排
└── README.md
```

## API 接口

### 认证接口
- `POST /api/auth/register` - 用户注册
- `POST /api/auth/login` - 用户登录
- `GET /api/auth/me` - 获取用户信息

### 文档接口
- `GET /api/documents` - 获取文档列表
- `POST /api/documents` - 创建文档
- `GET /api/documents/:id` - 获取文档详情
- `PUT /api/documents/:id` - 更新文档
- `DELETE /api/documents/:id` - 删除文档

### AI 接口
- `POST /api/ai/generate-content` - 生成内容
- `POST /api/ai/check-grammar` - 语法检查
- `POST /api/ai/suggest-topics` - 选题建议

## 开发指南

### 代码规范
- Go 遵循 [Go 官方规范](https://golang.org/doc/effective_go)
- TypeScript 使用 ESLint + Prettier
- Git 使用 [Git Flow](https://nvie.com/posts/a-successful-git-branching-model/) 工作流

### 提交规范
```
feat: 新功能
fix: 修复 bug
docs: 文档更新
style: 代码格式化
refactor: 重构
test: 测试
chore: 构建或辅助工具变动
```

### 测试
```bash
# 后端测试
cd backend
go test ./...

# 前端测试
cd frontend
npm test
```

## 部署

### 生产环境部署
1. 构建 Docker 镜像
```bash
docker-compose -f docker-compose.prod.yml build
```

2. 启动服务
```bash
docker-compose -f docker-compose.prod.yml up -d
```

### 环境变量
| 变量名 | 描述 | 默认值 |
|--------|------|--------|
| DB_HOST | 数据库主机 | localhost |
| DB_PORT | 数据库端口 | 3306 |
| DB_USER | 数据库用户 | root |
| DB_PASSWORD | 数据库密码 | password |
| AI_API_KEY | AI 服务 API 密钥 | - |
| JWT_SECRET_KEY | JWT 密钥 | jwt-secret-key |

## 贡献指南

1. Fork 项目
2. 创建特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 创建 Pull Request

## 许可证

本项目采用 MIT 许可证 - 查看 [LICENSE](LICENSE) 文件了解详情。

## 联系方式

- 项目负责人: Your Name
- 邮箱: your.email@example.com
- 项目地址: [GitHub Repository]

## 致谢

感谢所有为这个项目做出贡献的开发者！

---

*注意：本系统仅供学术研究使用，请遵守学术道德规范。*