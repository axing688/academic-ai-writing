package main

import (
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"academic-writing-assistant/cmd/server/internal/ai"
	"academic-writing-assistant/cmd/server/internal/api"
	"academic-writing-assistant/cmd/server/internal/database"
	"academic-writing-assistant/configs"

	"github.com/gin-gonic/gin"
	"github.com/sirupsen/logrus"
)

func main() {
	// 加载配置
	config := configs.LoadConfig()

	// 初始化数据库
	db, err := database.InitDB(config)
	if err != nil {
		log.Fatalf("Failed to initialize database: %v", err)
	}

	// 初始化AI服务
	aiService, err := ai.InitAIService(*config)
	if err != nil {
		log.Fatalf("Failed to initialize AI service: %v", err)
	}

	// 设置Gin模式
	if config.Server.Mode == "production" {
		gin.SetMode(gin.ReleaseMode)
	}

	// 创建路由
	router := api.SetupRouter(db, aiService, config)

	// 启动服务器
	srv := &http.Server{
		Addr:         ":" + config.Server.Port,
		Handler:      router,
		ReadTimeout:  15 * time.Second,
		WriteTimeout: 120 * time.Second,
		IdleTimeout:  60 * time.Second,
	}

	logrus.Info("Server starting on port " + config.Server.Port)

	// 优雅关闭
	go func() {
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("Server error: %v", err)
		}
	}()

	// 等待中断信号
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit
	logrus.Info("Shutting down server...")
}
