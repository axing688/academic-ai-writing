import React, { useEffect, useState } from 'react'
import {
  App,
  Badge,
  Button,
  Card,
  Descriptions,
  Drawer,
  Empty,
  Form,
  Input,
  InputNumber,
  List,
  Modal,
  Popconfirm,
  Progress,
  Select,
  Space,
  Spin,
  Table,
  Tag,
  Typography,
  Upload,
} from 'antd'
import {
  BookOutlined,
  DeleteOutlined,
  DownloadOutlined,
  EditOutlined,
  FilePdfOutlined,
  ImportOutlined,
  SearchOutlined,
  UploadOutlined,
} from '@ant-design/icons'
import {
  clearLibrary,
  deleteLit,
  exportCitations,
  importBibtex,
  importDoiCandidate,
  importPdf,
  listLits,
  looksLikeDoi,
  searchByDoi,
  searchCrossref,
  searchLibrary,
  updateLit,
  type DoiCandidate,
  type Literature,
  type RetrievedChunk,
} from '../services/library'

const { Text, Paragraph } = Typography
const { TextArea } = Input

const TYPE_LABEL: Record<Literature['type'], string> = {
  journal: '期刊 J',
  conference: '会议 C',
  thesis: '学位论文 D',
  book: '专著 M',
  report: '报告 R',
  web: '电子资源',
}

const SOURCE_TAG: Record<Literature['source'], React.ReactNode> = {
  pdf: <Tag color="red">PDF</Tag>,
  doi: <Tag color="green">DOI</Tag>,
  bibtex: <Tag color="blue">BibTeX</Tag>,
  manual: <Tag>手工</Tag>,
}

interface UploadItem {
  key: string
  name: string
  status: 'waiting' | 'processing' | 'done' | 'error'
  pct: number
  msg: string
}

