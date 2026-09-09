import React, { useState } from 'react'
import { Button, Empty, Input, List, message, Modal, Popconfirm, Space, Tag, Typography } from 'antd'
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

  // refreshKey 变化时重新加载
  React.useEffect(() => {
    setDocs(listDocs())
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
    message.success('已删除')
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
      <Space style={{ marginBottom: 16 }}>
        <Button type="primary" icon={<FileAddOutlined />} onClick={handleCreate}>
          新建文档
        </Button>
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
                actions={[
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
