package api

import (
	"context"
	"net/http"
	"strings"
	"time"

	"academic-writing-assistant/pkg/models"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	"golang.org/x/crypto/bcrypt"
)

// ---------------- 认证 ----------------

type registerReq struct {
	Username string `json:"username" binding:"required,min=2,max=32"`
	Email    string `json:"email" binding:"required,email"`
	Password string `json:"password" binding:"required,min=6"`
	FullName string `json:"full_name"`
}

func (r *Router) Register(c *gin.Context) {
	var req registerReq
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "密码加密失败"})
		return
	}

	user := models.User{
		Username: req.Username,
		Email:    req.Email,
		Password: string(hash),
		FullName: req.FullName,
	}
	if err := r.db.Create(&user).Error; err != nil {
		if strings.Contains(err.Error(), "Duplicate") || strings.Contains(err.Error(), "duplicate") {
			c.JSON(http.StatusConflict, gin.H{"error": "用户名或邮箱已存在"})
		} else {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "注册失败"})
		}
		return
	}

	token, err := r.issueToken(user.ID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "生成令牌失败"})
		return
	}
	c.JSON(http.StatusCreated, gin.H{"token": token, "user": user})
}

type loginReq struct {
	Username string `json:"username" binding:"required"`
	Password string `json:"password" binding:"required"`
}

func (r *Router) Login(c *gin.Context) {
	var req loginReq
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	var user models.User
	if err := r.db.Where("username = ? OR email = ?", req.Username, req.Username).First(&user).Error; err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "用户不存在或密码错误"})
		return
	}
	if err := bcrypt.CompareHashAndPassword([]byte(user.Password), []byte(req.Password)); err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "用户不存在或密码错误"})
		return
	}

	now := time.Now()
	r.db.Model(&user).Update("last_login", &now)

	token, err := r.issueToken(user.ID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "生成令牌失败"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"token": token, "user": user})
}

func (r *Router) issueToken(userID string) (string, error) {
	claims := jwt.MapClaims{
		"user_id":   userID,
		"issuer":    r.config.JWT.Issuer,
		"expires_at": time.Now().Add(time.Duration(r.config.JWT.ExpiresAt) * time.Hour).Unix(),
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString([]byte(r.config.JWT.SecretKey))
}

func (r *Router) AuthMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		header := c.GetHeader("Authorization")
		if !strings.HasPrefix(header, "Bearer ") {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "缺少认证令牌"})
			return
		}
		tokenStr := strings.TrimPrefix(header, "Bearer ")

		token, err := jwt.Parse(tokenStr, func(t *jwt.Token) (interface{}, error) {
			if _, ok := t.Method.(*jwt.SigningMethodHMAC); !ok {
				return nil, jwt.ErrSignatureInvalid
			}
			return []byte(r.config.JWT.SecretKey), nil
		})
		if err != nil || !token.Valid {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "令牌无效或已过期"})
			return
		}

		claims, ok := token.Claims.(jwt.MapClaims)
		if !ok {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "令牌解析失败"})
			return
		}
		userID, _ := claims["user_id"].(string)
		c.Set("user_id", userID)
		c.Next()
	}
}

func currentUserID(c *gin.Context) string {
	v, _ := c.Get("user_id")
	s, _ := v.(string)
	return s
}

// ---------------- 用户 ----------------

func (r *Router) GetProfile(c *gin.Context) {
	var user models.User
	if err := r.db.First(&user, "id = ?", currentUserID(c)).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "用户不存在"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"user": user})
}

func (r *Router) UpdateProfile(c *gin.Context) {
	var req struct {
		FullName string `json:"full_name"`
		Avatar   string `json:"avatar"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	updates := map[string]interface{}{}
	if req.FullName != "" {
		updates["full_name"] = req.FullName
	}
	if req.Avatar != "" {
		updates["avatar"] = req.Avatar
	}
	if err := r.db.Model(&models.User{}).Where("id = ?", currentUserID(c)).Updates(updates).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "更新失败"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "ok"})
}

func (r *Router) UpdatePreferences(c *gin.Context) {
	var req struct {
		Preferences string `json:"preferences" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if err := r.db.Model(&models.User{}).Where("id = ?", currentUserID(c)).
		Update("preferences", req.Preferences).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "更新失败"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "ok"})
}

// ---------------- 文档 ----------------

func (r *Router) ListDocuments(c *gin.Context) {
	var docs []models.Document
	q := r.db.Where("user_id = ?", currentUserID(c)).Order("updated_at DESC")
	if status := c.Query("status"); status != "" {
		q = q.Where("status = ?", status)
	}
	if err := q.Find(&docs).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "查询失败"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"documents": docs, "total": len(docs)})
}

