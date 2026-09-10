import React, { useEffect, useRef, useState } from 'react'
import {
  Button,
  Col,
  Divider,
  Drawer,
  Empty,
  Input,
  InputNumber,
  List,
  message,
  Popconfirm,
  Row,
  Select,
  Space,
  Switch,
  Tabs,
  Tag,
  Typography,
} from 'antd'
import {
  BookOutlined,
  CheckCircleFilled,
  ClearOutlined,
  CopyOutlined,
  FileAddOutlined,
  HistoryOutlined,
  LoadingOutlined,
  RedoOutlined,
  SafetyCertificateOutlined,
  SendOutlined,
  SnippetsOutlined,
  UserSwitchOutlined,
  WarningOutlined,
} from '@ant-design/icons'
import { aiGenerate, aiStatusText, loadAISettings, taskLabel, type AITask, type AISettings } from '../services/ai'
import {
  countWords,
  createDoc,
  deleteVersion,
  getDoc,
  listDocs,
  listVersions,
  restoreVersion,
  updateDoc,
  type Doc,
  type DocVersion,
} from '../services/storage'
import { buildRagContext, listLits } from '../services/library'
import { getCurrentProfile, profileToPrompt } from '../services/style'
import { extractRefEntries, refCheckSummary, verifyReferences, type RefCheck } from '../services/citation'

const { TextArea } = Input
const { Paragraph, Text } = Typography

/** 把 AI 生成结果按空行切分为可独立编辑/重新生成的段落 */
function splitSegments(text: string): string[] {
  return text
    .split(/\n{2,}/)
    .map((s) => s.replace(/^\n+|\n+$/g, ''))
    .filter((s) => s.trim())
}

const WRITE_TASKS: Array<{ key: AITask; desc: string }> = [
  { key: 'outline', desc: '输入研究主题，生成完整论文大纲' },
  { key: 'topics', desc: '输入学科方向，推荐 5 个候选选题' },
  { key: 'gap', desc: '基于主题与文献库，识别未解决的研究空白' },
  { key: 'polish', desc: '将选中/全文改写为规范学术语言' },
  { key: 'nature-polish', desc: '将选中/全文译写为 Nature 风格英文（源自 nature-skills 规范）' },
  { key: 'expand', desc: '对正文按目标字数进行充实扩写' },
  { key: 'rewrite', desc: '同义改写降重，保持原意不变' },
  { key: 'grammar', desc: '检查语法、标点与学术规范问题' },
  { key: 'abstract', desc: '按四段式生成中文摘要与关键词' },
  { key: 'defense', desc: '模拟评审提问，提前演练学位论文答辩' },
  { key: 'nature-review', desc: '模拟 Nature/CNS 审稿人，生成正式评审报告（源自 nature-skills 规范）' },
]

interface Props {
  openDocId?: string | null
  openNonce?: number
  onDocsChanged?: () => void
}

