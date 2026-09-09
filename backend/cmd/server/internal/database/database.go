package database

import (
	"fmt"
	"log"

	"academic-writing-assistant/configs"
	"academic-writing-assistant/pkg/models"

	"gorm.io/driver/mysql"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

var DB *gorm.DB

func InitDB(cfg *configs.Config) (*gorm.DB, error) {
	// sslmode 为 true/require 时启用 TLS（连接 TiDB Cloud、Aiven 等云数据库必需）
	tlsParam := ""
	if cfg.Database.SSLMode == "true" || cfg.Database.SSLMode == "require" {
		tlsParam = "&tls=true"
	}
	dsn := fmt.Sprintf("%s:%s@tcp(%s:%s)/%s?charset=utf8mb4&parseTime=True&loc=Local%s",
		cfg.Database.User,
		cfg.Database.Password,
		cfg.Database.Host,
		cfg.Database.Port,
		cfg.Database.DBName,
		tlsParam,
	)

	var err error
	DB, err = gorm.Open(mysql.Open(dsn), &gorm.Config{
		Logger: logger.Default.LogMode(logger.Warn),
	})
	if err != nil {
		return nil, fmt.Errorf("failed to connect database: %v", err)
	}

	// 自动迁移表
	if err := autoMigrate(); err != nil {
		return nil, fmt.Errorf("failed to migrate database: %v", err)
	}

	log.Println("Database connected successfully")
	return DB, nil
}

func autoMigrate() error {
	return DB.AutoMigrate(
		&models.User{},
		&models.Document{},
		&models.WritingRecord{},
		&models.AICall{},
	)
}

// GetDB 获取数据库实例
func GetDB() *gorm.DB {
	return DB
}
