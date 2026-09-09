# API 文档

## 基础信息

- **基础 URL**: `http://localhost:8080/api`
- **响应格式**: JSON
- **认证方式**: Bearer Token (JWT)

## 通用响应格式

### 成功响应
```json
{
  "code": 200,
  "message": "success",
  "data": {
    // 业务数据
  }
}
```

### 错误响应
```json
{
  "code": 400,
  "message": "参数错误",
  "error": "详细错误信息"
}
```

## 认证接口

### 用户注册
- **路径**: `POST /auth/register`
- **描述**: 创建新用户账户

**请求体**:
```json
{
  "username": "string",
  "email": "string",
  "password": "string",
  "student_id": "string"
}
```

**响应示例**:
```json
{
  "code": 200,
  "message": "注册成功",
  "data": {
    "id": "uuid",
    "username": "string",
    "email": "string"
  }
}
```

### 用户登录
- **路径**: `POST /auth/login`
- **描述**: 用户登录，返回 JWT token

**请求体**:
```json
{
  "username": "string",
  "password": "string"
}
```

**响应示例**:
```json
{
  "code": 200,
  "message": "登录成功",
  "data": {
    "token": "jwt_token_string",
    "user": {
      "id": "uuid",
      "username": "string",
      "email": "string"
    }
  }
}
```

### 获取当前用户
- **路径**: `GET /auth/me`
- **描述**: 获取当前登录用户信息
- **需要认证**: 是

**响应示例**:
```json
{
  "code": 200,
  "message": "success",
  "data": {
    "id": "uuid",
    "username": "string",
    "email": "string",
    "student_id": "string",
    "created_at": "2024-01-01T00:00:00Z"
  }
}
```

## 文档管理接口

### 获取文档列表
- **路径**: `GET /documents`
- **描述**: 获取当前用户的文档列表
- **需要认证**: 是

**查询参数**:
- `page`: 页码，默认 1
- `size`: 每页数量，默认 10
- `keyword`: 搜索关键词

**响应示例**:
```json
{
  "code": 200,
  "message": "success",
  "data": {
    "total": 100,
    "current": 1,
    "list": [
      {
        "id": "uuid",
        "title": "论文标题",
        "content": "文档内容预览...",
        "word_count": 1250,
        "created_at": "2024-01-01T00:00:00Z",
        "updated_at": "2024-01-01T12:00:00Z"
      }
    ]
  }
}
```

### 创建文档
- **路径**: `POST /documents`
- **描述**: 创建新文档
- **需要认证**: 是

**请求体**:
```json
{
  "title": "文档标题",
  "content": "文档内容",
  "type": "essay" // essay, report, thesis, proposal
}
```

**响应示例**:
```json
{
  "code": 200,
  "message": "创建成功",
  "data": {
    "id": "uuid",
    "title": "文档标题",
    "content": "文档内容",
    "type": "essay",
    "word_count": 1250,
    "created_at": "2024-01-01T00:00:00Z"
  }
}
```

### 获取文档详情
- **路径**: `GET /documents/:id`
- **描述**: 获取文档详细内容
- **需要认证**: 是

**响应示例**:
```json
{
  "code": 200,
  "message": "success",
  "data": {
    "id": "uuid",
    "title": "文档标题",
    "content": "完整文档内容",
    "type": "essay",
    "word_count": 1250,
    "created_at": "2024-01-01T00:00:00Z",
    "updated_at": "2024-01-01T00:00:00Z",
    "version": 1
  }
}
```

### 更新文档
- **路径**: `PUT /documents/:id`
- **描述**: 更新文档内容
- **需要认证**: 是

**请求体**:
```json
{
  "title": "新标题",
  "content": "更新后的内容"
}
```

### 删除文档
- **路径**: `DELETE /documents/:id`
- **描述**: 删除文档
- **需要认证**: 是

## AI 服务接口

### 生成内容
- **路径**: `POST /ai/generate-content`
- **描述**: 使用 AI 生成内容
- **需要认证**: 是

**请求体**:
```json
{
  "prompt": "生成一个关于人工智能的引言段落",
  "context": "这是一个关于人工智能的论文",
  "type": "introduction" // introduction, body, conclusion, summary
}
```

**响应示例**:
```json
{
  "code": 200,
  "message": "生成成功",
  "data": {
    "content": "生成的内容文本",
    "tokens_used": 150,
    "cost": 0.01
  }
}
```

### 语法检查
- **路径**: `POST /ai/check-grammar`
- **描述**: 检查文本语法错误
- **需要认证**: 是

**请求体**:
```json
{
  "text": "待检查的文本内容"
}
```

**响应示例**:
```json
{
  "code": 200,
  "message": "检查完成",
  "data": {
    "text": "检查后的文本",
    "corrections": [
      {
        "message": "主谓不一致",
        "start": 10,
        "end": 15,
        "suggestion": "改为 are",
        "severity": "error"
      }
    ],
    "score": 95
  }
}
```

### 选题建议
- **路径**: `POST /ai/suggest-topics`
- **描述**: 基于用户背景推荐研究选题
- **需要认证**: 是

**请求体**:
```json
{
  "discipline": "计算机科学",
  "interests": ["机器学习", "自然语言处理"],
  "research_level": "硕士" // 硕士, 博士, 博士后
}
```

**响应示例**:
```json
{
  "code": 200,
  "message": "建议成功",
  "data": {
    "topics": [
      {
        "title": "基于深度学习的文本生成研究",
        "description": "研究前沿文本生成技术的应用",
        "feasibility": "高",
        "novelty": "中"
      }
    ]
  }
}
```

## 写作统计接口

### 获取写作统计
- **路径**: `GET /writing-stats`
- **描述**: 获取用户写作统计数据
- **需要认证**: 是

**响应示例**:
```json
{
  "code": 200,
  "message": "success",
  "data": {
    "total_words": 50000,
    "total_documents": 20,
    "writing_sessions": 150,
    "avg_daily_words": 1000,
    "favorite_topics": ["人工智能", "机器学习"],
    "writing_trend": [
      {
        "date": "2024-01-01",
        "words": 1500
      }
    ]
  }
}
```

## 错误代码说明

| 代码 | 说明 |
|------|------|
| 200 | 成功 |
| 400 | 请求参数错误 |
| 401 | 未授权（token 无效） |
| 403 | 禁止访问（权限不足） |
| 404 | 资源不存在 |
| 500 | 服务器内部错误 |
| 502 | AI 服务错误 |

## 文档状态说明

| 状态值 | 描述 |
|--------|------|
| draft | 草稿 |
| writing | 写作中 |
| review | 审核中 |
| completed | 已完成 |
| archived | 已归档 |