func (r *Router) CreateDocument(c *gin.Context) {
	var req struct {
		Title   string `json:"title" binding:"required"`
		Content string `json:"content"`
		Type    string `json:"type"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if req.Type == "" {
		req.Type = "markdown"
	}
	doc := models.Document{
		UserID:    currentUserID(c),
		Title:     req.Title,
		Content:   req.Content,
		Type:      req.Type,
		WordCount: len([]rune(req.Content)),
	}
	if err := r.db.Create(&doc).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "创建失败"})
		return
	}
	c.JSON(http.StatusCreated, doc)
}

func (r *Router) GetDocument(c *gin.Context) {
	var doc models.Document
	if err := r.db.Where("id = ? AND user_id = ?", c.Param("id"), currentUserID(c)).First(&doc).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "文档不存在"})
		return
	}
	c.JSON(http.StatusOK, doc)
}

func (r *Router) UpdateDocument(c *gin.Context) {
	var req struct {
		Title   *string `json:"title"`
		Content *string `json:"content"`
		Status  *string `json:"status"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	var doc models.Document
	if err := r.db.Where("id = ? AND user_id = ?", c.Param("id"), currentUserID(c)).First(&doc).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "文档不存在"})
		return
	}

	updates := map[string]interface{}{}
	if req.Title != nil {
		updates["title"] = *req.Title
	}
	if req.Content != nil {
		updates["content"] = *req.Content
		updates["word_count"] = len([]rune(*req.Content))
	}
	if req.Status != nil {
		updates["status"] = *req.Status
	}
	if err := r.db.Model(&doc).Updates(updates).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "更新失败"})
		return
	}
	c.JSON(http.StatusOK, doc)
}

func (r *Router) DeleteDocument(c *gin.Context) {
	res := r.db.Where("id = ? AND user_id = ?", c.Param("id"), currentUserID(c)).Delete(&models.Document{})
	if res.Error != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "删除失败"})
		return
	}
	if res.RowsAffected == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "文档不存在"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "ok"})
}

func (r *Router) ExportDocument(c *gin.Context) {
	var doc models.Document
	if err := r.db.Where("id = ? AND user_id = ?", c.Param("id"), currentUserID(c)).First(&doc).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "文档不存在"})
		return
	}
	c.Header("Content-Disposition", "attachment; filename=document.md")
	c.Data(http.StatusOK, "text/markdown; charset=utf-8", []byte(doc.Content))
}

// ---------------- AI ----------------

type generateReq struct {
	Prompt   string `json:"prompt" binding:"required"`
	TaskType string `json:"task_type"`
}

func (r *Router) GenerateContent(c *gin.Context) {
	var req generateReq
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), 60*time.Second)
	defer cancel()

	resp, err := r.aiService.GenerateContent(ctx, req.Prompt, nil)
	if err != nil {
		c.JSON(http.StatusBadGateway, gin.H{"error": "AI 服务调用失败: " + err.Error()})
		return
	}

	// 记录调用
	r.db.Create(&models.AICall{
		UserID:       currentUserID(c),
		ModelType:    r.config.AI.Model,
		PromptType:   req.TaskType,
		InputText:    req.Prompt,
		OutputText:   resp.Content,
		TokensUsed:   resp.TokensUsed,
		ResponseTime: int(resp.Duration),
	})

	c.JSON(http.StatusOK, gin.H{"content": resp.Content, "tokens_used": resp.TokensUsed})
}

func (r *Router) CheckGrammar(c *gin.Context) {
	var req struct {
		Text string `json:"text" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), 60*time.Second)
	defer cancel()

	resp, err := r.aiService.CheckGrammar(ctx, req.Text)
	if err != nil {
		c.JSON(http.StatusBadGateway, gin.H{"error": "AI 服务调用失败: " + err.Error()})
		return
	}
	c.JSON(http.StatusOK, resp)
}

func (r *Router) SuggestTopics(c *gin.Context) {
	var req struct {
		Discipline string   `json:"discipline" binding:"required"`
		Interests  []string `json:"interests"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), 60*time.Second)
	defer cancel()

	resp, err := r.aiService.SuggestTopics(ctx, req.Discipline, req.Interests)
	if err != nil {
		c.JSON(http.StatusBadGateway, gin.H{"error": "AI 服务调用失败: " + err.Error()})
		return
	}
	c.JSON(http.StatusOK, resp)
}

func (r *Router) GetAIStats(c *gin.Context) {
	var total int64
	var tokens int64
	r.db.Model(&models.AICall{}).Where("user_id = ?", currentUserID(c)).Count(&total)
	r.db.Model(&models.AICall{}).Where("user_id = ?", currentUserID(c)).
		Select("COALESCE(SUM(tokens_used), 0)").Scan(&tokens)

	var byType []struct {
		PromptType string `json:"prompt_type"`
		Count      int64  `json:"count"`
	}
	r.db.Model(&models.AICall{}).
		Where("user_id = ?", currentUserID(c)).
		Select("prompt_type, COUNT(*) as count").
		Group("prompt_type").
		Scan(&byType)

	c.JSON(http.StatusOK, gin.H{
		"total_calls": total,
		"tokens_used": tokens,
		"by_type":     byType,
	})
}
