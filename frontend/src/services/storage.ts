// 文档本地存储服务（localStorage 持久化）
// 后端在线时可通过 api 层切换，这里先提供纯前端可用实现

export interface DocVersion {
  at: number // 快照时间（即被快照内容当时的 updatedAt）
  title: string
  content: string
}

export interface Doc {
  id: string
  title: string
  content: string
  createdAt: number
  updatedAt: number
  versions?: DocVersion[] // 历史版本快照（旧的在前，最多保留 MAX_VERSIONS 条）
}

const STORAGE_KEY = 'awa_documents'
const MAX_VERSIONS = 20

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

export function updateDoc(
  id: string,
  patch: Partial<Pick<Doc, 'title' | 'content'>>,
  opts?: { snapshot?: boolean } // snapshot=true 时把覆盖前的内容存入历史版本
): void {
  const list = readAll()
  const idx = list.findIndex((d) => d.id === id)
  if (idx >= 0) {
    const old = list[idx]
    let versions = old.versions || []
    if (opts?.snapshot && patch.content !== undefined && patch.content !== old.content) {
      const last = versions[versions.length - 1]
      // 节流：距上次快照超过 5 分钟、或内容变化超过 300 字符才记一次，避免打字过程中刷爆版本列表
      const farEnough =
        !last || Date.now() - last.at > 5 * 60 * 1000 || Math.abs(old.content.length - last.content.length) > 300
      if (farEnough) versions = [...versions, { at: old.updatedAt, title: old.title, content: old.content }]
      while (versions.length > MAX_VERSIONS) versions = versions.slice(1)
    }
    list[idx] = { ...old, ...patch, versions, updatedAt: Date.now() }
    writeAll(list)
  }
}

// ---------------- 历史版本 ----------------

export function listVersions(id: string): DocVersion[] {
  return getDoc(id)?.versions || []
}

/** 回滚到指定版本：回滚前先把当前内容存为新快照，防误操作 */
export function restoreVersion(id: string, at: number): boolean {
  const doc = getDoc(id)
  if (!doc) return false
  const v = (doc.versions || []).find((x) => x.at === at)
  if (!v) return false
  const versions = [...(doc.versions || []), { at: doc.updatedAt, title: doc.title, content: doc.content }]
  while (versions.length > MAX_VERSIONS) versions.shift()
  const list = readAll()
  const idx = list.findIndex((d) => d.id === id)
  if (idx >= 0) {
    list[idx] = { ...doc, title: v.title, content: v.content, versions, updatedAt: Date.now() }
    writeAll(list)
  }
  return true
}

export function deleteVersion(id: string, at: number): void {
  const doc = getDoc(id)
  if (!doc) return
  updateDocRaw(id, { versions: (doc.versions || []).filter((v) => v.at !== at) })
}

function updateDocRaw(id: string, patch: Partial<Doc>): void {
  const list = readAll()
  const idx = list.findIndex((d) => d.id === id)
  if (idx >= 0) {
    list[idx] = { ...list[idx], ...patch }
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
