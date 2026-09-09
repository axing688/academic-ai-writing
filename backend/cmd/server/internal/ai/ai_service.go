package ai

import (
	"academic-writing-assistant/configs"
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"
)

type AIService struct {
	config configs.AIConfig
	client *http.Client
}

type AIClient interface {
	GenerateContent(ctx context.Context, prompt string, options *GenerateOptions) (*GenerateResponse, error)
	CheckGrammar(ctx context.Context, text string) (*GrammarCheckResponse, error)
	SuggestTopics(ctx context.Context, discipline string, interests []string) (*TopicSuggestionResponse, error)
}

type GenerateOptions struct {
	Model      string  `json:"model"`
	MaxTokens  int     `json:"max_tokens"`
	Temperature float64 `json:"temperature"`
}

type GenerateResponse struct {
	Content    string  `json:"content"`
	TokensUsed int     `json:"tokens_used"`
	Duration   float64 `json:"duration_ms"`
}

type GrammarCheckResponse struct {
	IsCorrect   bool     `json:"is_correct"`
	Errors      []GrammarError `json:"errors"`
	Suggestions []string `json:"suggestions"`
	Score       float64  `json:"score"`
}

type GrammarError struct {
	Message   string `json:"message"`
	StartPos  int    `json:"start_pos"`
	EndPos    int    `json:"end_pos"`
	Type      string `json:"type"`
	Severity  string `json:"severity"`
}

type TopicSuggestionResponse struct {
	Topics []Topic `json:"topics"`
}

type Topic struct {
	Title        string   `json:"title"`
	Description  string   `json:"description"`
	Innovation   []string `json:"innovation"`
	Feasibility  string   `json:"feasibility"`
}

func InitAIService(config configs.Config) (*AIService, error) {
	client := &http.Client{
		Timeout: 30 * time.Second,
	}

	service := &AIService{
		config: config.AI,
		client: client,
	}

	return service, nil
}

func (s *AIService) GenerateContent(ctx context.Context, prompt string, options *GenerateOptions) (*GenerateResponse, error) {
	// 设置默认选项
	if options == nil {
		options = &GenerateOptions{
			Model:      s.config.Model,
			MaxTokens:  s.config.MaxTokens,
			Temperature: s.config.Temperature,
		}
	}

	// 构建请求
	request := map[string]interface{}{
		"model": options.Model,
		"messages": []map[string]string{
			{
				"role":    "user",
				"content": prompt,
			},
		},
		"max_tokens":  options.MaxTokens,
		"temperature": options.Temperature,
	}

	// 序列化请求
	reqBody, err := json.Marshal(request)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal request: %v", err)
	}

	// 创建HTTP请求
	req, err := http.NewRequestWithContext(ctx, "POST", s.config.BaseURL+"/chat/completions", io.NopCloser(bytes.NewReader(reqBody)))
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %v", err)
	}

	// 设置请求头
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+s.config.APIKey)

	// 发送请求
	start := time.Now()
	resp, err := s.client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to send request: %v", err)
	}
	defer resp.Body.Close()

	// 读取响应
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read response: %v", err)
	}

	// 解析响应
	var apiResponse map[string]interface{}
	if err := json.Unmarshal(body, &apiResponse); err != nil {
		return nil, fmt.Errorf("failed to unmarshal response: %v", err)
	}

	// 提取内容
	choices, ok := apiResponse["choices"].([]interface{})
	if !ok || len(choices) == 0 {
		return nil, fmt.Errorf("invalid response format")
	}

	choice := choices[0].(map[string]interface{})["message"].(map[string]interface{})["content"].(string)

	// 提取token使用量
	usage, ok := apiResponse["usage"].(map[string]interface{})
	tokensUsed := 0
	if ok {
		if tokens, ok := usage["total_tokens"].(float64); ok {
			tokensUsed = int(tokens)
		}
	}

	// 计算耗时
	duration := time.Since(start).Milliseconds()

	return &GenerateResponse{
		Content:    choice,
		TokensUsed: tokensUsed,
		Duration:   float64(duration),
	}, nil
}