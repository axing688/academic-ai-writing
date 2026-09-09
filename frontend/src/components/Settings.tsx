import React, { useState } from 'react'
import { Alert, AutoComplete, Button, Col, Divider, Form, Input, Row, Select, Space, Tag, Typography, message } from 'antd'
import { ApiOutlined, SafetyCertificateOutlined } from '@ant-design/icons'
import {
  PROVIDERS,
  getProvider,
  loadAISettings,
  saveAISettings,
  testConnection,
  isAIConfigured,
  aiStatusText,
  type AISettings,
} from '../services/ai'

const { Paragraph } = Typography

const Settings: React.FC = () => {
  const [form] = Form.useForm()
  const [settings, setSettings] = useState<AISettings>(() => loadAISettings())
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<{ ok: boolean; text: string } | null>(null)

  const currentProviderId: string = form.getFieldValue('providerId') || settings.providerId
  const provider = getProvider(currentProviderId)
  const usingApi = isAIConfigured(settings)
  const status = aiStatusText(settings)

  async function handleSave(values: AISettings) {
    const next: AISettings = {
      providerId: values.providerId || 'demo',
      apiKey: (values.apiKey || '').trim(),
      model: (values.model || '').trim(),
      customBaseUrl: (values.customBaseUrl || '').trim() || undefined,
    }
    saveAISettings(next)
    setSettings(next)
    setTestResult(null)
    message.success('设置已保存')
  }

  async function handleTest() {
    const values = await form.validateFields()
    const candidate: AISettings = {
      providerId: values.providerId,
      apiKey: (values.apiKey || '').trim(),
      model: (values.model || '').trim(),
      customBaseUrl: (values.customBaseUrl || '').trim() || undefined,
    }
    setTesting(true)
    setTestResult(null)
    try {
      const okMsg = await testConnection(candidate)
      setTestResult({ ok: true, text: okMsg })
      saveAISettings(candidate)
      setSettings(candidate)
    } catch (e) {
      setTestResult({ ok: false, text: (e as Error).message })
    } finally {
      setTesting(false)
    }
  }

  const domestic = PROVIDERS.filter((p) => p.region === '国内')
  const abroad = PROVIDERS.filter((p) => p.region === '国外')

  return (
    <Row gutter={18}>
      <Col span={14}>
        <div className="glass glass-hover" style={{ padding: 26 }}>
          <div className="stat-title" style={{ marginBottom: 18, fontSize: 15 }}>
            <ApiOutlined /> AI 服务商设置
          </div>
          <Form
            form={form}
            layout="vertical"
            onFinish={handleSave}
            initialValues={settings}
            onValuesChange={(changed) => {
              // 切换服务商时自动带入默认模型
              if (changed.providerId) {
                const p = getProvider(changed.providerId)
                form.setFieldsValue({
                  model: p?.models[0] || '',
                  apiKey: changed.providerId === settings.providerId ? form.getFieldValue('apiKey') : '',
                  customBaseUrl: form.getFieldValue('customBaseUrl'),
                })
                setTestResult(null)
              }
            }}
          >
            <Form.Item label="服务商" name="providerId" rules={[{ required: true }]}>
              <Select
                showSearch
                optionFilterProp="label"
                options={[
                  {
                    label: '── 免费 / 演示 ──',
                    options: PROVIDERS.filter((p) => p.id === 'demo').map((p) => ({ value: p.id, label: p.name })),
                  },
                  {
                    label: '── 国内服务商 ──',
                    options: domestic
                      .filter((p) => p.id !== 'demo')
                      .map((p) => ({ value: p.id, label: p.name })),
                  },
                  {
                    label: '── 国外服务商 ──',
                    options: abroad.map((p) => ({ value: p.id, label: p.name })),
                  },
                ]}
              />
            </Form.Item>

            <Form.Item noStyle shouldUpdate={(a, b) => a.providerId !== b.providerId}>
              {({ getFieldValue }) => {
                const pid = getFieldValue('providerId')
                const p = getProvider(pid)
                if (!p || p.id === 'demo') {
                  return (
                    <Alert
                      type="info"
                      showIcon
                      message="本地演示模式"
                      description="无需任何 API Key。生成结果为规则模板示例，用于体验完整功能流程。选择上方任一服务商并填入 Key 即可切换为真实大模型。"
                    />
                  )
                }
                return (
                  <>
                    {p.note && (
                      <Alert type="info" showIcon message={p.note} style={{ marginBottom: 16 }} />
                    )}
                    {p.id === 'custom' && (
                      <Form.Item
                        label="Base URL（OpenAI 兼容）"
                        name="customBaseUrl"
                        rules={[{ required: true, message: '请输入 Base URL' }]}
                        extra="例如：http://localhost:11434/v1（ollama）、one-api 地址等"
                      >
                        <Input placeholder="https://your-endpoint/v1" />
                      </Form.Item>
                    )}
                    <Form.Item
                      label="API Key"
                      name="apiKey"
                      rules={[{ required: true, message: '请输入 API Key' }]}
                      extra={
                        p.keyUrl ? (
                          <>
                            前往{' '}
                            <a href={p.keyUrl} target="_blank" rel="noreferrer">
                              {p.keyUrl}
                            </a>{' '}
                            创建{p.keyPrefix ? `（格式形如 ${p.keyPrefix}）` : ''}，Key 仅保存在本机浏览器
                          </>
                        ) : (
                          'Key 仅保存在本机浏览器'
                        )
                      }
                    >
                      <Input.Password placeholder="sk-..." autoComplete="new-password" />
                    </Form.Item>
                    <Form.Item label="模型" name="model" extra="可直接输入服务商支持的其他模型名">
                      <AutoComplete
                        options={(p.models || []).map((m) => ({ value: m }))}
                        placeholder={p.models[0] || '模型名称'}
                      />
                    </Form.Item>
                  </>
                )
              }}
            </Form.Item>

            <Form.Item>
              <Space wrap>
                <Button type="primary" htmlType="submit" icon={<SafetyCertificateOutlined />}>
                  保存设置
                </Button>
                <Button onClick={handleTest} loading={testing} icon={<ApiOutlined />}>
                  测试连接
                </Button>
                <Button
                  onClick={() => {
                    form.resetFields()
                    form.setFieldsValue({ providerId: 'demo', apiKey: '', model: '' })
                    const def: AISettings = { providerId: 'demo', apiKey: '', model: '' }
                    saveAISettings(def)
                    setSettings(def)
                    setTestResult(null)
                  }}
                >
                  恢复默认
                </Button>
              </Space>
            </Form.Item>
          </Form>

          {testResult && (
            <Alert
              type={testResult.ok ? 'success' : 'error'}
              showIcon
              message={testResult.ok ? '连接成功' : '连接失败'}
              description={<div style={{ maxHeight: 140, overflowY: 'auto', whiteSpace: 'pre-wrap', fontSize: 12 }}>{testResult.text}</div>}
            />
          )}
        </div>
      </Col>

      <Col span={10}>
        <div className="glass glass-hover" style={{ padding: 26 }}>
          <div className="stat-title" style={{ marginBottom: 18, fontSize: 15 }}>当前状态</div>
          <Paragraph>
            当前服务商：
            <Tag color={usingApi ? 'green' : 'orange'}>{status.label}</Tag>
          </Paragraph>
          {usingApi ? (
            <Alert
              type="success"
              showIcon
              message={`已连接 ${provider?.name}`}
              description="AI 写作工具的生成结果将由所选大模型产出。所有请求经本机代理转发，Key 不经过任何第三方。"
            />
          ) : (
            <Alert
              type="warning"
              showIcon
              message="正在使用本地演示模式"
              description="演示模式基于规则模板生成结果，可完整体验全部功能流程。在左侧选择服务商并填入 API Key 即可切换为真实 AI 写作。"
            />
          )}
          <Divider />
          <Paragraph type="secondary" style={{ fontSize: 12 }}>
            隐私说明：API Key 与全部文档数据仅存储在本机浏览器（localStorage）；请求链路为 浏览器 → 本机代理（开发 vite / 生产 nginx）→ 服务商官方 API，不经过任何其他服务器。国外服务商（OpenAI/Claude/Gemini）可能需要网络代理环境。
          </Paragraph>
        </div>
      </Col>
    </Row>
  )
}

export default Settings
