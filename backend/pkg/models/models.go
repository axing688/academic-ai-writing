package models

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// MySQL 兼容：UUID 主键在 BeforeCreate 钩子中生成，而非依赖数据库默认值
func genID() string {
	return uuid.NewString()
}

type User struct {
	ID          string    `json:"id" gorm:"type:char(36);primaryKey"`
	Username    string    `json:"username" gorm:"unique;not null"`
	Email       string    `json:"email" gorm:"unique;not null"`
	Password    string    `json:"-" gorm:"not null"`
	FullName    string    `json:"full_name"`
	Avatar      string    `json:"avatar"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
	LastLogin   *time.Time `json:"last_login"`
	Status      string    `json:"status" gorm:"default:'active'"`
	Preferences string    `json:"preferences" gorm:"type:text"`

	// 关联
	Documents      []Document      `json:"documents" gorm:"foreignKey:UserID"`
	WritingRecords []WritingRecord `json:"writing_records" gorm:"foreignKey:UserID"`
	AICalls        []AICall        `json:"ai_calls" gorm:"foreignKey:UserID"`
}

func (u *User) BeforeCreate(tx *gorm.DB) error {
	if u.ID == "" {
		u.ID = genID()
	}
	return nil
}

type Document struct {
	ID        string    `json:"id" gorm:"type:char(36);primaryKey"`
	UserID    string    `json:"user_id" gorm:"type:char(36);not null;index"`
	Title     string    `json:"title" gorm:"not null"`
	Content   string    `json:"content" gorm:"type:text"`
	Type      string    `json:"type" gorm:"default:'markdown'"`
	WordCount int       `json:"word_count"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
	Status    string    `json:"status" gorm:"default:'draft'"`
	Metadata  string    `json:"metadata" gorm:"type:text"`

	// 关联
	User           User            `json:"user" gorm:"foreignKey:UserID"`
	WritingRecords []WritingRecord `json:"writing_records" gorm:"foreignKey:DocumentID"`
	AICalls        []AICall        `json:"ai_calls" gorm:"foreignKey:DocumentID"`
}

func (d *Document) BeforeCreate(tx *gorm.DB) error {
	if d.ID == "" {
		d.ID = genID()
	}
	return nil
}

type WritingRecord struct {
	ID              string     `json:"id" gorm:"type:char(36);primaryKey"`
	UserID          string     `json:"user_id" gorm:"type:char(36);not null;index"`
	DocumentID      *string    `json:"document_id" gorm:"type:char(36);index"`
	SessionType     string     `json:"session_type"`
	WordCountStart  int        `json:"word_count_start"`
	WordCountEnd    int        `json:"word_count_end"`
	DurationSeconds int        `json:"duration_seconds"`
	AIAssistCount   int        `json:"ai_assist_count" gorm:"default:0"`
	CreatedAt       time.Time  `json:"created_at"`

	// 关联
	User     User      `json:"user" gorm:"foreignKey:UserID"`
	Document *Document `json:"document" gorm:"foreignKey:DocumentID"`
}

func (w *WritingRecord) BeforeCreate(tx *gorm.DB) error {
	if w.ID == "" {
		w.ID = genID()
	}
	return nil
}

type AICall struct {
	ID           string    `json:"id" gorm:"type:char(36);primaryKey"`
	UserID       string    `json:"user_id" gorm:"type:char(36);not null;index"`
	DocumentID   *string   `json:"document_id" gorm:"type:char(36);index"`
	ModelType    string    `json:"model_type"`
	PromptType   string    `json:"prompt_type"`
	InputText    string    `json:"input_text" gorm:"type:text"`
	OutputText   string    `json:"output_text" gorm:"type:text"`
	TokensUsed   int       `json:"tokens_used"`
	ResponseTime int       `json:"response_time_ms"`
	CreatedAt    time.Time `json:"created_at"`

	// 关联
	User     User      `json:"user" gorm:"foreignKey:UserID"`
	Document *Document `json:"document" gorm:"foreignKey:DocumentID"`
}

func (a *AICall) BeforeCreate(tx *gorm.DB) error {
	if a.ID == "" {
		a.ID = genID()
	}
	return nil
}
