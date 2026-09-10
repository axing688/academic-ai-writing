import React, { useState } from 'react'
import { Button, Checkbox, Empty, Input, List, message, Modal, Popconfirm, Space, Tag, Typography } from 'antd'
import { DeleteOutlined, EditOutlined, FileAddOutlined, FileTextOutlined } from '@ant-design/icons'
import { countWords, createDoc, deleteDoc, listDocs, renameDoc, type Doc } from '../services/storage'

const { Text } = Typography

interface Props {
  onOpenInWorkspace: (id: string) => void
  refreshKey: number
}

const Documents: React.FC<Props> = ({ onOpenInWorkspace, refreshKey }) => {
  const [docs, setDocs] = useState<Doc[]>(() => listDocs())
  const [renameOpen, setRenameOpen] = useState(false)
  const [renameTarget, setRenameTarget] = useState<Doc | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const [selected, setSelected] = useState<Set<string>>(new Set())

  // refreshKey 变化时重新加载，并清掉已不存在的选中项
  React.useEffect(() => {
    const next = listDocs()
    setDocs(next)
    setSelected((prev) => {
      const ids = new Set(next.map((d) => d.id))
      const kept = new Set([...prev].filter((id) => ids.has(id)))
      return kept.size === prev.size ? prev : kept
    })
  }, [refreshKey])

  function handleCreate() {
    const d = createDoc('未命名文档')
    setDocs(listDocs())
    message.success('文档已创建，正在打开工作台')
    onOpenInWorkspace(d.id)
  }

  function handleDelete(id: string) {
    deleteDoc(id)
    setDocs(listDocs())
    setSelected((prev) => {
      const next = new Set(prev)
      next.delete(id)
      return next
    })
    message.success('已删除')
  }

  // ---------- 批量选择 / 批量删除 ----------
  const allSelected = docs.length > 0 && selected.size === docs.length
  const someSelected = selected.size > 0 && selected.size < docs.length

  function toggleOne(id: string, checked: boolean) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (checked) next.add(id)
      else next.delete(id)
      return next
    })
  }

  function toggleAll(checked: boolean) {
    setSelected(checked ? new Set(docs.map((d) => d.id)) : new Set())
  }

  function handleBatchDelete() {
    const ids = [...selected]
    if (!ids.length) return
    for (const id of ids) deleteDoc(id)
    setDocs(listDocs())
    setSelected(new Set())
    message.success(`已批量删除 ${ids.length} 篇文档`)
  }

  function openRename(d: Doc) {
    setRenameTarget(d)
    setRenameValue(d.title)
    setRenameOpen(true)
  }

  function confirmRename() {
    if (renameTarget && renameValue.trim()) {
      renameDoc(renameTarget.id, renameValue.trim())
      setDocs(listDocs())
      message.success('已重命名')
    }
    setRenameOpen(false)
  }

  return (
    <div>
      <Space style={{ marginBottom: 16 }} size="middle" wrap>
        <Button type="primary" icon={<FileAddOutlined />} onClick={handleCreate}>
          新建文档
        </Button>
        <Checkbox
          checked={allSelected}
          indeterminate={someSelected}
          disabled={!docs.length}
          onChange={(e) => toggleAll(e.target.checked)}
        >
          全选
        </Checkbox>
        <Popconfirm
          title={`确认删除选中的 ${selected.size} 篇文档？`}
          description="删除后不可恢复（云端副本会在下次同步时一并删除）。"
          disabled={!selected.size}
          onConfirm={handleBatchDelete}
        >
          <Button danger icon={<DeleteOutlined />} disabled={!selected.size}>
            批量删除{selected.size ? `（${selected.size}）` : ''}
          </Button>
        </Popconfirm>
        {selected.size > 0 && (
          <Button type="text" onClick={() => setSelected(new Set())}>
            取消选择
          </Button>
        )}
        <Text type="secondary">共 {docs.length} 篇 · 数据保存在浏览器本地</Text>
      </Space>
      <div className="glass" style={{ padding: 18 }}>
        {docs.length === 0 ? (
          <Empty description={<>还没有文档，点击「新建文档」开始写作</>} style={{ padding: 40 }} />
        ) : (
          <List
            pagination={{ pageSize: 20, showTotal: (t) => `共 ${t} 篇`, showSizeChanger: false }}
            dataSource={docs}
            renderItem={(d) => (
              <List.Item
                className="doc-row"
                style={selected.has(d.id) ? { background: 'rgba(99, 102, 241, 0.08)', borderRadius: 10 } : undefined}
                actions={[
                  <Checkbox
                    key="sel"
                    checked={selected.has(d.id)}
                    onChange={(e) => toggleOne(d.id, e.target.checked)}
                    onClick={(e) => e.stopPropagation()}
                  />,
                  <Button key="open" type="link" icon={<EditOutlined />} onClick={() => onOpenInWorkspace(d.id)}>
                    打开
                  </Button>,
                  <Button key="rename" type="link" icon={<FileTextOutlined />} onClick={() => openRename(d)}>
                    重命名
                  </Button>,
                  <Popconfirm key="del" title="确认删除该文档？" onConfirm={() => handleDelete(d.id)}>
                    <Button type="link" danger icon={<DeleteOutlined />}>
                      删除
                    </Button>
                  </Popconfirm>,
                ]}
              >
                <List.Item.Meta
                  title={<Text strong>{d.title}</Text>}
                  description={
                    <Space size="small" wrap>
                      <Tag>{countWords(d.content)} 字</Tag>
                      <Text type="secondary">更新于 {new Date(d.updatedAt).toLocaleString('zh-CN')}</Text>
                    </Space>
                  }
                />
                <div
                  style={{
                    maxWidth: 420,
                    color: '#999',
                    fontSize: 12,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {d.content.replace(/\s+/g, ' ').slice(0, 80) || '（空文档）'}
                </div>
              </List.Item>
            )}
          />
        )}
      </div>
      <Modal
        title="重命名文档"
        open={renameOpen}
        onOk={confirmRename}
        onCancel={() => setRenameOpen(false)}
        okText="确定"
        cancelText="取消"
      >
        <Input value={renameValue} onChange={(e) => setRenameValue(e.target.value)} onPressEnter={confirmRename} />
      </Modal>
    </div>
  )
}

export default Documents
