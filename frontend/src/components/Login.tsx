import React, { useState } from 'react'
import { Button, Form, Input, Tabs, Typography, message as antdMessage } from 'antd'
import { CloudUploadOutlined, UserOutlined, LockOutlined, MailOutlined } from '@ant-design/icons'
import { login, register, type AuthUser } from '../services/auth'

const { Paragraph, Text } = Typography

interface Props {
  onAuthed: (user: AuthUser) => void
  onSkip: () => void
}

const Login: React.FC<Props> = ({ onAuthed, onSkip }) => {
  const [loading, setLoading] = useState(false)

  async function handleLogin(values: { username: string; password: string }) {
    setLoading(true)
    try {
      const user = await login(values.username, values.password)
      antdMessage.success(`欢迎回来，${user.username}！`)
      onAuthed(user)
    } catch (e) {
      antdMessage.error((e as Error).message || '登录失败')
    } finally {
      setLoading(false)
    }
  }

  async function handleRegister(values: { username: string; email: string; password: string }) {
    setLoading(true)
    try {
      const user = await register(values.username, values.email, values.password)
      antdMessage.success(`注册成功，欢迎 ${user.username}！`)
      onAuthed(user)
    } catch (e) {
      antdMessage.error((e as Error).message + '（需要后端服务已启动）' || '注册失败')
    } finally {
      setLoading(false)
    }
  }

  const loginForm = (
    <Form onFinish={handleLogin} layout="vertical" requiredMark={false}>
      <Form.Item name="username" rules={[{ required: true, message: '请输入用户名或邮箱' }]}>
        <Input prefix={<UserOutlined />} placeholder="用户名或邮箱" size="large" />
      </Form.Item>
      <Form.Item name="password" rules={[{ required: true, message: '请输入密码' }]}>
        <Input.Password prefix={<LockOutlined />} placeholder="密码" size="large" />
      </Form.Item>
      <Button type="primary" htmlType="submit" block size="large" loading={loading}>
        登 录
      </Button>
    </Form>
  )

  const registerForm = (
    <Form onFinish={handleRegister} layout="vertical" requiredMark={false}>
      <Form.Item name="username" rules={[{ required: true, min: 2, max: 32, message: '用户名 2-32 个字符' }]}>
        <Input prefix={<UserOutlined />} placeholder="用户名" size="large" />
      </Form.Item>
      <Form.Item name="email" rules={[{ required: true, type: 'email', message: '请输入有效邮箱' }]}>
        <Input prefix={<MailOutlined />} placeholder="邮箱" size="large" />
      </Form.Item>
      <Form.Item name="password" rules={[{ required: true, min: 6, message: '密码至少 6 位' }]}>
        <Input.Password prefix={<LockOutlined />} placeholder="密码（至少 6 位）" size="large" />
      </Form.Item>
      <Button type="primary" htmlType="submit" block size="large" loading={loading}>
        注 册 并 登 录
      </Button>
    </Form>
  )

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
      }}
    >
      <div className="glass-strong glass-hover" style={{ width: 420, maxWidth: '100%', padding: '38px 36px' }}>
        <div style={{ textAlign: 'center', marginBottom: 26 }}>
          <div style={{ fontSize: 44, lineHeight: 1 }}>✍️</div>
          <h1 style={{ fontSize: 22, fontWeight: 800, margin: '14px 0 6px', letterSpacing: '-0.3px' }}>
            研究生学术写作助手
          </h1>
          <Text type="secondary" style={{ fontSize: 13 }}>
            登录后可在多台设备间同步你的文档
          </Text>
        </div>

        <Tabs
          centered
          items={[
            { key: 'login', label: '登录', children: loginForm },
            { key: 'register', label: '注册', children: registerForm },
          ]}
        />

        <div style={{ marginTop: 10, textAlign: 'center' }}>
          <Button type="text" icon={<CloudUploadOutlined />} onClick={onSkip}>
            暂不登录，仅在本机使用
          </Button>
        </div>
        <Paragraph
          type="secondary"
          style={{ fontSize: 11, textAlign: 'center', marginTop: 12, marginBottom: 0 }}
        >
          注册/登录需要后端服务已通过 Docker 启动；未登录时文档仅保存在本机浏览器
        </Paragraph>
      </div>
    </div>
  )
}

export default Login
