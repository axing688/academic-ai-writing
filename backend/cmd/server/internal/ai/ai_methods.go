package ai

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"
)

func (s *AIService) CheckGrammar(ctx context.Context, text string) (*GrammarCheckResponse, error) {
	// 构建检查语法的提示词
	prompt := fmt.Sprintf(`
请检查以下文本的语法和表达问题，并提供修改建议：

文本：
%s

请检查以下方面：
1. 语法错误
2. 拼写错误
3. 标点符号使用
4. 表达清晰度
5. 学术写作规范

请按照以下JSON格式返回结果：
{
  "is_correct": true/false,
  "errors": [
    {
      "message": "错误描述",
      "start_pos": 位置,
      "end_pos": 位置,
      "type": "错误类型",
      "severity": "严重程度"
    }
  ],
  "suggestions": ["建议1", "建议2"],
  "score": 0.0-1.0
}
`, text)

	// 调用AI生成检查结果
	response, err := s.GenerateContent(ctx, prompt, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to generate grammar check: %v", err)
	}

	// 解析JSON响应
	var checkResponse GrammarCheckResponse
	if err := json.Unmarshal([]byte(response.Content), &checkResponse); err != nil {
		// 如果JSON解析失败，进行简单的文本分析
		return s.simpleGrammarCheck(text)
	}

	return &checkResponse, nil
}

// 简单的语法检查实现（备用方案）
func (s *AIService) simpleGrammarCheck(text string) (*GrammarCheckResponse, error) {
	errors := make([]GrammarError, 0)
	suggestions := make([]string, 0)
	score := 1.0

	// 检查常见问题
	commonErrors := map[string]GrammarError{
		"的的": {
			Message:  "过度使用'的'",
			Type:     "过度使用",
			Severity: "中等",
		},
		"了了": {
			Message:  "过度使用'了'",
			Type:     "过度使用",
			Severity: "中等",
		},
		"，，": {
			Message:  "逗号使用不当",
			Type:     "标点错误",
			Severity: "严重",
		},
	}

	for pattern, errorInfo := range commonErrors {
		if strings.Contains(text, pattern) {
			errors = append(errors, errorInfo)
			score -= 0.1
		}
	}

	// 检查句子长度
	sentences := strings.Split(text, "。")
	for _, sentence := range sentences {
		if len(strings.TrimSpace(sentence)) > 100 {
			suggestions = append(suggestions, "建议将长句子拆分，提高可读性")
		}
	}

	// 确保分数在0-1之间
	if score < 0 {
		score = 0
	} else if score > 1 {
		score = 1
	}

	if len(errors) == 0 {
		suggestions = append(suggestions, "语法检查通过，表达清晰")
	}

	return &GrammarCheckResponse{
		IsCorrect:   len(errors) == 0,
		Errors:     errors,
		Suggestions: suggestions,
		Score:      score,
	}, nil
}

func (s *AIService) SuggestTopics(ctx context.Context, discipline string, interests []string) (*TopicSuggestionResponse, error) {
	// 构建提示词
	interestsStr := strings.Join(interests, "、")
	prompt := fmt.Sprintf(`
你是学术写作专家，请为研究生提供论文选题建议。背景信息：
- 学科：%s
- 研究兴趣：%s
- 要求：创新性强、可行性高

请提供3-5个选题建议，按照以下JSON格式返回：
{
  "topics": [
    {
      "title": "选题标题",
      "description": "研究描述",
      "innovation": ["创新点1", "创新点2"],
      "feasibility": "可行性分析"
    }
  ]
}
`, discipline, interestsStr)

	// 调用AI生成选题建议
	response, err := s.GenerateContent(ctx, prompt, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to generate topic suggestions: %v", err)
	}

	// 解析JSON响应
	var topicResponse TopicSuggestionResponse
	if err := json.Unmarshal([]byte(response.Content), &topicResponse); err != nil {
		// 如果JSON解析失败，返回默认建议
		return s.defaultTopicSuggestions(discipline, interests)
	}

	return &topicResponse, nil
}

// 默认选题建议（备用方案）
func (s *AIService) defaultTopicSuggestions(discipline string, interests []string) (*TopicSuggestionResponse, error) {
	topics := []Topic{
		{
			Title:       fmt.Sprintf("%s领域的创新研究", discipline),
			Description: fmt.Sprintf("探索%s领域的最新发展和技术创新", discipline),
			Innovation:  []string{"新技术应用", "跨学科融合", "方法创新"},
			Feasibility: "结合现有研究基础，具有较强的可行性",
		},
		{
			Title:       fmt.Sprintf("%s与人工智能的结合应用", strings.Join(interests, "与")),
			Description: fmt.Sprintf("研究人工智能技术在%s领域的应用和优化", strings.Join(interests, "与")),
			Innovation:  []string{"智能化改进", "效率提升", "自动化流程"},
			Feasibility: "技术成熟度高，应用场景明确",
		},
	}

	return &TopicSuggestionResponse{
		Topics: topics,
	}, nil
}