// LLM 请求转发 Worker
// 与本地 Vite 中间件（vite.config.ts 的 llmProxy 插件）行为一致：
// 前端请求 /llm/<provider>/... 并携带 X-AWA-Target 头（官方 API Base URL），
// 本 Worker 转发到目标服务，避免浏览器跨域、隐藏真实调用链。
// 部署：在 cloudflare/llm-proxy 目录执行 npx wrangler deploy

const ALLOWED_HEADERS = [
  'content-type',
  'authorization',
  'x-api-key',
  'anthropic-version',
  'anthropic-dangerous-direct-browser-access',
  'x-goog-api-key',
  'accept',
]

function jsonResponse(status, obj) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url)

    // 健康检查
    if (url.pathname === '/' || url.pathname === '/health') {
      return jsonResponse(200, { status: 'ok', service: 'awa-llm-proxy' })
    }

    if (!url.pathname.startsWith('/llm/')) {
      return jsonResponse(404, { error: 'not found' })
    }

    // 可选防盗用：校验 Origin/Referer
    if (env.ALLOWED_ORIGIN) {
      const origin = request.headers.get('origin') || request.headers.get('referer') || ''
      if (!origin.startsWith(env.ALLOWED_ORIGIN)) {
        return jsonResponse(403, { error: 'forbidden' })
      }
    }

    const target = (request.headers.get('x-awa-target') || '').replace(/\/+$/, '')
    if (!target) {
      return jsonResponse(400, { error: 'missing X-AWA-Target header' })
    }
    if (!/^https?:\/\//i.test(target)) {
      return jsonResponse(400, { error: 'invalid X-AWA-Target header' })
    }

    // 剥离 /llm/<provider> 段，拼接目标 URL（保留查询参数）
    const subPath = url.pathname.replace(/^\/llm\/[^/]+/, '')
    const upstream = target + subPath + url.search

    // 仅转发必要的请求头
    const fwd = new Headers()
    for (const k of ALLOWED_HEADERS) {
      const v = request.headers.get(k)
      if (v) fwd.set(k, v)
    }

    const method = request.method.toUpperCase()
    let resp
    try {
      resp = await fetch(upstream, {
        method,
        headers: fwd,
        body: method === 'GET' || method === 'HEAD' ? undefined : request.body,
        // @ts-ignore - 流式请求体需要 duplex
        duplex: 'half',
        redirect: 'manual',
      })
    } catch (e) {
      return jsonResponse(502, { error: 'proxy failed', detail: String(e) })
    }

    // 透传响应头（跳过逐跳头），流式返回以支持 SSE
    const out = new Headers(resp.headers)
    for (const k of ['content-encoding', 'transfer-encoding', 'content-length', 'connection', 'set-cookie']) {
      out.delete(k)
    }
    return new Response(resp.body, { status: resp.status, headers: out })
  },
}
