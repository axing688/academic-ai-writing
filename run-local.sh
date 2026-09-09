#!/bin/bash

# 本地运行脚本 - Linux/Mac

echo "===================================="
echo "学术写作助手项目 - 本地启动脚本"
echo "===================================="

# 检查必要命令
check_command() {
    if ! command -v $1 &> /dev/null; then
        echo "❌ $1 未安装，请先安装 $1"
        exit 1
    fi
    echo "✓ $1 已安装"
}

echo "1. 检查环境..."
check_command node
check_command npm
check_command go

echo ""
echo "2. 创建环境变量文件..."
if [ ! -f .env ]; then
    cp .env.example .env
    echo "✓ 已创建 .env 文件"
    echo ""
    echo "⚠️  请编辑 .env 文件，填入你的 DashScope API Key"
    echo ""
else
    echo "✓ .env 文件已存在"
fi

echo ""
echo "3. 启动 MySQL（如果未运行）..."
if ! pgrep mysql > /dev/null; then
    echo "启动 MySQL..."
    if command -v mysql.server &> /dev/null; then
        mysql.server start
    elif command -v systemctl &> /dev/null; then
        sudo systemctl start mysql
    fi
    sleep 3
    echo "✓ MySQL 已启动"
else
    echo "✓ MySQL 正在运行"
fi

echo ""
echo "4. 创建数据库..."
mysql -u root -p -e "CREATE DATABASE IF NOT EXISTS academic_writing CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;" 2>/dev/null
if [ $? -ne 0 ]; then
    echo "⚠️  数据库创建失败，可能需要手动创建"
else
    echo "✓ 数据库已创建"
fi

echo ""
echo "5. 启动后端服务..."
cd backend
go mod download
if [ $? -eq 0 ]; then
    echo "✓ 依赖下载完成"

    # 设置环境变量
    export DB_HOST=localhost
    export DB_PORT=3306
    export DB_USER=root
    export DB_PASSWORD=
    export DB_NAME=academic_writing
    export REDIS_HOST=localhost
    export REDIS_PORT=6379
    export AI_PROVIDER=dashscope
    export AI_MODEL=qwen-turbo
    export AI_API_KEY=your_dashscope_api_key
    export JWT_SECRET_KEY=jwt-secret-key-academic-writing

    # 启动后端
    echo "启动后端服务器..."
    nohup go run cmd/server/main.go > ../logs/backend.log 2>&1 &
    BACKEND_PID=$!
    echo "✓ 后端服务已启动 (PID: $BACKEND_PID)"

    # 等待后端启动
    sleep 5

    # 检查后端是否运行
    if curl -s http://localhost:8080/health > /dev/null; then
        echo "✓ 后端服务健康检查通过"
    else
        echo "⚠️  后端服务可能启动失败，请查看 logs/backend.log"
    fi
else
    echo "❌ 依赖下载失败"
    exit 1
fi

cd ..

echo ""
echo "6. 启动前端服务..."
cd frontend
npm install
if [ $? -eq 0 ]; then
    echo "✓ 前端依赖安装完成"

    # 启动前端
    echo "启动前端服务器..."
    nohup npm run dev > ../logs/frontend.log 2>&1 &
    FRONTEND_PID=$!
    echo "✓ 前端服务已启动 (PID: $FRONTEND_PID)"

    # 等待前端启动
    sleep 10

    # 检查前端是否运行
    if curl -s http://localhost:3000 > /dev/null; then
        echo "✓ 前端服务已启动"
    else
        echo "⚠️  前端服务可能启动失败，请查看 logs/frontend.log"
    fi
else
    echo "❌ 前端依赖安装失败"
    kill $BACKEND_PID 2>/dev/null
    exit 1
fi

cd ..

echo ""
echo "===================================="
echo "服务启动完成！"
echo ""
echo "访问地址:"
echo "前端: http://localhost:3000"
echo "后端 API: http://localhost:8080"
echo ""
echo "日志文件:"
echo "后端: logs/backend.log"
echo "前端: logs/frontend.log"
echo ""
echo "停止服务:"
echo "./stop-local.sh"
echo ""
echo "===================================="

# 保存进程 ID
echo $BACKEND_PID > .backend.pid
echo $FRONTEND_PID > .frontend.pid