const Library: React.FC = () => {
  const { message } = App.useApp()
  const [lits, setLits] = useState<Literature[]>([])
  const [loading, setLoading] = useState(false)
  const [viewing, setViewing] = useState<Literature | null>(null)
  const [editing, setEditing] = useState<Literature | null>(null)
  const [bibtexOpen, setBibtexOpen] = useState(false)
  const [bibtexText, setBibtexText] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [searchHits, setSearchHits] = useState<RetrievedChunk[] | null>(null)
  const [searching, setSearching] = useState(false)
  const [form] = Form.useForm()

  // ---------- 批量上传进度 ----------
  const [uploadOpen, setUploadOpen] = useState(false)
  const [uploadItems, setUploadItems] = useState<UploadItem[]>([])
  const [uploadBusy, setUploadBusy] = useState(false)

  // ---------- DOI 导入 ----------
  const [doiOpen, setDoiOpen] = useState(false)
  const [doiQuery, setDoiQuery] = useState('')
  const [doiLoading, setDoiLoading] = useState(false)
  const [doiResults, setDoiResults] = useState<DoiCandidate[]>([])
  const [doiImported, setDoiImported] = useState<Set<string>>(new Set())
  const [doiImporting, setDoiImporting] = useState<string | null>(null)

  async function refresh() {
    setLoading(true)
    setLits(await listLits())
    setLoading(false)
  }

  useEffect(() => {
    refresh()
  }, [])

  const totalChunks = lits.reduce((s, l) => s + l.chunkCount, 0)

  // ---------- PDF 批量上传（顺序解析，逐文件进度） ----------
  function setUploadItem(key: string, patch: Partial<UploadItem>) {
    setUploadItems((prev) => prev.map((it) => (it.key === key ? { ...it, ...patch } : it)))
  }

  async function handlePdfUpload(files: File[]) {
    const pdfs = files.filter((f) => /\.pdf$/i.test(f.name) || f.type === 'application/pdf')
    if (!pdfs.length) {
      message.warning('请选择 PDF 文件')
      return
    }
    const items: UploadItem[] = pdfs.map((f, i) => ({
      key: `${Date.now()}_${i}`,
      name: f.name,
      status: 'waiting',
      pct: 0,
      msg: '排队等待解析',
    }))
    setUploadItems(items)
    setUploadOpen(true)
    setUploadBusy(true)
    let ok = 0
    const errors: string[] = []
    for (let i = 0; i < pdfs.length; i++) {
      const it = items[i]
      setUploadItem(it.key, { status: 'processing', msg: '准备解析…' })
      try {
        const lit = await importPdf(pdfs[i], (r, msg) => {
          setUploadItem(it.key, { pct: Math.min(99, Math.round(r * 100)), msg })
        })
        setUploadItem(it.key, { status: 'done', pct: 100, msg: `已入库 · ${lit.chunkCount} 个检索片段` })
        ok++
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e)
        setUploadItem(it.key, { status: 'error', pct: 100, msg })
        errors.push(`${pdfs[i].name}：${msg}`)
      }
    }
    setUploadBusy(false)
    await refresh()
    if (ok === pdfs.length) {
      message.success(`全部 ${ok} 篇 PDF 导入成功`)
    } else {
      message.warning(`导入完成：成功 ${ok} 篇，失败 ${pdfs.length - ok} 篇`)
    }
  }

  // ---------- DOI 检索 / 导入 ----------
  async function handleDoiSearch() {
    const q = doiQuery.trim()
    if (!q) return
    setDoiLoading(true)
    setDoiResults([])
    try {
      if (looksLikeDoi(q)) {
        const c = await searchByDoi(q)
        setDoiResults([c])
      } else {
        const list = await searchCrossref(q, 8)
        if (!list.length) message.info('未检索到相关文献，可换个关键词或直接输入 DOI')
        setDoiResults(list)
      }
    } catch (e) {
      message.error(e instanceof Error ? e.message : String(e))
    } finally {
      setDoiLoading(false)
    }
  }

  async function handleDoiImport(c: DoiCandidate) {
    setDoiImporting(c.doi)
    try {
      const lit = await importDoiCandidate(c)
      setDoiImported((prev) => new Set(prev).add(c.doi))
      message.success(`《${lit.title.slice(0, 30)}》已入库`)
      await refresh()
    } catch (e) {
      message.error(`导入失败：${e instanceof Error ? e.message : String(e)}`)
    } finally {
      setDoiImporting(null)
    }
  }

  // ---------- BibTeX ----------
  async function handleBibtexImport() {
    if (!bibtexText.trim()) return
    try {
      const r = await importBibtex(bibtexText)
      const parts = [`成功 ${r.ok} 条`]
      if (r.dup) parts.push(`跳过重复 ${r.dup} 条`)
      if (r.fail) parts.push(`失败 ${r.fail} 条`)
      message.success(`BibTeX 导入完成：${parts.join('，')}`)
      setBibtexOpen(false)
      setBibtexText('')
      await refresh()
    } catch (e) {
      message.error(`导入失败：${e instanceof Error ? e.message : String(e)}`)
    }
  }

  // ---------- 检索测试 ----------
  async function handleSearch() {
    if (!searchQuery.trim()) return
    setSearching(true)
    const hits = await searchLibrary(searchQuery, { topK: 8 })
    setSearchHits(hits)
    setSearching(false)
  }

  // ---------- 编辑保存 ----------
  async function handleEditSave() {
    if (!editing) return
    try {
      const v = await form.validateFields()
      await updateLit({
        ...editing,
        title: v.title,
        authors: (v.authors || '')
          .split(/[,，、;；]/)
          .map((s: string) => s.trim())
          .filter(Boolean),
        year: v.year,
        venue: v.venue || '',
        type: v.type,
        abstract: v.abstract || '',
      })
      message.success('已保存')
      setEditing(null)
      await refresh()
    } catch {
      /* 校验失败 */
    }
  }

  async function handleDelete(id: string) {
    try {
      await deleteLit(id)
      message.success('已删除')
    } catch (e) {
      message.error(`删除失败：${e instanceof Error ? e.message : String(e)}`)
    }
    await refresh()
  }

  async function handleClearAll() {
    await clearLibrary()
    message.success('文献库已清空')
    await refresh()
  }

  function handleExport() {
    const text = exportCitations(lits)
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = 'references-GBT7714.txt'
    a.click()
    URL.revokeObjectURL(a.href)
  }

  const editForm = (
    <Form form={form} layout="vertical">
      <Form.Item name="title" label="标题" rules={[{ required: true, message: '请输入标题' }]}>
        <Input placeholder="文献标题" />
      </Form.Item>
      <Form.Item name="authors" label="作者（逗号分隔，按原始顺序）">
        <Input placeholder="张三, 李四, Wang X" />
      </Form.Item>
      <Space size="middle" style={{ display: 'flex' }}>
        <Form.Item name="year" label="年份" style={{ width: 120 }}>
          <InputNumber min={1900} max={2100} style={{ width: '100%' }} />
        </Form.Item>
        <Form.Item name="type" label="类型" style={{ width: 160 }} initialValue="journal">
          <Select options={Object.entries(TYPE_LABEL).map(([value, label]) => ({ value, label }))} />
        </Form.Item>
        <Form.Item name="venue" label="期刊/会议/机构" style={{ flex: 1, minWidth: 200 }}>
          <Input placeholder="计算机学报" />
        </Form.Item>
      </Space>
      <Form.Item name="abstract" label="摘要">
        <TextArea rows={4} placeholder="可选" />
      </Form.Item>
    </Form>
  )

  const doneCount = uploadItems.filter((i) => i.status === 'done').length
  const errCount = uploadItems.filter((i) => i.status === 'error').length
  const overallPct = uploadItems.length
    ? Math.round(uploadItems.reduce((s, i) => s + i.pct, 0) / uploadItems.length)
    : 0

  return (
    <div>
      <Card className="glass" style={{ marginBottom: 16 }}>
        <Space wrap size="middle" style={{ width: '100%', justifyContent: 'space-between' }}>
          <Space size="middle">
            <Upload
              accept=".pdf,application/pdf"
              multiple
              showUploadList={false}
              disabled={uploadBusy}
              beforeUpload={(file, fileList) => {
                // beforeUpload 对每个文件都会调用一次，只在第一个文件时触发整批处理
                if (fileList.length && fileList[0].uid === file.uid) {
                  handlePdfUpload(fileList as unknown as File[])
                }
                return false
              }}
            >
              <Button type="primary" icon={<FilePdfOutlined />} disabled={uploadBusy}>
                上传 PDF 文献
              </Button>
            </Upload>
            <Button
              icon={<ImportOutlined />}
              onClick={() => {
                setDoiQuery('')
                setDoiResults([])
                setDoiOpen(true)
              }}
            >
              DOI / 关键词导入
            </Button>
            <Button icon={<UploadOutlined />} onClick={() => setBibtexOpen(true)}>
              导入 BibTeX
            </Button>
          </Space>
          <Space size="middle">
            <Badge count={lits.length} color="#6366f1" overflowCount={999}>
              <Tag icon={<BookOutlined />} style={{ margin: 0, padding: '4px 10px' }}>
                文献库 {totalChunks} 个检索片段 · 数据仅存本机
              </Tag>
            </Badge>
            <Button icon={<DownloadOutlined />} disabled={!lits.length} onClick={handleExport}>
              导出 GB/T 7714
            </Button>
            <Popconfirm
              title="确定清空整个文献库？"
              description="所有文献与索引将被删除，不可恢复。"
              onConfirm={handleClearAll}
            >
              <Button danger type="text" disabled={!lits.length}>
                清空
              </Button>
            </Popconfirm>
          </Space>
        </Space>
      </Card>

      <Card className="glass" style={{ marginBottom: 16 }} size="small">
        <Space.Compact style={{ width: '100%' }}>
          <Input
            placeholder="检索测试：输入研究主题或关键词，验证文献库能否召回相关片段（如：知识图谱 教育应用）"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onPressEnter={handleSearch}
          />
          <Button type="primary" icon={<SearchOutlined />} loading={searching} onClick={handleSearch}>
            检索
          </Button>
        </Space.Compact>
        {searchHits !== null && (
          <div style={{ marginTop: 12 }}>
            {searchHits.length === 0 ? (
              <Text type="secondary">未召回任何片段——可尝试其他关键词，或确认相关文献已上传。</Text>
            ) : (
              searchHits.map((h) => (
                <div key={h.id} className="glass-inset" style={{ padding: '8px 12px', borderRadius: 10, marginBottom: 8 }}>
                  <Space size={8} wrap>
                    <Tag color="purple">得分 {h.score.toFixed(1)}</Tag>
                    <Text strong style={{ fontSize: 12 }}>
                      {h.lit?.title?.slice(0, 40) || h.litId}
                    </Text>
                    <Text type="secondary" style={{ fontSize: 12 }}>{h.lit?.year}</Text>
                  </Space>
                  <Paragraph style={{ margin: '4px 0 0', fontSize: 12, lineHeight: 1.8 }} ellipsis={{ rows: 3, expandable: true }}>
                    {h.text}
                  </Paragraph>
                </div>
              ))
            )}
          </div>
        )}
      </Card>

      <Card className="glass">
        <Table<Literature>
          rowKey="id"
          loading={loading}
          dataSource={lits}
          pagination={{ pageSize: 10, showTotal: (t) => `共 ${t} 篇文献` }}
          locale={{
            emptyText: (
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description={
                  <span>
                    文献库为空。上传导师推荐的论文、领域经典文献，或通过 DOI / 关键词导入元数据后，
                    <br />
                    AI 写作将自动检索引用这些文献的真实内容——不再编造参考文献。
                  </span>
                }
                style={{ padding: 32 }}
              />
            ),
          }}
          columns={[
            {
              title: '文献',
              key: 'title',
              render: (_, l) => (
                <div>
                  <Text strong style={{ fontSize: 13 }}>{l.title}</Text>
                  <div style={{ marginTop: 2 }}>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      {l.authors.slice(0, 3).join(', ')}
                      {l.authors.length > 3 ? ' 等' : ''}
                      {l.year ? ` · ${l.year}` : ''}
                      {l.venue ? ` · ${l.venue}` : ''}
                    </Text>
                  </div>
                </div>
              ),
            },
            {
              title: '类型',
              dataIndex: 'type',
              width: 110,
              render: (t: Literature['type']) => <Tag>{TYPE_LABEL[t]}</Tag>,
            },
            {
              title: '来源',
              dataIndex: 'source',
              width: 90,
              render: (s: Literature['source']) => SOURCE_TAG[s] || <Tag>{s}</Tag>,
            },
            {
              title: '索引片段',
              dataIndex: 'chunkCount',
              width: 100,
              render: (n: number) =>
                n > 0 ? <Badge count={n} color="#10b981" overflowCount={99999} /> : <Text type="secondary">—</Text>,
            },
            {
              title: '操作',
              key: 'action',
              width: 220,
              render: (_, l) => (
                <Space size={0}>
                  <Button
                    type="text"
                    size="small"
                    onClick={() => {
                      setEditing(null)
                      setViewing(l)
                    }}
                  >
                    详情
                  </Button>
                  <Button
                    type="text"
                    size="small"
                    icon={<EditOutlined />}
                    onClick={() => {
                      setViewing(null)
                      setEditing(l)
                      form.setFieldsValue({
                        title: l.title,
                        authors: l.authors.join(', '),
                        year: l.year,
                        type: l.type,
                        venue: l.venue,
                        abstract: l.abstract,
                      })
                    }}
                  >
                    编辑
                  </Button>
                  <Popconfirm title="确定删除该文献？" onConfirm={() => handleDelete(l.id)}>
                    <Button type="text" size="small" danger icon={<DeleteOutlined />} />
                  </Popconfirm>
                </Space>
              ),
            },
          ]}
        />
      </Card>

      {/* 详情抽屉 */}
      <Drawer
        title="文献详情"
        width={520}
        open={!!viewing}
        onClose={() => setViewing(null)}
        extra={
          viewing && (
            <Button
              icon={<DeleteOutlined />}
              danger
              size="small"
              onClick={async () => {
                await handleDelete(viewing.id)
                setViewing(null)
              }}
            >
              删除
            </Button>
          )
        }
      >
        {viewing && (
          <div>
            <Paragraph copyable strong style={{ fontSize: 15 }}>
              {viewing.title}
            </Paragraph>
            <Descriptions column={1} size="small" bordered>
              <Descriptions.Item label="作者">{viewing.authors.join(', ') || '—'}</Descriptions.Item>
              <Descriptions.Item label="年份">{viewing.year || '—'}</Descriptions.Item>
              <Descriptions.Item label="类型">{TYPE_LABEL[viewing.type]}</Descriptions.Item>
              <Descriptions.Item label="出处">{viewing.venue || '—'}</Descriptions.Item>
              <Descriptions.Item label="DOI">
                {viewing.doi ? (
                  <Paragraph copyable style={{ margin: 0, fontSize: 12 }}>
                    {viewing.doi}
                  </Paragraph>
                ) : (
                  '—'
                )}
              </Descriptions.Item>
              <Descriptions.Item label="来源文件">{viewing.fileName || '—'}</Descriptions.Item>
              <Descriptions.Item label="正文规模">
                {viewing.charCount.toLocaleString()} 字符 / {viewing.chunkCount} 个检索片段
              </Descriptions.Item>
              <Descriptions.Item label="GB/T 7714 引用">
                <Paragraph copyable style={{ margin: 0, fontSize: 12 }}>
                  {exportCitations([viewing]).replace(/^\[1\] /, '')}
                </Paragraph>
              </Descriptions.Item>
            </Descriptions>
            {viewing.abstract && (
              <>
                <Paragraph strong style={{ marginTop: 16 }}>摘要</Paragraph>
                <Paragraph style={{ fontSize: 13, lineHeight: 1.9 }}>{viewing.abstract}</Paragraph>
              </>
            )}
          </div>
        )}
      </Drawer>

      {/* 编辑弹窗 */}
      <Modal
        title="编辑文献元数据"
        open={!!editing}
        onCancel={() => setEditing(null)}
        onOk={handleEditSave}
        okText="保存"
        width={640}
      >
        {editForm}
      </Modal>

      {/* 上传进度弹窗 */}
      <Modal
        title="PDF 导入进度"
        open={uploadOpen}
        onCancel={() => {
          if (!uploadBusy) setUploadOpen(false)
        }}
        footer={
          <Button type="primary" disabled={uploadBusy} onClick={() => setUploadOpen(false)}>
            {uploadBusy ? '解析中…' : '关闭'}
          </Button>
        }
        closable={!uploadBusy}
        maskClosable={false}
        width={560}
      >
        <Progress
          percent={overallPct}
          status={uploadBusy ? 'active' : errCount ? 'exception' : 'normal'}
          style={{ marginBottom: 8 }}
        />
        <Text type="secondary" style={{ fontSize: 12 }}>
          {uploadBusy
            ? `正在解析 ${Math.min(doneCount + 1, uploadItems.length)} / ${uploadItems.length} 篇…`
            : `完成：成功 ${doneCount} 篇${errCount ? `，失败 ${errCount} 篇` : ''}`}
        </Text>
        <div style={{ marginTop: 12, maxHeight: 300, overflowY: 'auto' }}>
          {uploadItems.map((it) => (
            <div key={it.key} className="glass-inset" style={{ padding: '8px 12px', borderRadius: 10, marginBottom: 8 }}>
              <Space size={8} style={{ width: '100%', justifyContent: 'space-between' }}>
                <Text strong style={{ fontSize: 12 }} ellipsis>
                  {it.status === 'processing' && <Spin size="small" style={{ marginRight: 8 }} />}
                  {it.status === 'done' && <Tag color="success">完成</Tag>}
                  {it.status === 'error' && <Tag color="error">失败</Tag>}
                  {it.status === 'waiting' && <Tag>等待</Tag>}
                  {it.name}
                </Text>
              </Space>
              <Progress
                percent={it.pct}
                size="small"
                status={it.status === 'error' ? 'exception' : it.status === 'done' ? 'success' : 'active'}
                style={{ margin: '4px 0 0' }}
              />
              <Text type="secondary" style={{ fontSize: 12 }}>{it.msg}</Text>
            </div>
          ))}
        </div>
      </Modal>

      {/* DOI / 关键词导入弹窗 */}
      <Modal
        title="通过 DOI 或关键词导入文献（CrossRef）"
        open={doiOpen}
        onCancel={() => setDoiOpen(false)}
        footer={null}
        width={680}
      >
        <Paragraph type="secondary" style={{ fontSize: 12 }}>
          直接粘贴 DOI（如 <Text code>10.1038/s41586-021-03819-2</Text>）精确导入，或输入标题/关键词检索。
          元数据来自 CrossRef 开放接口，联网可用。
        </Paragraph>
        <Space.Compact style={{ width: '100%', marginBottom: 16 }}>
          <Input
            placeholder="输入 DOI 或 标题关键词，回车检索"
            value={doiQuery}
            onChange={(e) => setDoiQuery(e.target.value)}
            onPressEnter={handleDoiSearch}
            allowClear
          />
          <Button type="primary" icon={<SearchOutlined />} loading={doiLoading} onClick={handleDoiSearch}>
            检索
          </Button>
        </Space.Compact>
        {doiLoading ? (
          <div style={{ textAlign: 'center', padding: 32 }}>
            <Spin tip="正在向 CrossRef 查询…" />
          </div>
        ) : (
          <List
            dataSource={doiResults}
            locale={{ emptyText: <Text type="secondary">输入 DOI 或关键词开始检索</Text> }}
            renderItem={(c) => {
              const imported = doiImported.has(c.doi)
              return (
                <List.Item
                  className="glass-inset"
                  style={{ borderRadius: 10, padding: '10px 14px', marginBottom: 8, border: 'none' }}
                  actions={[
                    imported ? (
                      <Tag key="ok" color="success">已导入</Tag>
                    ) : (
                      <Button
                        key="imp"
                        type="primary"
                        size="small"
                        ghost
                        loading={doiImporting === c.doi}
                        onClick={() => handleDoiImport(c)}
                      >
                        导入
                      </Button>
                    ),
                  ]}
                >
                  <List.Item.Meta
                    title={<Text strong style={{ fontSize: 13 }}>{c.title}</Text>}
                    description={
                      <>
                        <Text type="secondary" style={{ fontSize: 12 }}>
                          {c.authors.slice(0, 3).join(', ') || '作者未知'}
                          {c.authors.length > 3 ? ' 等' : ''}
                          {c.year ? ` · ${c.year}` : ''}
                          {c.venue ? ` · ${c.venue}` : ''}
                        </Text>
                        <br />
                        <Text type="secondary" style={{ fontSize: 12 }} copyable={{ text: c.doi }}>
                          DOI: {c.doi}
                        </Text>
                        {c.abstract && (
                          <Paragraph style={{ margin: '6px 0 0', fontSize: 12, lineHeight: 1.8 }} ellipsis={{ rows: 2, expandable: true, symbol: '展开摘要' }}>
                            {c.abstract}
                          </Paragraph>
                        )}
                      </>
                    }
                  />
                </List.Item>
              )
            }}
          />
        )}
      </Modal>

      {/* BibTeX 导入弹窗 */}
      <Modal
        title="导入 BibTeX"
        open={bibtexOpen}
        onCancel={() => setBibtexOpen(false)}
        onOk={handleBibtexImport}
        okText="导入"
        width={640}
      >
        <Paragraph type="secondary" style={{ fontSize: 12 }}>
          粘贴从 Zotero / Google Scholar / 知网导出的 .bib 文件内容，支持多条目批量导入。
        </Paragraph>
        <TextArea rows={12} value={bibtexText} onChange={(e) => setBibtexText(e.target.value)} placeholder="@article{zhang2023deep,&#10;  title={...},&#10;  author={Zhang, San and Li, Si},&#10;  journal={...},&#10;  year={2023}&#10;}" />
      </Modal>
    </div>
  )
}

export default Library
