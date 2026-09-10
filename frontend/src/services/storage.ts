// 文档本地存储服务（localStorage 持久化）
// 后端在线时可通过 api 层切换，这里先提供纯前端可用实现

export interface Doc {
  id: string
  title: string
  content: string
  createdAt: number
  updatedAt: number
}

const STORAGE_KEY = 'awa_documents'

function readAll(): Doc[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const list = JSON.parse(raw)
    return Array.isArray(list) ? list : []
  } catch {
    return []
  }
}

function writeAll(list: Doc[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list))
}

// 供同步服务直接读写的原始接口
export function readRaw(): Doc[] {
  return readAll()
}

export function writeRaw(list: Doc[]) {
  writeAll(list)
}

export function listDocs(): Doc[] {
  return readAll().sort((a, b) => b.updatedAt - a.updatedAt)
}

export function getDoc(id: string): Doc | undefined {
  return readAll().find((d) => d.id === id)
}

export function createDoc(title = '未命名文档', content = ''): Doc {
  const now = Date.now()
  const doc: Doc = {
    id: 'd' + now.toString(36) + Math.random().toString(36).slice(2, 7),
    title,
    content,
    createdAt: now,
    updatedAt: now,
  }
  const list = readAll()
  list.push(doc)
  writeAll(list)
  return doc
}

export function updateDoc(id: string, patch: Partial<Pick<Doc, 'title' | 'content'>>): void {
  const list = readAll()
  const idx = list.findIndex((d) => d.id === id)
  if (idx >= 0) {
    list[idx] = { ...list[idx], ...patch, updatedAt: Date.now() }
    writeAll(list)
  }
}

export function renameDoc(id: string, title: string): void {
  updateDoc(id, { title })
}

export function deleteDoc(id: string): void {
  writeAll(readAll().filter((d) => d.id !== id))
  recordDeleted([id])
}

// ---------------- 删除标记（tombstone）----------------
// 记录"本地已删除的文档 id"，同步时据此删除云端副本，
// 防止已删文档在下次同步时被云端重新拉回本地

const DELETED_KEY = 'awa_deleted_docs'
const MAX_TOMBSTONES = 500

export function getDeletedIds(): string[] {
  try {
    const raw = localStorage.getItem(DELETED_KEY)
    const list = raw ? JSON.parse(raw) : []
    return Array.isArray(list) ? list.filter((x) => typeof x === 'string') : []
  } catch {
    return []
  }
}

export function recordDeleted(ids: string[]): void {
  if (!ids.length) return
  const merged = [...new Set([...getDeletedIds(), ...ids])].slice(-MAX_TOMBSTONES)
  try {
    localStorage.setItem(DELETED_KEY, JSON.stringify(merged))
  } catch {
    /* 标记写失败不影响本地删除本身 */
  }
}

export function clearDeletedIds(ids: string[]): void {
  if (!ids.length) return
  const remove = new Set(ids)
  const rest = getDeletedIds().filter((id) => !remove.has(id))
  try {
    localStorage.setItem(DELETED_KEY, JSON.stringify(rest))
  } catch {
    /* 忽略 */
  }
}

export function countWords(text: string): number {
  // 中文字符按字计，英文单词按词计
  const cjk = (text.match(/[\u4e00-\u9fff]/g) || []).length
  const en = (text.replace(/[\u4e00-\u9fff]/g, ' ').match(/[a-zA-Z]+/g) || []).length
  return cjk + en
}
