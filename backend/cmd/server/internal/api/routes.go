package api

import (
	"net/http"
	"time"

	"academic-writing-assistant/cmd/server/internal/ai"
	"academic-writing-assistant/configs"

	"github.com/gin-gonic/gin"
	"github.com/sirupsen/logrus"
	"gorm.io/gorm"
)

type Router struct {
	db        *gorm.DB
	aiService *ai.AIService
	config    *configs.Config
}

func SetupRouter(db *gorm.DB, aiService *ai.AIService, config *configs.Config) *gin.Engine {
	router := gin.Default()

	router.Use(CORSMiddleware())
	router.Use(RequestLogger())

	// 初始化路由器
	r := &Router{
		db:        db,
		aiService: aiService,
		config:    config,
	}

	// API路由
	apiGroup := router.Group("/api")
	{
		// 认证相关
		auth := apiGroup.Group("/auth")
		{
			auth.POST("/register", r.Register)
			auth.POST("/login", r.Login)
			auth.GET("/me", r.AuthMiddleware(), r.GetProfile)
		}

		// 文档相关
		documents := apiGroup.Group("/documents")
		documents.Use(r.AuthMiddleware())
		{
			documents.GET("", r.ListDocuments)
			documents.POST("", r.CreateDocument)
			documents.GET("/:id", r.GetDocument)
			documents.PUT("/:id", r.UpdateDocument)
			documents.DELETE("/:id", r.DeleteDocument)
			documents.POST("/:id/export", r.ExportDocument)
		}

		// AI相关
		aiRoutes := apiGroup.Group("/ai")
		aiRoutes.Use(r.AuthMiddleware())
		{
			aiRoutes.POST("/generate-content", r.GenerateContent)
			aiRoutes.POST("/check-grammar", r.CheckGrammar)
			aiRoutes.POST("/suggest-topics", r.SuggestTopics)
			aiRoutes.GET("/stats", r.GetAIStats)
		}

		// 用户相关
		user := apiGroup.Group("/user")
		user.Use(r.AuthMiddleware())
		{
			user.PUT("/profile", r.UpdateProfile)
			user.PUT("/preferences", r.UpdatePreferences)
		}
	}

	// 健康检查
	router.GET("/health", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{
			"status":    "ok",
			"timestamp": time.Now().Format(time.RFC3339),
			"version":   "1.0.0",
		})
	})

	return router
}

// CORSMiddleware 跨域中间件
func CORSMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		c.Header("Access-Control-Allow-Origin", "*")
		c.Header("Access-Control-Allow-Credentials", "true")
		c.Header("Access-Control-Allow-Headers", "Content-Type, Content-Length, Accept-Encoding, X-CSRF-Token, Authorization, accept, origin, Cache-Control, X-Requested-With")
		c.Header("Access-Control-Allow-Methods", "POST, OPTIONS, GET, PUT, DELETE")

		if c.Request.Method == "OPTIONS" {
			c.AbortWithStatus(204)
			return
		}

		c.Next()
	}
}

// RequestLogger 请求日志中间件
func RequestLogger() gin.HandlerFunc {
	return func(c *gin.Context) {
		start := time.Now()

		// 处理请求
		c.Next()

		logrus.WithFields(logrus.Fields{
			"method":   c.Request.Method,
			"path":     c.Request.URL.Path,
			"status":   c.Writer.Status(),
			"duration": time.Since(start).String(),
			"ip":       c.ClientIP(),
		}).Info("Request processed")
	}
}
