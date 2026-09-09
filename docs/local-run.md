# 本地运行指南

## 准备工作

### 1. 环境要求
- Node.js 18+ (前端)
- Go 1.21+ (后端)
- MySQL 8.0 (数据库)
- Redis 7.0 (缓存，可选)

### 2. 安装依赖

#### 安装 MySQL
```bash
# Windows
# 下载并安装 MySQL Community Server: https://dev.mysql.com/downloads/mysql/
# 确保 MySQL 运行在 3306 端口

# Mac (使用 Homebrew)
brew install mysql
brew services start mysql

# Linux (Ubuntu/Debian)
sudo apt update
sudo apt install mysql-server
sudo systemctl start mysql
```

#### 安装 Redis (可选)
```bash
# Windows
# 下载并安装 Redis: https://redis.io/download/

# Mac (使用 Homebrew)
brew install redis
brew services start redis

# Linux (Ubuntu/Debian)
sudo apt update
sudo apt install redis-server
sudo systemctl start redis
```

### 3. 配置环境变量

复制 `.env.example` 并创建 `.env` 文件：

```bash
cp .env.example .env
```

编辑 `.env` 文件，填入必要的配置：

```env
# 数据库配置
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_mysql_password
DB_NAME=academic_writing

# Redis 配置（可选）
REDIS_HOST=localhost
REDIS_PORT=6379

# AI 服务配置
AI_API_KEY=your_dashscope_api_key_here  # 在 https://dashscope.aliyuncs.com 获取
AI_MODEL=qwen-turbo

# JWT 配置
JWT_SECRET_KEY=your_jwt_secret_key_here

# 服务器配置
SERVER_PORT=8080
```

### 4. 创建数据库

```sql
-- 登录 MySQL
mysql -u root -p

-- 创建数据库
CREATE DATABASE academic_writing CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- 创建用户（可选）
CREATE USER 'app_user'@'localhost' IDENTIFIED BY 'app_password';
GRANT ALL PRIVILEGES ON academic_writing.* TO 'app_user'@'localhost';
FLUSH PRIVILEGES;

-- 退出
EXIT;
```

## 启动服务

### 方式一：分别启动（推荐）

#### 1. 启动后端

```bash
cd backend

# 安装依赖
go mod download

# 运行后端
go run cmd/server/main.go
```

#### 2. 启动前端（新终端）

```bash
cd frontend

# 安装依赖
npm install

# 启动开发服务器
npm run dev
```

### 方式二：使用脚本

#### Windows
```bash
# 在项目根目录运行
run-local.bat
```

#### Linux/Mac
```bash
# 在项目根目录运行
chmod +x run-local.sh
./run-local.sh
```

## 服务地址

启动成功后，可以通过以下地址访问：

- **前端**: http://localhost:3000
- **后端 API**: http://localhost:8080
- **API 文档**: http://localhost:8080/swagger/index.html

## 验证运行

### 1. 检查后端是否运行

```bash
curl http://localhost:8080/health
```

应该返回：
```json
{"code":200,"message":"success"}
```

### 2. 检查前端是否运行

打开浏览器访问 http://localhost:3000，应该看到登录页面。

## 常见问题

### 1. 数据库连接失败
- 检查 MySQL 是否正在运行
- 确认 `.env` 文件中的数据库配置
- 检查数据库用户权限

### 2. AI API 错误
- 确保 DashScope API Key 正确
- 检查 API Key 余额是否充足
- 确认网络连接正常

### 3. 端口被占用
- 修改 `.env` 文件中的端口配置
- 或者停止占用端口的程序

### 4. 依赖安装失败
- 清除缓存重新安装
- 检查网络连接
- 更新 Go 版本到 1.21+

## 开发模式提示

1. **后端热重载**: 使用 `air` 工具实现自动重启
   ```bash
   # 安装 air
   go install github.com/air-verse/air@latest
   
   # 运行
   air
   ```

2. **前端热重载**: 已经集成在 `npm run dev` 中

3. **调试**: 使用浏览器开发者工具和 VS Code 调试器

## 停止服务

- **前端**: 在终端按 `Ctrl+C`
- **后端**: 在终端按 `Ctrl+C`
- **数据库**: 根据操作系统使用相应的停止命令