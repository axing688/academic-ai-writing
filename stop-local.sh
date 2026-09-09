#!/bin/bash

# 停止本地运行脚本

echo "===================================="
echo "停止学术写作助手项目服务"
echo "===================================="

# 停止后端
if [ -f .backend.pid ]; then
    BACKEND_PID=$(cat .backend.pid)
    if ps -p $BACKEND_PID > /dev/null; then
        echo "停止后端服务 (PID: $BACKEND_PID)..."
        kill $BACKEND_PID
        sleep 2
    fi
    rm .backend.pid
else
    # 尝试查找后端进程
    echo "查找后端进程..."
    pkill -f "go run cmd/server/main.go"
fi

# 停止前端
if [ -f .frontend.pid ]; then
    FRONTEND_PID=$(cat .frontend.pid)
    if ps -p $FRONTEND_PID > /dev/null; then
        echo "停止前端服务 (PID: $FRONTEND_PID)..."
        kill $FRONTEND_PID
        sleep 2
    fi
    rm .frontend.pid
else
    # 尝试查找前端进程
    echo "查找前端进程..."
    pkill -f "npm run dev"
fi

echo "✓ 所有服务已停止"