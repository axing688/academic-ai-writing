@echo off
setlocal enabledelayedexpansion
chcp 65001 >nul
title 研究生学术写作助手 - Docker 部署

echo ====================================
echo 研究生学术写作助手 - Docker 本地部署
echo ====================================

REM ---- 0. 用户级安装的 Docker 工具目录需要加入 PATH（docker-credential-desktop 等）----
if exist "%LOCALAPPDATA%\Programs\DockerDesktop\resources\bin" set "PATH=%LOCALAPPDATA%\Programs\DockerDesktop\resources\bin;%PATH%"

REM ---- 1. 定位 docker.exe（支持系统级 / 用户级安装）----
set "DOCKER_CMD=docker"
docker --version >nul 2>&1
if not errorlevel 1 goto daemoncheck

if exist "%LOCALAPPDATA%\Programs\DockerDesktop\resources\bin\docker.exe" (
    set "DOCKER_CMD=%LOCALAPPDATA%\Programs\DockerDesktop\resources\bin\docker.exe"
    echo 已找到用户级 Docker 安装
    goto daemoncheck
)
if exist "%LOCALAPPDATA%\Docker\resources\bin\docker.exe" (
    set "DOCKER_CMD=%LOCALAPPDATA%\Docker\resources\bin\docker.exe"
    echo 已找到用户级 Docker 安装
    goto daemoncheck
)
if exist "C:\Program Files\Docker\Docker\resources\bin\docker.exe" (
    set "DOCKER_CMD=C:\Program Files\Docker\Docker\resources\bin\docker.exe"
    echo 已找到系统级 Docker 安装
    goto daemoncheck
)

echo [错误] 未找到 docker.exe，请先安装 Docker Desktop
pause
exit /b 1

:daemoncheck
!DOCKER_CMD! --version
!DOCKER_CMD! info >nul 2>&1
if not errorlevel 1 goto engine_ready

REM ---- 2. 守护进程未运行，自动启动 Docker Desktop 并等待 ----
echo Docker 守护进程未运行，正在启动 Docker Desktop...
if exist "%LOCALAPPDATA%\Programs\DockerDesktop\Docker Desktop.exe" (
    start "" "%LOCALAPPDATA%\Programs\DockerDesktop\Docker Desktop.exe"
    goto waitloop
)
if exist "C:\Program Files\Docker\Docker\Docker Desktop.exe" (
    start "" "C:\Program Files\Docker\Docker\Docker Desktop.exe"
    goto waitloop
)
echo [提示] 未找到 Docker Desktop 主程序，请手动启动它后重新运行本脚本。
pause
exit /b 1

:waitloop
echo 等待 Docker 引擎就绪（最长 120 秒）...
set /a tries=0
:wait_next
timeout /t 5 /nobreak >nul
set /a tries+=1
!DOCKER_CMD! info >nul 2>&1
if not errorlevel 1 goto engine_ready
if !tries! lss 24 goto wait_next
echo [错误] Docker 引擎 120 秒内未就绪。
echo        请手动打开 Docker Desktop，确认状态栏图标停止转圈后，再重新运行本脚本。
pause
exit /b 1

:engine_ready
echo Docker 引擎已就绪 ✓

REM ---- 3. 构建并启动全部服务 ----
echo 正在构建并启动服务（首次构建约需 5-15 分钟）...
!DOCKER_CMD! compose up -d --build
if errorlevel 1 (
    echo [错误] 服务启动失败，可运行下面命令查看日志：
    echo   !DOCKER_CMD! compose logs
    pause
    exit /b 1
)

echo 等待服务就绪...
timeout /t 10 /nobreak >nul
!DOCKER_CMD! compose ps

echo.
echo ====================================
echo 部署完成！
echo   前端地址: http://localhost:3000
echo   后端接口: http://localhost:8080/health
echo   MySQL:    localhost:3306 (app_user / app_password)
echo   Redis:    localhost:6379
echo ====================================
echo 常用命令:
echo   查看日志: !DOCKER_CMD! compose logs -f
echo   停止服务: !DOCKER_CMD! compose down
echo   重新构建: !DOCKER_CMD! compose up -d --build
echo ====================================

echo.
echo 按任意键直接打开前端页面...
pause >nul
start http://localhost:3000
exit /b 0
