import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// LLM 动态代理中间件：
// 前端请求 /llm/<provider>/... 并携带 X-AWA-Target 头（官方 API Base URL），
// 由本中间件转发到目标服务，避免浏览器跨域。
// 与 nginx 生产配置（frontend/docker/nginx.conf 中按同名头转发）行为一致。
function llmProxy(): Plugin {
  return {
    name: 'awa-llm-proxy',
    configureServer(server) {
      server.middlewares.use('/llm', (req, res) => {
        const target = (req.headers['x-awa-target'] as string | undefined)?.replace(/\/+$/, '')
        if (!target) {
          res.statusCode = 400
          res.end(JSON.stringify({ error: 'missing X-AWA-Target header' }))
          return
        }
        // connect 已剥离 /llm 前缀，这里再剥离服务商段
        const subPath = (req.url || '').replace(/^\/[^/]+/, '')
        const upstream = target + subPath

        const chunks: Buffer[] = []
        req.on('data', (c) => chunks.push(c))
        req.on('end', async () => {
          // 仅转发必要的请求头
          const fwd: Record<string, string> = {}
          const allow = [
            'content-type',
            'authorization',
            'x-api-key',
            'anthropic-version',
            'anthropic-dangerous-direct-browser-access',
            'x-goog-api-key',
            'accept',
          ]
          for (const k of allow) {
            const v = req.headers[k]
            if (v) fwd[k] = Array.isArray(v) ? v[0] : v
          }
          try {
            const method = (req.method || 'POST').toUpperCase()
            const r = await fetch(upstream, {
              method,
              headers: fwd,
              body: method === 'GET' || method === 'HEAD' ? undefined : Buffer.concat(chunks),
            })
            res.statusCode = r.status
            r.headers.forEach((v, k) => {
              if (!['content-encoding', 'transfer-encoding', 'content-length', 'connection', 'set-cookie'].includes(k)) {
                res.setHeader(k, v)
              }
            })
            const text = await r.text()
            res.end(text)
          } catch (e) {
            res.statusCode = 502
            res.end(JSON.stringify({ error: 'proxy failed', detail: String(e) }))
          }
        })
      })
    },
  }
}

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), llmProxy()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 3000,
    proxy: {
      // Go 后端接口（本地开发）
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
  },
})
