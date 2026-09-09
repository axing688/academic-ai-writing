import React, { useMemo, useState } from 'react'
import {
  Button,
  Col,
  Divider,
  Empty,
  Input,
  Modal,
  Popconfirm,
  Progress,
  Row,
  Space,
  Tag,
  Typography,
  message,
} from 'antd'
import {
  CheckCircleFilled,
  DeleteOutlined,
  EyeOutlined,
  PlusOutlined,
  StarFilled,
  UserSwitchOutlined,
} from '@ant-design/icons'
import {
  extractProfile,
  getCurrentProfileId,
  loadProfiles,
  profileToPrompt,
  saveProfiles,
  scoreAgainstProfile,
  setCurrentProfileId,
  type StyleDeviation,
  type StyleProfile,
} from '../services/style'

const { TextArea } = Input
const { Paragraph, Text, Title } = Typography

const StyleProfilePage: React.FC = () => {
  const [profiles, setProfiles] = useState<StyleProfile[]>(() => loadProfiles())
  const [currentId, setCurrentId] = useState<string>(() => getCurrentProfileId())

  // 新建画像
  const [name, setName] = useState('')
  const [samples, setSamples] = useState<string[]>([''])
  const [building, setBuilding] = useState(false)

  // 一致性检查
  const [checkText, setCheckText] = useState('')
  const [checkResult, setCheckResult] = useState<ReturnType<typeof scoreAgainstProfile> | null>(null)

  // 规则卡弹窗
  const [viewProfile, setViewProfile] = useState<StyleProfile | null>(null)

  const refresh = (list: StyleProfile[]) => {
    saveProfiles(list)
    setProfiles(list)
  }

  const currentProfile = useMemo(() => profiles.find((p) => p.id === currentId) || null, [profiles, currentId])

  function addSample() {
    setSamples((s) => [...s, ''])
  }

  function removeSample(i: number) {
    setSamples((s) => s.filter((_, idx) => idx !== i))
  }

  function buildProfile() {
    const valid = samples.filter((s) => s.trim().length >= 50)
    if (!valid.length) {
      message.warning('请至少粘贴一段 50 字以上的写作样本')
      return
    }
    const totalChars = valid.reduce((acc, s) => acc + s.length, 0)
    if (totalChars < 800) {
      message.warning(`样本合计仅 ${totalChars} 字，建议 1500 字以上（导师 2-3 篇论文或长段落），画像才足够稳定`)
    }
    setBuilding(true)
    // 本地统计计算，setTimeout 让 UI 先渲染 loading
    setTimeout(() => {
      const p = extractProfile(name, valid)
      const list = [...profiles, p]
      refresh(list)
      setCurrentProfileId(p.id)
      setCurrentId(p.id)
      setBuilding(false)
      setName('')
      setSamples([''])
      message.success(`已生成画像「${p.name}」并设为当前使用`)
    }, 50)
  }

  function removeProfile(id: string) {
    const list = profiles.filter((p) => p.id !== id)
    refresh(list)
    if (currentId === id) {
      setCurrentProfileId('')
      setCurrentId('')
    }
  }

  function runCheck() {
    if (!currentProfile) {
      message.warning('请先生成或选择一个风格画像')
      return
    }
    if (checkText.trim().length < 50) {
      message.warning('请粘贴 50 字以上待检查文本')
      return
    }
    setCheckResult(scoreAgainstProfile(checkText, currentProfile))
  }

  const severityTag = (s: StyleDeviation['severity']) =>
    s === 'high' ? <Tag color="red" style={{ margin: 0, fontSize: 11 }}>高</Tag> : s === 'mid' ? <Tag color="orange" style={{ margin: 0, fontSize: 11 }}>中</Tag> : <Tag color="default" style={{ margin: 0, fontSize: 11 }}>低</Tag>

  return (
    <Row gutter={16}>
      {/* 左列：新建画像 */}
      <Col span={10}>
        <div className="glass" style={{ padding: 18, marginBottom: 16 }}>
          <Title level={5} style={{ marginTop: 0 }}>
            <UserSwitchOutlined style={{ marginRight: 8 }} />
            新建风格画像
          </Title>
          <Paragraph type="secondary" style={{ fontSize: 12.5, marginBottom: 12 }}>
            粘贴导师的论文段落/评审意见等写作样本（建议 2-3 段、合计 1500 字以上）。全部计算在你的浏览器本地完成，样本不会上传或发送给任何模型。
          </Paragraph>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="画像名称，如：导师-张教授"
            style={{ marginBottom: 12 }}
          />
          {samples.map((s, i) => (
            <div key={i} style={{ marginBottom: 10 }}>
              <Space style={{ marginBottom: 4, width: '100%', justifyContent: 'space-between' }}>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  样本 {i + 1}（{s.length} 字）
                </Text>
                {samples.length > 1 && (
                  <Button size="small" type="text" icon={<DeleteOutlined />} onClick={() => removeSample(i)} />
                )}
              </Space>
              <TextArea
                value={s}
                onChange={(e) => setSamples((arr) => arr.map((x, idx) => (idx === i ? e.target.value : x)))}
                placeholder="粘贴一段导师的写作文本（论文正文、综述段落、评审意见均可）…"
                autoSize={{ minRows: 4, maxRows: 10 }}
              />
            </div>
          ))}
          <Space style={{ marginTop: 4 }}>
            <Button icon={<PlusOutlined />} onClick={addSample}>
              添加样本
            </Button>
            <Button type="primary" loading={building} onClick={buildProfile}>
              生成风格画像
            </Button>
          </Space>
        </div>

        {/* 一致性检查 */}
        <div className="glass" style={{ padding: 18 }}>
          <Title level={5} style={{ marginTop: 0 }}>
            风格一致性检查
          </Title>
          <Paragraph type="secondary" style={{ fontSize: 12.5, marginBottom: 12 }}>
            {currentProfile
              ? `对当前画像「${currentProfile.name}」检查任意文本：给出风格贴合度评分，并标出"AI 味"最重的句子。`
              : '请先生成并选中一个画像。'}
          </Paragraph>
          <TextArea
            value={checkText}
            onChange={(e) => setCheckText(e.target.value)}
            placeholder="粘贴待检查的论文段落或 AI 生成结果…"
            autoSize={{ minRows: 4, maxRows: 8 }}
          />
          <Button type="primary" ghost block style={{ marginTop: 10 }} onClick={runCheck} disabled={!currentProfile}>
            检查风格贴合度
          </Button>
          {checkResult && (
            <div style={{ marginTop: 14 }}>
              <Space style={{ marginBottom: 6 }}>
                <Text strong style={{ fontSize: 14 }}>
                  贴合度
                </Text>
                <Progress
                  type="circle"
                  size={44}
                  percent={checkResult.score}
                  strokeColor={checkResult.score >= 80 ? '#10b981' : checkResult.score >= 60 ? '#f59e0b' : '#ef4444'}
                />
                <Text type="secondary" style={{ fontSize: 12 }}>
                  均句长 {checkResult.stats.avgSentenceLen} 字 · 连接词 {checkResult.stats.connectiveRate}/千字
                </Text>
              </Space>
              {checkResult.deviations.length === 0 ? (
                <Paragraph style={{ color: '#10b981', margin: 0 }}>
                  <CheckCircleFilled style={{ marginRight: 6 }} />
                  未发现明显偏差，风格贴合良好。
                </Paragraph>
              ) : (
                <div style={{ fontSize: 12.5, lineHeight: 1.9 }}>
                  {checkResult.deviations.map((d, i) => (
                    <div key={i} className="glass-inset" style={{ padding: '6px 10px', borderRadius: 8, marginBottom: 6 }}>
                      <Space size={6}>
                        {severityTag(d.severity)}
                        <Text strong style={{ fontSize: 12 }}>
                          {d.excerpt}
                        </Text>
                      </Space>
                      <div style={{ color: 'var(--text-2, #666)' }}>{d.reason}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </Col>

      {/* 右列：画像列表 */}
      <Col span={14}>
        <div className="glass" style={{ padding: 18, minHeight: 400 }}>
          <Title level={5} style={{ marginTop: 0 }}>
            我的风格画像（{profiles.length}）
          </Title>
          {profiles.length === 0 ? (
            <Empty description="还没有画像。在左侧粘贴导师写作样本即可生成" style={{ padding: 50 }} />
          ) : (
            profiles.map((p) => (
              <div
                key={p.id}
                className="glass-inset"
                style={{
                  padding: '12px 16px',
                  borderRadius: 12,
                  marginBottom: 12,
                  outline: p.id === currentId ? '2px solid #6366f1' : 'none',
                }}
              >
                <Space style={{ width: '100%', justifyContent: 'space-between', marginBottom: 8 }}>
                  <Space size={8}>
                    {p.id === currentId && <StarFilled style={{ color: '#f59e0b' }} />}
                    <Text strong style={{ fontSize: 14 }}>
                      {p.name}
                    </Text>
                    <Text type="secondary" style={{ fontSize: 11 }}>
                      {p.sampleCount} 个样本 · {p.sampleChars} 字 · {new Date(p.createdAt).toLocaleDateString()}
                    </Text>
                  </Space>
                  <Space size={4}>
                    {p.id !== currentId && (
                      <Button
                        size="small"
                        onClick={() => {
                          setCurrentProfileId(p.id)
                          setCurrentId(p.id)
                          message.success(`已切换当前画像为「${p.name}」`)
                        }}
                      >
                        设为当前
                      </Button>
                    )}
                    <Button size="small" icon={<EyeOutlined />} onClick={() => setViewProfile(p)}>
                      规则卡
                    </Button>
                    <Popconfirm title="确定删除该画像？" onConfirm={() => removeProfile(p.id)}>
                      <Button size="small" type="text" danger icon={<DeleteOutlined />} />
                    </Popconfirm>
                  </Space>
                </Space>
                <Row gutter={[16, 6]} style={{ fontSize: 12.5 }}>
                  <Col span={7}>
                    <Text type="secondary">平均句长</Text>
                    <div>
                      <Text strong>{p.avgSentenceLen}</Text> 字（目标 {p.targetSentenceLen[0]}-{p.targetSentenceLen[1]}）
                    </div>
                  </Col>
                  <Col span={7}>
                    <Text type="secondary">平均段长</Text>
                    <div>
                      <Text strong>{p.avgParagraphLen}</Text> 字
                    </div>
                  </Col>
                  <Col span={10}>
                    <Text type="secondary">人称习惯</Text>
                    <div>{p.firstPersonPlural ? '接受"我们/笔者"' : '仅用"本文/本研究"'}</div>
                  </Col>
                  {p.connectives.length > 0 && (
                    <Col span={24}>
                      <Text type="secondary">高频衔接：</Text>
                      {p.connectives.slice(0, 6).map((c) => (
                        <Tag key={c.text} style={{ margin: '2px 4px 0 0', fontSize: 11 }}>
                          {c.text}×{c.count}
                        </Tag>
                      ))}
                    </Col>
                  )}
                  {p.patterns.length > 0 && (
                    <Col span={24}>
                      <Text type="secondary">典型句式：</Text>
                      {p.patterns.slice(0, 4).map((c) => (
                        <Tag key={c.text} color="purple" style={{ margin: '2px 4px 0 0', fontSize: 11 }}>
                          {c.text}
                        </Tag>
                      ))}
                    </Col>
                  )}
                </Row>
              </div>
            ))
          )}
        </div>
      </Col>

      {/* 规则卡弹窗 */}
      <Modal
        open={!!viewProfile}
        title={viewProfile ? `风格规则卡 · ${viewProfile.name}` : ''}
        onCancel={() => setViewProfile(null)}
        footer={[
          <Button
            key="copy"
            type="primary"
            onClick={() => {
              if (viewProfile) navigator.clipboard.writeText(profileToPrompt(viewProfile))
              message.success('规则卡已复制')
            }}
          >
            复制规则卡
          </Button>,
        ]}
        width={680}
      >
        {viewProfile && (
          <div style={{ whiteSpace: 'pre-wrap', fontSize: 13, lineHeight: 2 }}>{profileToPrompt(viewProfile)}</div>
        )}
        <Divider />
        <Paragraph type="secondary" style={{ fontSize: 12, marginBottom: 0 }}>
          该规则卡为显式可编辑的文本（stylometric-transfer 六段式：Measurements/Targets/Lexicon/Templates）。开启工作台的「导师风格注入」后，每次生成都会自动附加此规则卡。
        </Paragraph>
      </Modal>
    </Row>
  )
}

export default StyleProfilePage
