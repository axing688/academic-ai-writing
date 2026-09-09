package configs

import (
	"strings"

	"github.com/sirupsen/logrus"
	"github.com/spf13/viper"
)

type Config struct {
	Server   ServerConfig   `mapstructure:"server"`
	Database DatabaseConfig `mapstructure:"database"`
	Redis    RedisConfig    `mapstructure:"redis"`
	AI       AIConfig       `mapstructure:"ai"`
	JWT      JWTConfig     `mapstructure:"jwt"`
}

type ServerConfig struct {
	Mode     string `mapstructure:"mode"`
	Port     string `mapstructure:"port"`
	Secret   string `mapstructure:"secret"`
}

type DatabaseConfig struct {
	Host     string `mapstructure:"host"`
	Port     string `mapstructure:"port"`
	User     string `mapstructure:"user"`
	Password string `mapstructure:"password"`
	DBName   string `mapstructure:"dbname"`
	SSLMode  string `mapstructure:"sslmode"`
}

type RedisConfig struct {
	Host     string `mapstructure:"host"`
	Port     string `mapstructure:"port"`
	Password string `mapstructure:"password"`
	DB       int    `mapstructure:"db"`
}

type AIConfig struct {
	Provider     string `mapstructure:"provider"`
	Model        string `mapstructure:"model"`
	APIKey       string `mapstructure:"api_key"`
	BaseURL      string `mapstructure:"base_url"`
	MaxTokens    int    `mapstructure:"max_tokens"`
	Temperature  float64 `mapstructure:"temperature"`
}

type JWTConfig struct {
	SecretKey string `mapstructure:"secret_key"`
	Issuer     string `mapstructure:"issuer"`
	ExpiresAt  int    `mapstructure:"expires_at"` // in hours
}

func LoadConfig() *Config {
	viper.SetConfigName("config")
	viper.SetConfigType("yaml")
	viper.AddConfigPath(".")
	viper.AddConfigPath("./configs")

	// 设置默认值
	setDefaults()

	// 读取环境变量：DATABASE_HOST -> database.host（Docker 部署用）
	viper.AutomaticEnv()
	viper.SetEnvKeyReplacer(strings.NewReplacer(".", "_"))

	// AI 默认值
	viper.SetDefault("ai.base_url", "https://dashscope.aliyuncs.com/compatible-mode/v1")

	var config Config
	if err := viper.ReadInConfig(); err != nil {
		// 如果配置文件不存在，使用默认值
		logrus.Warn("Config file not found, using defaults")
	}

	if err := viper.Unmarshal(&config); err != nil {
		panic(err)
	}

	return &config
}

func setDefaults() {
	// Server defaults
	viper.SetDefault("server.mode", "development")
	viper.SetDefault("server.port", "8080")
	viper.SetDefault("server.secret", "your-secret-key")

	// Database defaults
	viper.SetDefault("database.host", "localhost")
	viper.SetDefault("database.port", "3306")
	viper.SetDefault("database.user", "root")
	viper.SetDefault("database.password", "password")
	viper.SetDefault("database.dbname", "academic_writing")
	viper.SetDefault("database.sslmode", "false")

	// Redis defaults
	viper.SetDefault("redis.host", "localhost")
	viper.SetDefault("redis.port", "6379")
	viper.SetDefault("redis.password", "")
	viper.SetDefault("redis.db", 0)

	// AI defaults
	viper.SetDefault("ai.provider", "dashscope")
	viper.SetDefault("ai.model", "qwen-turbo")
	viper.SetDefault("ai.max_tokens", 2048)
	viper.SetDefault("ai.temperature", 0.7)

	// JWT defaults
	viper.SetDefault("jwt.secret_key", "jwt-secret-key")
	viper.SetDefault("jwt.issuer", "academic-writing-assistant")
	viper.SetDefault("jwt.expires_at", 24)
}