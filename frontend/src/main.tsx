import React from 'react'
import ReactDOM from 'react-dom/client'
import { ConfigProvider } from 'antd'
import zhCN from 'antd/locale/zh_CN'
import App from './App'
import './index.css'

const themeConfig = {
  token: {
    colorPrimary: '#0a84ff',
    borderRadius: 12,
    fontFamily:
      "-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'PingFang SC', 'Microsoft YaHei', sans-serif",
    colorBgContainer: 'rgba(255, 255, 255, 0.6)',
    colorBgElevated: 'rgba(255, 255, 255, 0.85)',
    colorText: '#1d1d1f',
    colorTextSecondary: 'rgba(60, 60, 67, 0.62)',
    colorBorder: 'rgba(60, 60, 67, 0.16)',
    colorBorderSecondary: 'rgba(255, 255, 255, 0.65)',
    boxShadow: '0 8px 32px rgba(31, 38, 135, 0.12)',
    controlHeight: 36,
  },
  components: {
    Card: { paddingLG: 22 },
    Tabs: { inkBarColor: '#0a84ff', itemSelectedColor: '#1d1d1f' },
    Menu: { itemBg: 'transparent', darkItemBg: 'transparent' },
  },
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ConfigProvider locale={zhCN} theme={themeConfig}>
      <App />
    </ConfigProvider>
  </React.StrictMode>
)
