import React from 'react'
import { Col, Progress, Row, Typography } from 'antd'
import { EditOutlined, FileTextOutlined, ThunderboltOutlined } from '@ant-design/icons'
import { countWords, listDocs } from '../services/storage'

const { Paragraph, Text } = Typography

const Dashboard: React.FC<{ onNavigate: (page: string) => void }> = ({ onNavigate }) => {
  const docs = listDocs()
  const totalWords = docs.reduce((sum, d) => sum + countWords(d.content), 0)
  const recent = docs.slice(0, 5)

  const cards = [
    { title: '文档总数', value: docs.length, suffix: ' 篇', icon: <FileTextOutlined />, page: 'documents' },
    { title: '累计写作字数', value: totalWords, suffix: ' 字', icon: <EditOutlined />, page: 'ai-assistant' },
    {
      title: '写作目标完成度',
      value: Math.min(100, Math.round((totalWords / 30000) * 100)),
      suffix: ' %',
      icon: <ThunderboltOutlined />,
      page: 'ai-assistant',
    },
  ]

  return (
    <div>
      <div
        className="glass-strong glass-hover"
        style={{
          marginBottom: 18,
          padding: '30px 32px',
          background:
            'linear-gradient(120deg, rgba(10,132,255,0.16), rgba(191,90,242,0.14) 55%, rgba(255,55,95,0.10)), rgba(255,255,255,0.6)',
        }}
      >
        <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800, letterSpacing: '-0.3px' }}>
          欢迎回来，研究生同学 👋
        </h2>
        <Paragraph style={{ color: 'var(--text-secondary)', marginTop: 8, marginBottom: 0, fontSize: 14 }}>
          今天想写点什么？进入 AI 写作工作台，从选题、大纲到润色、降重，全程协助。
        </Paragraph>
      </div>

      <Row gutter={18}>
        {cards.map((c) => (
          <Col span={8} key={c.title}>
            <div className="glass glass-hover stat-card" onClick={() => onNavigate(c.page)}>
              <div className="stat-title">
                {c.icon} {c.title}
              </div>
              <div className="stat-value">
                {c.value}
                <span style={{ fontSize: 15, fontWeight: 600 }}>{c.suffix}</span>
              </div>
              {c.title === '写作目标完成度' && (
                <Progress percent={c.value} showInfo={false} strokeColor={{ from: '#0a84ff', to: '#bf5af2' }} style={{ marginTop: 10 }} />
              )}
            </div>
          </Col>
        ))}
      </Row>

      <Row gutter={18} style={{ marginTop: 18 }}>
        <Col span={16}>
          <div className="glass glass-hover" style={{ padding: 22 }}>
            <div className="stat-title" style={{ marginBottom: 16 }}>
              最近编辑的文档
            </div>
            {recent.length === 0 ? (
              <Text type="secondary">暂无文档，去「文档管理」新建一篇吧</Text>
            ) : (
              recent.map((d) => (
                <div
                  key={d.id}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    padding: '9px 4px',
                    borderBottom: '1px solid rgba(31,38,135,0.06)',
                    borderRadius: 8,
                    transition: 'background 0.3s var(--ease-smooth)',
                    cursor: 'pointer',
                  }}
                  onClick={() => onNavigate('documents')}
                >
                  <Text style={{ fontWeight: 500 }}>📄 {d.title}</Text>
                  <Text type="secondary">
                    {countWords(d.content)} 字 · {new Date(d.updatedAt).toLocaleDateString('zh-CN')}
                  </Text>
                </div>
              ))
            )}
          </div>
        </Col>
        <Col span={8}>
          <div className="glass glass-hover" style={{ padding: 22 }}>
            <div className="stat-title" style={{ marginBottom: 12 }}>
              学术写作小贴士
            </div>
            <Paragraph style={{ fontSize: 13, lineHeight: 2, marginBottom: 0, color: 'var(--text-secondary)' }}>
              · 一段只讲一个观点，段首给出主题句
              <br />· 引用文献遵守 GB/T 7714 规范
              <br />· AI 生成内容仅供辅助参考，务必人工核实
            </Paragraph>
          </div>
        </Col>
      </Row>
    </div>
  )
}

export default Dashboard
