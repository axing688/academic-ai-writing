// 多设备数据同步：本地 localStorage ↔ 后端 MySQL 双向合并
// 策略：以文档 id 为键做并集，冲突时 updatedAt 较新者胜出
// 后端不可达时静默降级为纯本地模式，不影响写作
//
// 稳定性护栏（修复 2026-09-09 云端文档暴涨至 42 万条事故）：
//  · 同一时间只允许一个同步任务（防止 60s 定时器与手动同步叠加执行）
//  · 推送循环遍历"静态快照"，循环中只读不增删——旧版在 Map 迭代期间替换
//    文档 id，导致新建的云端条目再次被迭代访问 → 误判为"需要新建" →
//    无限 POST（每秒约 220 次，直至页面关闭）
//  · 云端条目数异常（>5000）时拒绝合并，防止一次性拉爆浏览器
//  · 写回 localStorage 前检查体量，超限时报错而不是抛出未捕获异常

import { getToken } from './auth'
import { readRaw, writeRaw, type Doc } from './storage'

export interface SyncResult {
  ok: boolean
  pushed: number
  pulled: number
  message: string
}

interface RemoteDoc {
  id: string
  title: string
  content: string
  created_at: string
  updated_at: string
  word_count?: number
}

// 云端文档数量安全上限：正常个人文档库远达不到这个量级，
// 超过说明云端已被异常数据污染，宁可不同步也不能拖垮页面
const MAX_REMOTE_DOCS = 5000
// localStorage 单键写入安全上限（浏览器总配额一般 5MB）
const MAX_LOCAL_BYTES = 4 * 1024 * 1024

let syncing = false

function toLocal(d: RemoteDoc): Doc {
  return {
    id: d.id,
    title: d.title || '未命名文档',
    content: d.content || '',
    createdAt: Date.parse(d.created_at) || Date.now(),
    updatedAt: Date.parse(d.updated_at) || Date.now(),
  }
}

async function api(path: string, init?: RequestInit): Promise<Response> {
  return fetch(path, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${getToken()}`,
      ...(init?.headers || {}),
    },
  })
}

export async function syncNow(): Promise<SyncResult> {
  if (syncing) {
    return { ok: false, pushed: 0, pulled: 0, message: '上一次同步尚未完成，已跳过本次同步' }
  }
  if (!getToken()) {
    return { ok: false, pushed: 0, pulled: 0, message: '未登录，跳过同步' }
  }
  syncing = true
  try {
    return await doSync()
  } finally {
    syncing = false
  }
}

async function doSync(): Promise<SyncResult> {
  // 1. 拉取云端列表
  let remote: RemoteDoc[]
  try {
    const resp = await api('/api/documents')
    if (resp.status === 401) {
      return { ok: false, pushed: 0, pulled: 0, message: '登录已过期，请重新登录' }
    }
    if (!resp.ok) throw new Error(`status ${resp.status}`)
    const data = await resp.json()
    remote = (data.documents || []) as RemoteDoc[]
  } catch {
    return { ok: false, pushed: 0, pulled: 0, message: '无法连接云端服务（后端未启动？），已保持本地模式' }
  }

  if (remote.length > MAX_REMOTE_DOCS) {
    return {
      ok: false,
      pushed: 0,
      pulled: 0,
      message: `云端文档数量异常（${remote.length} 篇，超过安全上限 ${MAX_REMOTE_DOCS}），已暂停同步以保护本地数据`,
    }
  }

  const local = readRaw()

  // 云端 → 本地映射（id 去重）
  const remoteMap = new Map<string, Doc>()
  for (const d of remote) {
    const ld = toLocal(d)
    remoteMap.set(ld.id, ld)
  }

  // 内容级去重：同一篇文档因历史事故在云端/本地存在不同 id 的副本时，
  // 以云端为准、丢弃本地重复副本，避免每次同步都重复推送一份。
  // 仅对"有正文"或"非默认标题"的文档生效，避免误合并多个空白草稿。
  const DEFAULT_TITLES = new Set(['未命名草稿', '未命名文档'])
  const docSig = (d: Doc) => `${d.title}\u0000${d.content}`
  const isRealDoc = (d: Doc) => !!d.content || !DEFAULT_TITLES.has(d.title)
  const remoteSigs = new Map<string, string>()
  for (const [id, rd] of remoteMap) {
    if (isRealDoc(rd)) remoteSigs.set(docSig(rd), id)
  }

  // 2. 合并：本地与云端取并集，冲突时 updatedAt 新者胜
  const merged = new Map<string, Doc>()
  let deduped = 0
  for (const d of local) {
    if (!remoteMap.has(d.id) && isRealDoc(d) && remoteSigs.has(docSig(d))) {
      // 云端已有同内容文档，跳过本地重复副本
      deduped++
      continue
    }
    merged.set(d.id, d)
  }
  let pulled = 0
  for (const [id, rd] of remoteMap) {
    const existing = merged.get(id)
    if (!existing) {
      merged.set(id, rd)
      pulled++
    } else if (rd.updatedAt > existing.updatedAt) {
      merged.set(id, rd)
      pulled++
    }
  }

  // 3. 推送：本地比云端新（或云端不存在）的文档
  //    关键修复：先对 merged 做静态快照再遍历，循环体内绝不增删 merged，
  //    避免 Map 迭代器重访新增条目造成无限推送
  const snapshot = Array.from(merged.entries())
  let pushed = 0
  for (const [id, d] of snapshot) {
    const rd = remoteMap.get(id)
    const needCreate = !rd
    const needUpdate = !!rd && d.updatedAt > rd.updatedAt
    if (!needCreate && !needUpdate) continue
    try {
      if (needCreate) {
        const resp = await api('/api/documents', {
          method: 'POST',
          body: JSON.stringify({ title: d.title, content: d.content }),
        })
        if (resp.ok) {
          pushed++
          // 本地临时 id 与云端生成的 id 不同：写回时用云端 id 替换，
          // 本条目不会再被本轮循环访问（遍历的是快照）
          const created = (await resp.json()) as RemoteDoc
          const ld = toLocal(created)
          if (ld.id && ld.id !== id) {
            merged.delete(id)
            merged.set(ld.id, ld)
          }
        }
      } else if (needUpdate) {
        const resp = await api(`/api/documents/${id}`, {
          method: 'PUT',
          body: JSON.stringify({ title: d.title, content: d.content }),
        })
        if (resp.ok) pushed++
      }
    } catch {
      // 单条失败不中断整体同步
    }
  }

  // 4. 写回本地（先检查体量，防止撑爆 localStorage 且不再吞掉异常）
  const out = Array.from(merged.values()).sort((a, b) => b.updatedAt - a.updatedAt)
  let bytes = 0
  try {
    bytes = new Blob([JSON.stringify(out)]).size
  } catch {
    /* 序列化失败按 0 处理，下一步写入时会再暴露 */
  }
  if (bytes > MAX_LOCAL_BYTES) {
    return {
      ok: false,
      pushed,
      pulled,
      message: `同步数据过大（${(bytes / 1048576).toFixed(1)} MB），未写回本地，请精简文档后再同步`,
    }
  }
  try {
    writeRaw(out)
  } catch {
    return { ok: false, pushed, pulled, message: '本地存储写入失败（浏览器存储配额不足）' }
  }
  return {
    ok: true,
    pushed,
    pulled,
    message:
      `同步完成：拉取 ${pulled} 篇，推送 ${pushed} 篇` +
      (deduped ? `，本地去重 ${deduped} 篇重复副本` : ''),
  }
}
