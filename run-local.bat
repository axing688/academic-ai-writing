@echo off
echo ====================================
echo 本地运行学术写作助手项目
echo ====================================

echo 1. 检查必要环境...
echo.

REM 检查 Node.js
node --version >nul 2>&1
if errorlevel 1 (
    echo 错误: Node.js 未安装
    echo 请从 https://nodejs.org 下载安装
    pause
    exit /b 1
)
echo ✓ Node.js 已安装

REM 检查 Go
go version >nul 2>&1
if errorlevel 1 (
    echo 错误: Go 未安装
    echo 请从 https://golang.org 下载安装
    pause
    exit /b 1
)
echo ✓ Go 已安装

REM 检查 MySQL
mysql --version >nul 2>&1
if errorlevel 1 (
    echo MySQL 未安装，将使用 Docker 容器
) else (
    echo ✓ MySQL 已安装
)

echo.
echo ====================================
echo 2. 创建环境变量文件...
if not exist .env (
    copy .env.example .env
    echo ✓ 已创建 .env 文件
    echo.
    echo 请编辑 .env 文件，填入你的 DashScope API Key
    echo.
) else (
    echo ✓ .env 文件已存在
)

echo.
echo ====================================
echo 3. 准备数据库（使用 Docker）...
docker run --rm -d --name mysql-temp -e MYSQL_ROOT_PASSWORD=password -e MYSQL_DATABASE=academic_writing mysql:8.0
echo ✓ MySQL 容器已启动

timeout /t 10 /nobreak >nul
echo.

echo ====================================
echo 4. 启动后端服务...
cd backend
call :start_backend
cd ..

echo.
echo ====================================
echo 5. 启动前端服务...
cd frontend
call :start_frontend
cd ..

echo.
echo ====================================
echo 服务启动完成！
echo.
echo 访问地址:
echo 前端: http://localhost:3000
echo 后端 API: http://localhost:8080
echo.
echo 按任意键查看服务状态...
pause >nul

docker ps
echo.
echo 按任意键停止服务...
pause >nul

call :stop_all
echo 服务已停止
pause
exit /b 0

:start_backend
echo 启动后端服务...
go mod download
if errorlevel 1 (
    echo 错误: 下载依赖失败
    pause
    exit /b 1
)
echo 依赖下载完成

REM 设置环境变量
set DB_HOST=localhost
set DB_PORT=3306
set DB_USER=root
set DB_PASSWORD=password
set DB_NAME=academic_writing
set REDIS_HOST=localhost
set REDIS_PORT=6379
set AI_PROVIDER=dashscope
set AI_MODEL=qwen-turbo
set AI_API_KEY=your-dashscope-api-key
set JWT_SECRET_KEY=jwt-secret-key-academic-writing

REM 启动后端（在后台运行）
start "Backend Server" go run cmd/server/main.go
echo 后端服务启动中...
timeout /t 5 /nobreak >nul
echo ✓ 后端服务已启动
exit /b 0

:start_frontend
echo 启动前端服务...
call npm install
if errorlevel 1 (
    echo 错误: 安装依赖失败
    pause
    exit /b 1
)
echo 依赖安装完成

REM 启动前端（在后台运行）
start "Frontend Server" npm run dev
echo 前端服务启动中...
timeout /t 10 /nobreak >nul
echo ✓ 前端服务已启动
exit /b 0

:stop_all
echo 停止所有服务...
taskkill /F /IM node.exe >nul 2>&1
taskkill /F /IM go.exe >nul 2>&1
docker stop mysql-temp >nul 2>&1
echo ✓ 所有服务已停止
exit /b 0