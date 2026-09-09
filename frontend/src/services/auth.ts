// 认证服务：对接 Go 后端 JWT 接口
// 后端未启动/未登录时应用自动运行在"仅本地模式"

export interface AuthUser {
  id: string
  username: string
  email: string
  full_name?: string
}

const TOKEN_KEY = 'awa_token'
const USER_KEY = 'awa_user'

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY)
}

export function getStoredUser(): AuthUser | null {
  try {
    const raw = localStorage.getItem(USER_KEY)
    return raw ? (JSON.parse(raw) as AuthUser) : null
  } catch {
    return null
  }
}

function persist(token: string, user: AuthUser) {
  localStorage.setItem(TOKEN_KEY, token)
  localStorage.setItem(USER_KEY, JSON.stringify(user))
}

export function logout() {
  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem(USER_KEY)
}

export function isAuthenticated(): boolean {
  return !!getToken()
}

function authHeaders(): HeadersInit {
  const t = getToken()
  return {
    'Content-Type': 'application/json',
    ...(t ? { Authorization: `Bearer ${t}` } : {}),
  }
}

async function handle(resp: Response): Promise<any> {
  const text = await resp.text()
  let data: any = {}
  try {
    data = text ? JSON.parse(text) : {}
  } catch {
    data = {}
  }
  if (!resp.ok) {
    throw new Error(data.error || `请求失败 (${resp.status})`)
  }
  return data
}

export async function register(username: string, email: string, password: string, fullName?: string): Promise<AuthUser> {
  const data = await handle(
    await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, email, password, full_name: fullName || username }),
    })
  )
  persist(data.token, data.user)
  return data.user
}

export async function login(username: string, password: string): Promise<AuthUser> {
  const data = await handle(
    await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    })
  )
  persist(data.token, data.user)
  return data.user
}

export async function fetchMe(): Promise<AuthUser> {
  const data = await handle(
    await fetch('/api/auth/me', { headers: authHeaders() })
  )
  localStorage.setItem(USER_KEY, JSON.stringify(data.user))
  return data.user
}
