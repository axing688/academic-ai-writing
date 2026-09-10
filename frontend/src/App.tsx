import React, { useCallback, useEffect, useState } from 'react'
import { Button, Layout, Menu, Space, Tag, Tooltip, Typography, message } from 'antd'
import {
  BookOutlined,
  DashboardOutlined,
  FileTextOutlined,
  LogoutOutlined,
  RobotOutlined,
  SettingOutlined,
  SyncOutlined,
  UserOutlined,
  UserSwitchOutlined,
} from '@ant-design/icons'
import Dashboard from './components/Dashboard'
import Documents from './components/Documents'
import AIAssistant from './components/AIAssistant'
import Settings from './components/Settings'
import Library from './components/Library'
import StyleProfilePage from './components/StyleProfile'
import Login from './components/Login'
import { getStoredUser, isAuthenticated, logout, type AuthUser } from './services/auth'
import { syncNow } from './services/sync'

const { Sider, Content, Header } = Layout
const { Text } = Typography

const App: React.FC = () => {
  const [user, setUser] = useState<AuthUser | null>(() =>
    isAuthenticated() ? getStoredUser() : null
  )
  const [localMode, setLocalMode] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [page, setPage] = useState('dashboard')
  const [collapsed, setCollapsed] = useState(false)
  // 从文档管理页跳转到工作台时携带的文档 ID（openNonce 保证重复点击也生效）
  const [openDocId, setOpenDocId] = useState<string | null>(null)
  const [openNonce, setOpenNonce] = useState(0)
  const [docsVersion, setDocsVersion] = useState(0)

  const menuItems = [
    { key: 'dashboard', icon: <DashboardOutlined />, label: '仪表板' },
    { key: 'ai-assistant', icon: <RobotOutlined />, label: 'AI 写作工作台' },
    { key: 'library', icon: <BookOutlined />, label: '个人文献库' },
    { key: 'style', icon: <UserSwitchOutlined />, label: '风格画像' },
    { key: 'documents', icon: <FileTextOutlined />, label: '文档管理' },
    { key: 'settings', icon: <SettingOutlined />, label: '设置' },
  ]

  const handleAuthed = useCallback(async (u: AuthUser) => {
    setUser(u)
    setLocalMode(false)
    setSyncing(true)
    const r = await syncNow()
    message.info(r.message)
    setSyncing(false)
    setDocsVersion((v) => v + 1)
  }, [])

  const handleLogout = () => {
    logout()
    setUser(null)
    message.success('已退出登录（本地数据保留）')
  }

  const handleManualSync = async () => {
    setSyncing(true)
    const r = await syncNow()
    if (r.ok) message.success(r.message)
    else message.warning(r.message)
    setSyncing(false)
    setDocsVersion((v) => v + 1)
  }

  // 登录状态下每 60 秒自动同步一次
  useEffect(() => {
    if (!user) return
    const t = setInterval(async () => {
      const r = await syncNow()
      if (r.ok && (r.pushed || r.pulled)) {
        setDocsVersion((v) => v + 1)
      }
    }, 60000)
    return () => clearInterval(t)
  }, [user])

  // ---------- 登录门控 ----------
  if (!user && !localMode) {
    return (
      <Login
        onAuthed={handleAuthed}
        onSkip={() => setLocalMode(true)}
      />
    )
  }

  return (
    <Layout style={{ minHeight: '100vh', background: 'transparent' }}>
      <Sider collapsible collapsed={collapsed} onCollapse={setCollapsed} theme="light" width={220} className="sidebar">
        <div className="sidebar-logo">{collapsed ? '✍️' : '✍️ 学术写作助手'}</div>
        <Menu
          theme="light"
          selectedKeys={[page]}
          mode="inline"
          items={menuItems}
          onClick={({ key }) => setPage(key)}
          className="sidebar-menu"
        />
      </Sider>

      <Layout style={{ background: 'transparent' }}>
        <Header className="header">
          <h1>{menuItems.find((m) => m.key === page)?.label}</h1>
          <Space size="middle">
            {user ? (
              <>
                <Tooltip title="同步本地与云端文档">
                  <Button size="small" icon={<SyncOutlined spin={syncing} />} onClick={handleManualSync}>
                    同步
                  </Button>
                </Tooltip>
                <Tag icon={<UserOutlined />} color="blue" style={{ margin: 0 }}>
                  {user.username}
                </Tag>
                <Button size="small" type="text" icon={<LogoutOutlined />} onClick={handleLogout}>
                  退出
                </Button>
              </>
            ) : (
              <Text type="secondary" style={{ fontSize: 12 }}>
                本地模式 · 数据仅存于本机
              </Text>
            )}
          </Space>
        </Header>
        <Content className="main-content">
          {page === 'dashboard' && <Dashboard onNavigate={setPage} />}
          {/* AI 工作台始终挂载，切走时仅隐藏：切换左侧目录不再导致生成结果/编辑内容丢失后重新加载（测试反馈问题 6） */}
          <div style={{ display: page === 'ai-assistant' ? 'block' : 'none' }}>
            <AIAssistant
              openDocId={openDocId}
              openNonce={openNonce}
              onDocsChanged={() => setDocsVersion((v) => v + 1)}
            />
          </div>
          {page === 'library' && <Library />}
          {page === 'style' && <StyleProfilePage />}
          {page === 'documents' && (
            <Documents onOpenInWorkspace={openInWorkspace} refreshKey={docsVersion} />
          )}
          {page === 'settings' && <Settings />}
        </Content>
      </Layout>
    </Layout>
  )

  function openInWorkspace(id: string) {
    setOpenDocId(id)
    setOpenNonce((n) => n + 1)
    setPage('ai-assistant')
  }
}

export default App