const AIAssistant: React.FC<Props> = ({ openDocId, openNonce = 0, onDocsChanged }) => {
  const [docs, setDocs] = useState<Doc[]>([])
  const [currentId, setCurrentId] = useState<string | null>(null)
  const [title, setTitle] = useState('未命名草稿')
  const [content, setContent] = useState('')
  const [task, setTask] = useState<AITask>('outline')
  const [topic, setTopic] = useState('')
  const [targetWords, setTargetWords] = useState(400)
  const [result, setResult] = useState('')
  const [segments, setSegments] = useState<string[]>([]) // 可编辑的生成结果分段
  const [segLoading, setSegLoading] = useState<number | null>(null) // 正在重新生成的分段下标
  const [loading, setLoading] = useState(false)
  const [settings] = useState<AISettings>(() => loadAISettings())
  // RAG 文献辅助
  const [libCount, setLibCount] = useState(0)
  const [ragOn, setRagOn] = useState<boolean>(() => localStorage.getItem('awa_rag_on') !== '0')
  const [ragCitations, setRagCitations] = useState<string[]>([])
  const [ragHits, setRagHits] = useState(0)
  // 引用真实性校验
  const [refChecks, setRefChecks] = useState<RefCheck[] | null>(null)
  const [refChecking, setRefChecking] = useState(false)
  // 导师风格注入
  const [styleName, setStyleName] = useState<string>('')
  const [styleOn, setStyleOn] = useState<boolean>(() => localStorage.getItem('awa_style_on') === '1')
  // 历史版本侧栏
  const [histOpen, setHistOpen] = useState(false)
  const [versions, setVersions] = useState<DocVersion[]>([])

  // 始终指向最新的编辑器状态（供卸载/切换前的兜底保存读取，避免闭包拿到旧值）
  const latestRef = useRef({ currentId, title, content })
  latestRef.current = { currentId, title, content }
  // 记录"已加载/已保存"的快照：打开或切换文档后内容未变化时不触发保存，
  // 防止防抖副作用把上一个文档的内容误写进新文档
  const loadedRef = useRef<{ id: string | null; title: string; content: string }>({ id: null, title: '', content: '' })

  function markLoaded(id: string | null, t: string, c: string) {
    loadedRef.current = { id, title: t, content: c }
  }

  useEffect(() => {
    refreshDocs()
    listLits().then((l) => setLibCount(l.length))
    const sp = getCurrentProfile()
    if (sp) setStyleName(sp.name)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 从文档管理页跳转过来时打开指定文档
  useEffect(() => {
    if (openDocId) {
      const d = getDoc(openDocId)
      if (d) {
        markLoaded(d.id, d.title, d.content)
        setCurrentId(d.id)
        setTitle(d.title)
        setContent(d.content)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openNonce])

  function refreshDocs() {
    setDocs(listDocs())
    onDocsChanged?.()
  }

  function openDoc(id: string) {
    const d = docs.find((x) => x.id === id)
    if (!d) return
    markLoaded(d.id, d.title, d.content)
    setCurrentId(d.id)
    setTitle(d.title)
    setContent(d.content)
  }

  // 立即保存当前文档（新建/切换文档前调用，不再依赖防抖）
  function flushSave() {
    const { currentId: cid, title: t, content: c } = latestRef.current
    if (!cid) return
    const snap = loadedRef.current
    if (snap.id === cid && snap.title === t && snap.content === c) return
    updateDoc(cid, { title: t, content: c })
    markLoaded(cid, t, c)
  }

  function newDraft() {
    // 先把当前文档强制落盘，再创建并跳转到新文档（测试反馈问题 8）
    flushSave()
    const d = createDoc('未命名草稿', '')
    markLoaded(d.id, d.title, d.content)
    setCurrentId(d.id)
    setTitle(d.title)
    setContent(d.content)
    refreshDocs()
    message.success('当前文档已保存，已创建新草稿')
  }

  // 防抖自动保存（内容相对已加载快照有变化时才保存）
  useEffect(() => {
    if (!currentId) return
    const snap = loadedRef.current
    if (snap.id === currentId && snap.title === title && snap.content === content) return
    const t = setTimeout(() => {
      updateDoc(currentId, { title, content })
      markLoaded(currentId, title, content)
      refreshDocs()
    }, 800)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title, content, currentId])

  // 组件卸载（如页面切换）前兜底保存一次，防止防抖定时器被清理导致丢内容
  useEffect(() => {
    return () => {
      const { currentId: cid, title: t, content: c } = latestRef.current
      if (!cid) return
      const snap = loadedRef.current
      if (snap.id === cid && snap.title === t && snap.content === c) return
      updateDoc(cid, { title: t, content: c })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ---------- 历史版本 ----------
  function refreshVersions() {
    setVersions(latestRef.current.currentId ? listVersions(latestRef.current.currentId) : [])
  }

  function handleRestoreVersion(at: number) {
    const cid = latestRef.current.currentId
    if (!cid) return
    if (!restoreVersion(cid, at)) {
      message.error('回滚失败：版本不存在')
      return
    }
    const d = getDoc(cid)
    if (d) {
      markLoaded(d.id, d.title, d.content)
      setTitle(d.title)
      setContent(d.content)
    }
    refreshVersions()
    refreshDocs()
    message.success('已回滚到该版本（回滚前的内容已另存为快照）')
  }

  function handleDeleteVersion(at: number) {
    const cid = latestRef.current.currentId
    if (!cid) return
    deleteVersion(cid, at)
    refreshVersions()
  }

  const selectionText = (() => {
    const el = document.getElementById('awa-editor') as HTMLTextAreaElement | null
    if (!el) return ''
    return el.value.substring(el.selectionStart, el.selectionEnd).trim()
  })()

  function inputForTask(): string {
    // 需要主题输入的任务用 topic；答辩演练用全文；其余任务用选中内容，无选中则用全文
    if (task === 'outline' || task === 'topics' || task === 'gap') return topic.trim()
    const selected = selectionText
    if (selected) return selected
    return content.trim()
  }

  async function runRefCheck(text: string) {
    const refs = extractRefEntries(text)
    if (refs.length === 0) {
      setRefChecks(null)
      return
    }
    setRefChecking(true)
    setRefChecks([])
    try {
      const checks = await verifyReferences(refs.slice(0, 12))
      setRefChecks(checks)
    } catch {
      setRefChecks(null)
    } finally {
      setRefChecking(false)
    }
  }

  async function handleGenerate() {
    const input = inputForTask()
    if (!input) {
      if (task === 'outline' || task === 'topics' || task === 'gap') message.warning('请先输入研究主题')
      else message.warning('请先在编辑器输入内容，或选中一段文字')
      return
    }
    setLoading(true)
    setResult('')
    setRagCitations([])
    setRagHits(0)
    setRefChecks(null)
    try {
      // RAG：从个人文献库检索相关片段注入上下文
      let context: string | undefined
      let citations: string[] | undefined
      if (ragOn && libCount > 0) {
        const rag = await buildRagContext(input, 6)
        if (rag.hitCount > 0) {
          context = rag.contextText
          citations = rag.citations
          setRagCitations(rag.citations)
          setRagHits(rag.hitCount)
        }
      }
      const res = await aiGenerate(task, input, settings, {
        targetWords,
        context,
        citations,
        style: styleOn ? (getCurrentProfile() ? profileToPrompt(getCurrentProfile()!) : undefined) : undefined,
      })
      setResult(res)
      setSegments(splitSegments(res))
      // 生成完成后自动校验引用真实性（不阻塞主结果展示）
      runRefCheck(res)
    } catch (e) {
      message.error((e as Error).message || 'AI 生成失败，请检查网络或 API Key')
      setResult('')
      setSegments([])
    } finally {
      setLoading(false)
    }
  }

  // 分段视图下合并后的完整结果（分段可编辑，插入/复制取最新内容）
  const resultText = segments.length ? segments.join('\n\n') : result

  /** 对单个分段重新生成（测试反馈问题 1） */
  async function regenSegment(idx: number) {
    const baseInput = inputForTask()
    if (!baseInput) {
      message.warning('请先输入研究主题，或在编辑器提供内容')
      return
    }
    setSegLoading(idx)
    try {
      const input = `${baseInput}\n\n【任务】整体内容已完成，只需重新生成下面这一部分。直接输出该部分的新内容，不要输出其他部分或额外说明：\n${segments[idx]}`
      const res = await aiGenerate(task, input, settings, {
        targetWords,
        style: styleOn ? (getCurrentProfile() ? profileToPrompt(getCurrentProfile()!) : undefined) : undefined,
      })
      const replacement = splitSegments(res).join('\n\n') || segments[idx]
      setSegments((prev) => prev.map((s, i) => (i === idx ? replacement : s)))
      message.success('该段已重新生成')
    } catch (e) {
      message.error((e as Error).message || '重新生成失败，请检查网络或 API Key')
    } finally {
      setSegLoading(null)
    }
  }

  /** 把单个分段插入正文 */
  function insertSegment(seg: string) {
    if (!seg.trim()) return
    if (currentId) updateDoc(currentId, { title, content }, { snapshot: true }) // 插入前存快照，可从历史版本找回
    const el = document.getElementById('awa-editor') as HTMLTextAreaElement | null
    if (el && selectionText) {
      const start = el.selectionStart
      const end = el.selectionEnd
      setContent(content.slice(0, start) + seg + content.slice(end))
    } else if (content.trim()) {
      setContent(content + '\n\n' + seg)
    } else {
      setContent(seg)
    }
    message.success('该段已插入正文')
  }

  function insertResult() {
    if (!resultText) return
    const body = resultText.replace(/^【[^】]*】\s*\n*/m, '')
    if (currentId) updateDoc(currentId, { title, content }, { snapshot: true }) // 插入前存快照，可从历史版本找回
    const el = document.getElementById('awa-editor') as HTMLTextAreaElement | null
    if (el && selectionText) {
      const start = el.selectionStart
      const end = el.selectionEnd
      setContent(content.slice(0, start) + body + content.slice(end))
    } else if (content.trim()) {
      setContent(content + '\n\n' + body)
    } else {
      setContent(body)
    }
    message.success('已插入到正文，记得保存')
  }

  async function copyResult() {
    if (!resultText) return
    try {
      await navigator.clipboard.writeText(resultText)
      message.success('已复制')
    } catch {
      message.error('复制失败，请手动选择复制')
    }
  }

  const needsTopic = task === 'outline' || task === 'topics' || task === 'gap'
  const words = countWords(content)

  return (
    <Row gutter={16} style={{ height: 'calc(100vh - 160px)' }}>
      {/* 左侧：编辑器 */}
      <Col span={15} style={{ display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        <div className="glass" style={{ marginBottom: 12, padding: '10px 16px' }}>
          <Space style={{ width: '100%', justifyContent: 'space-between' }} wrap>
            <Space>
              <Select
                value={currentId}
                style={{ minWidth: 180 }}
                placeholder="打开已有文档"
                allowClear
                onClear={() => {
                  setCurrentId(null)
                  setTitle('未命名草稿')
                  setContent('')
                }}
                onChange={openDoc}
                options={docs.map((d) => ({ value: d.id, label: d.title }))}
              />
              <Button icon={<FileAddOutlined />} onClick={newDraft}>
                新建
              </Button>
              <Button
                icon={<HistoryOutlined />}
                disabled={!currentId}
                onClick={() => {
                  refreshVersions()
                  setHistOpen(true)
                }}
              >
                历史版本
              </Button>
            </Space>
            <Space>
              <Text type="secondary">
                {title && `《${title}》`} · {words} 字
              </Text>
              <Tag color={aiStatusText(settings).ok ? 'green' : 'orange'}>
                {`AI：${aiStatusText(settings).label}`}
              </Tag>
            </Space>
          </Space>
        </div>
        <div className="glass-strong" style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', padding: '14px 20px' }}>
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="文档标题"
            style={{ marginBottom: 10, fontWeight: 700, fontSize: 15 }}
            variant="borderless"
          />
          <TextArea
            id="awa-editor"
            className="editor-textarea"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder={'在此撰写或粘贴论文内容…\n\n· 润色 / 扩写 / 降重 / 语法检查：可先选中一段文字，只处理选区\n· 大纲生成 / 选题建议：在右侧输入研究主题即可'}
            style={{ flex: 1, resize: 'none', fontSize: 14.5, lineHeight: 1.9 }}
          />
        </div>
      </Col>

      {/* 右侧：AI 工具面板 */}
      <Col span={9} style={{ minHeight: 0 }}>
        <div className="glass" style={{ height: '100%', overflowY: 'auto', padding: 18 }}>
          <Tabs
            defaultActiveKey="tools"
            items={[
              {
                key: 'tools',
                label: 'AI 写作工具',
                children: (
                  <>
                    <Select
                      style={{ width: '100%' }}
                      value={task}
                      onChange={(v) => setTask(v as AITask)}
                      options={WRITE_TASKS.map((t) => ({ label: taskLabel(t.key), value: t.key }))}
                    />
                    <Paragraph type="secondary" style={{ marginTop: 10, minHeight: 44 }}>
                      {WRITE_TASKS.find((t) => t.key === task)?.desc}
                    </Paragraph>

                    {needsTopic ? (
                      <Input
                        value={topic}
                        onChange={(e) => setTopic(e.target.value)}
                        placeholder="输入研究主题，例如：大语言模型在教育评价中的应用"
                        onPressEnter={handleGenerate}
                      />
                    ) : (
                      <div>
                        {task === 'expand' && (
                          <Space style={{ marginBottom: 8 }}>
                            <Text type="secondary">目标字数：</Text>
                            <InputNumber min={100} max={2000} step={100} value={targetWords} onChange={(v) => setTargetWords(v || 400)} />
                          </Space>
                        )}
                        <Text type={selectionText ? undefined : 'secondary'}>
                          {selectionText
                            ? `已选中 ${countWords(selectionText)} 字，将只处理选区`
                            : '未选中文本，将处理全文'}
                        </Text>
                      </div>
                    )}

                    {/* RAG 文献辅助开关 */}
                    <div
                      className="glass-inset"
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '8px 12px',
                        borderRadius: 10,
                        margin: '10px 0 2px',
                      }}
                    >
                      <Space size={6}>
                        <BookOutlined style={{ color: libCount ? '#10b981' : undefined }} />
                        <Text style={{ fontSize: 13 }}>文献辅助写作</Text>
                        {libCount > 0 ? (
                          <Tag color="green" style={{ margin: 0, fontSize: 11 }}>
                            {libCount} 篇已入库
                          </Tag>
                        ) : (
                          <Text type="secondary" style={{ fontSize: 11 }}>
                            文献库为空
                          </Text>
                        )}
                      </Space>
                      <Switch
                        size="small"
                        checked={ragOn && libCount > 0}
                        disabled={libCount === 0}
                        onChange={(v) => {
                          setRagOn(v)
                          localStorage.setItem('awa_rag_on', v ? '1' : '0')
                        }}
                      />
                    </div>
                    {libCount === 0 && (
                      <Paragraph type="secondary" style={{ fontSize: 11, margin: '4px 0 0' }}>
                        在「个人文献库」上传论文后，AI 将只基于你的真实文献写作并标注引用——不再编造参考文献。
                      </Paragraph>
                    )}

                    {/* 导师风格注入开关 */}
                    <div
                      className="glass-inset"
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '8px 12px',
                        borderRadius: 10,
                        margin: '8px 0 2px',
                      }}
                    >
                      <Space size={6}>
                        <UserSwitchOutlined style={{ color: styleName ? '#6366f1' : undefined }} />
                        <Text style={{ fontSize: 13 }}>导师风格注入</Text>
                        {styleName ? (
                          <Tag color="purple" style={{ margin: 0, fontSize: 11 }}>
                            {styleName}
                          </Tag>
                        ) : (
                          <Text type="secondary" style={{ fontSize: 11 }}>
                            尚无画像
                          </Text>
                        )}
                      </Space>
                      <Switch
                        size="small"
                        checked={styleOn && !!styleName}
                        disabled={!styleName}
                        onChange={(v) => {
                          setStyleOn(v)
                          localStorage.setItem('awa_style_on', v ? '1' : '0')
                        }}
                      />
                    </div>
                    {!styleName && (
                      <Paragraph type="secondary" style={{ fontSize: 11, margin: '4px 0 0' }}>
                        在「风格画像」页粘贴导师写作样本生成画像后，AI 输出将模仿其句长、衔接词与句式习惯。
                      </Paragraph>
                    )}

                    <Button
                      type="primary"
                      block
                      loading={loading}
                      onClick={handleGenerate}
                      icon={<SendOutlined />}
                      style={{ margin: '12px 0' }}
                    >
                      生成{taskLabel(task)}结果
                    </Button>

                    {resultText && (
                      <>
                        <Divider style={{ margin: '8px 0' }} />
                        <Space style={{ marginBottom: 8 }}>
                          <Button size="small" icon={<SnippetsOutlined />} onClick={insertResult}>
                            插入正文
                          </Button>
                          <Button size="small" icon={<CopyOutlined />} onClick={copyResult}>
                            复制
                          </Button>
                          <Button
                            size="small"
                            icon={<ClearOutlined />}
                            onClick={() => {
                              setResult('')
                              setSegments([])
                            }}
                          >
                            清除
                          </Button>
                          <Text type="secondary" style={{ fontSize: 11 }}>
                            每段可直接编辑，或单独重新生成
                          </Text>
                        </Space>
                        {/* 分段可编辑结果（测试反馈问题 1：支持直接编辑 + 按段重新生成） */}
                        {segments.length > 0 ? (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                            {segments.map((seg, i) => (
                              <div
                                key={i}
                                className="ai-result-box"
                                style={{ padding: '10px 12px', borderRadius: 10 }}
                              >
                                <TextArea
                                  value={seg}
                                  onChange={(e) =>
                                    setSegments((prev) => prev.map((s, j) => (j === i ? e.target.value : s)))
                                  }
                                  autoSize={{ minRows: 2 }}
                                  variant="borderless"
                                  style={{ padding: 0, fontSize: 13.5, lineHeight: 1.9, background: 'transparent' }}
                                />
                                <Space size={2} style={{ marginTop: 6 }}>
                                  <Button
                                    size="small"
                                    type="text"
                                    icon={<RedoOutlined />}
                                    loading={segLoading === i}
                                    onClick={() => regenSegment(i)}
                                  >
                                    重新生成本段
                                  </Button>
                                  <Button
                                    size="small"
                                    type="text"
                                    icon={<SnippetsOutlined />}
                                    onClick={() => insertSegment(seg)}
                                  >
                                    插入本段
                                  </Button>
                                </Space>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="ai-result-box">{result}</div>
                        )}
                        {ragCitations.length > 0 && (
                          <div className="glass-inset" style={{ padding: '10px 12px', borderRadius: 10, marginTop: 8 }}>
                            <Space size={6} style={{ marginBottom: 4 }}>
                              <BookOutlined style={{ color: '#10b981' }} />
                              <Text strong style={{ fontSize: 12 }}>
                                本次引用了文献库中 {ragCitations.length} 篇真实文献（检索命中 {ragHits} 个片段）
                              </Text>
                            </Space>
                            <div style={{ fontSize: 12, lineHeight: 1.9 }}>
                              {ragCitations.map((c, i) => (
                                <div key={i}>
                                  [{i + 1}] {c}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                        {/* 引用真实性校验（CrossRef / OpenAlex 交叉验证） */}
                        {(refChecking || (refChecks && refChecks.length > 0)) && (
                          <div className="glass-inset" style={{ padding: '10px 12px', borderRadius: 10, marginTop: 8 }}>
                            <Space size={6} style={{ marginBottom: 6 }}>
                              <SafetyCertificateOutlined style={{ color: '#6366f1' }} />
                              <Text strong style={{ fontSize: 12 }}>
                                引用真实性校验（CrossRef / OpenAlex 学术数据库）
                              </Text>
                              {refChecking ? (
                                <Tag icon={<LoadingOutlined />} color="processing" style={{ margin: 0, fontSize: 11 }}>
                                  校验中…
                                </Tag>
                              ) : (
                                refChecks && (
                                  <Tag
                                    color={refCheckSummary(refChecks).missing === 0 ? 'green' : 'orange'}
                                    style={{ margin: 0, fontSize: 11 }}
                                  >
                                    {refCheckSummary(refChecks).verified} 条已核实 / {refCheckSummary(refChecks).missing} 条未检索到
                                  </Tag>
                                )
                              )}
                            </Space>
                            <div style={{ fontSize: 12, lineHeight: 1.9 }}>
                              {refChecking && refChecks!.length === 0 && (
                                <Text type="secondary">正在向学术数据库逐条检索验证…</Text>
                              )}
                              {refChecks!.map((rc) => (
                                <div key={rc.index} style={{ display: 'flex', gap: 6, alignItems: 'flex-start', padding: '2px 0' }}>
                                  <span style={{ flexShrink: 0, marginTop: 3 }}>
                                    {rc.status === 'verified' ? (
                                      <CheckCircleFilled style={{ color: '#10b981' }} />
                                    ) : rc.status === 'error' ? (
                                      <WarningOutlined style={{ color: '#9ca3af' }} />
                                    ) : (
                                      <WarningOutlined style={{ color: '#f59e0b' }} />
                                    )}
                                  </span>
                                  <span style={{ minWidth: 0 }}>
                                    <span style={{ color: 'var(--text-2, #555)' }}>{rc.ref.slice(0, 72)}{rc.ref.length > 72 ? '…' : ''}</span>
                                    {rc.status === 'verified' ? (
                                      <span style={{ color: '#10b981' }}>
                                        {' '}✓ {rc.source === 'crossref' ? 'CrossRef' : 'OpenAlex'} 收录{rc.year ? ` · ${rc.year}` : ''}
                                        {rc.doi && (
                                          <>
                                            {' '}
                                            <a href={`https://doi.org/${rc.doi}`} target="_blank" rel="noreferrer" style={{ fontSize: 11 }}>
                                              DOI:{rc.doi.slice(0, 30)}
                                            </a>
                                          </>
                                        )}
                                      </span>
                                    ) : rc.status === 'error' ? (
                                      <span style={{ color: '#9ca3af' }}>（网络异常，未能完成校验）</span>
                                    ) : (
                                      <span style={{ color: '#f59e0b' }}>（两个数据库均未检索到，请人工复核——中文文献常未被收录，不一定是编造）</span>
                                    )}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </>
                    )}
                  </>
                ),
              },
              {
                key: 'about',
                label: '使用说明',
                children: (
                  <div style={{ fontSize: 13, lineHeight: 2 }}>
                    <Paragraph>
                      <Text strong>写作流程建议：</Text>
                    </Paragraph>
                    <Paragraph>1.「选题建议」输入学科方向，获取 5 个候选选题；</Paragraph>
                    <Paragraph>2.「大纲生成」输入确定的主题，搭建论文框架；</Paragraph>
                    <Paragraph>3. 按大纲逐章撰写，撰写中随时使用「扩写」「润色」；</Paragraph>
                    <Paragraph>4. 定稿前运行「语法检查」与「降重改写」，最后生成「摘要」。</Paragraph>
                    <Divider />
                    <Paragraph>
                      <Text strong>AI 模式：</Text>
                    </Paragraph>
                    <Paragraph>
                      当前为
                      <Tag color={aiStatusText(settings).ok ? 'green' : 'orange'} style={{ margin: '0 4px' }}>
                        {aiStatusText(settings).ok ? aiStatusText(settings).label : '本地演示模式'}
                      </Tag>
                      演示模式基于规则模板生成，可体验完整流程；在「设置」页选择任一大模型服务商并填入 API Key，即可切换为真实大模型写作。
                    </Paragraph>
                  </div>
                ),
              },
            ]}
          />
        </div>
      </Col>

      {/* 历史版本侧栏（测试反馈问题 7：多次生成/修改后旧内容可找回） */}
      <Drawer
        title="历史版本（最近 20 次重要修改）"
        width={440}
        open={histOpen}
        onClose={() => setHistOpen(false)}
      >
        {versions.length === 0 ? (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description="暂无历史版本。AI 结果插入正文或大幅修改时，会自动保留修改前的快照。"
          />
        ) : (
          <List
            dataSource={[...versions].reverse()}
            renderItem={(v) => (
              <List.Item
                className="glass-inset"
                style={{ borderRadius: 10, padding: '10px 14px', marginBottom: 8, border: 'none' }}
                actions={[
                  <Popconfirm
                    key="restore"
                    title="回滚到该版本？"
                    description="回滚前的当前内容会先另存为快照，可再次找回。"
                    onConfirm={() => handleRestoreVersion(v.at)}
                  >
                    <Button key="r" size="small" type="primary" ghost>
                      回滚
                    </Button>
                  </Popconfirm>,
                  <Popconfirm key="del" title="删除该快照？" onConfirm={() => handleDeleteVersion(v.at)}>
                    <Button key="d" size="small" type="text" danger>
                      删除
                    </Button>
                  </Popconfirm>,
                ]}
              >
                <List.Item.Meta
                  title={<Text strong style={{ fontSize: 13 }}>{new Date(v.at).toLocaleString('zh-CN')}</Text>}
                  description={
                    <Text type="secondary" style={{ fontSize: 12 }} ellipsis>
                      《{v.title}》 · {countWords(v.content)} 字 · {v.content.slice(0, 40).replace(/\n/g, ' ')}…
                    </Text>
                  }
                />
              </List.Item>
            )}
          />
        )}
      </Drawer>
    </Row>
  )
}

export default AIAssistant
