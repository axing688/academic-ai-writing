// 个人文献库服务层（纯本地，数据不出本机）
// 能力：
//  · PDF 文本抽取（pdf.js，浏览器端）
//  · 文本分块（中文友好：按段落聚合，600 字 / 100 字重叠）
//  · IndexedDB 持久化（文献元数据 + 分块）
//  · BM25 检索（中文按字符二元组切词，零外部依赖，离线可用）
//  · GB/T 7714—2015 引用格式化

// ---------------- 类型定义 ----------------

export interface Literature {
  id: string
  title: string
  authors: string[] // ['张三', '李四'] 或英文 'Zhang S'
  year: number
  venue: string // 期刊 / 会议名
  type: 'journal' | 'conference' | 'thesis' | 'book' | 'report' | 'web'
  abstract?: string
  keywords?: string[]
  doi?: string
  source: 'pdf' | 'manual' | 'bibtex' | 'doi'
  fileName?: string
  charCount: number // 抽取的正文字符数
  chunkCount: number
  addedAt: number
}

export interface LibChunk {
  id: string
  litId: string
  seq: number // 在文献中的序号
  text: string
  page?: number // PDF 页码（1 起）
}

export interface RetrievedChunk extends LibChunk {
  score: number
  lit?: Literature
}

// ---------------- IndexedDB 基础 ----------------

const DB_NAME = 'awa_library'
const DB_VERSION = 1
const STORE_LITS = 'lits'
const STORE_CHUNKS = 'chunks'

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE_LITS)) {
        db.createObjectStore(STORE_LITS, { keyPath: 'id' })
      }
      if (!db.objectStoreNames.contains(STORE_CHUNKS)) {
        const s = db.createObjectStore(STORE_CHUNKS, { keyPath: 'id' })
        s.createIndex('litId', 'litId', { unique: false })
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

function txDone(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
    tx.onabort = () => reject(tx.error)
  })
}

function reqAs<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

// ---------------- 文献 CRUD ----------------

function uid(): string {
  return 'l' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
}

export async function listLits(): Promise<Literature[]> {
  const db = await openDB()
  const items = await reqAs(
    db.transaction(STORE_LITS, 'readonly').objectStore(STORE_LITS).getAll()
  ) as Literature[]
  return items.sort((a, b) => b.addedAt - a.addedAt)
}

export async function getLit(id: string): Promise<Literature | undefined> {
  const db = await openDB()
  return reqAs(db.transaction(STORE_LITS, 'readonly').objectStore(STORE_LITS).get(id)) as Promise<
    Literature | undefined
  >
}

export async function updateLit(lit: Literature): Promise<void> {
  const db = await openDB()
  const tx = db.transaction(STORE_LITS, 'readwrite')
  tx.objectStore(STORE_LITS).put(lit)
  await txDone(tx)
}

export async function deleteLit(id: string): Promise<void> {
  const db = await openDB()
  const tx = db.transaction([STORE_LITS, STORE_CHUNKS], 'readwrite')
  tx.objectStore(STORE_LITS).delete(id)
  const idx = tx.objectStore(STORE_CHUNKS).index('litId')
  const cursorReq = idx.openCursor(IDBKeyRange.only(id))
  cursorReq.onsuccess = () => {
    const cursor = cursorReq.result
    if (cursor) {
      cursor.delete()
      cursor.continue()
    }
  }
  await txDone(tx)
}

export async function clearLibrary(): Promise<void> {
  const db = await openDB()
  const tx = db.transaction([STORE_LITS, STORE_CHUNKS], 'readwrite')
  tx.objectStore(STORE_LITS).clear()
  tx.objectStore(STORE_CHUNKS).clear()
  await txDone(tx)
}

// ---------------- 文本分块 ----------------

function chunkText(text: string, size = 600, overlap = 100): Array<{ text: string; seq: number }> {
  const paragraphs = text
    .split(/\n{2,}|(?<=[。！？.!?])\s*(?=[A-Z\u4e00-\u9fff])/)
    .map((s) => s.trim())
    .filter((s) => s.length > 20)
  const chunks: string[] = []
  let buf = ''
  for (const p of paragraphs) {
    if ((buf + '\n' + p).length <= size) {
      buf = buf ? buf + '\n' + p : p
    } else {
      if (buf) chunks.push(buf)
      if (p.length <= size) {
        buf = p
      } else {
        // 超长段落硬切
        for (let i = 0; i < p.length; i += size - overlap) {
          chunks.push(p.slice(i, i + size))
        }
        buf = ''
      }
    }
  }
  if (buf) chunks.push(buf)
  return chunks.map((text, seq) => ({ text, seq }))
}

// ---------------- PDF 抽取（pdf.js）----------------
//
// 关键点：pdfjs-dist v4+ 的 worker 是 ES 模块，不能用经典方式加载。
// 之前把 `?url` 赋给 workerSrc，pdf.js 内部用经典 Worker 去加载 .mjs 会直接报
// "SyntaxError: Cannot use import statement outside a module"，随后回退
// fake worker 再失败，导致上传必然报错。
// 正确做法：通过 workerPort 直接注入一个 module 类型的 Worker 实例，
// 完全绕开 pdf.js 的 workerSrc / CDN wrapper 逻辑（dev 与生产构建均可用）。

const PDFJS_VERSION = '6.3.289'
// 中文 PDF 常见的 CID 编码需要 cMap 才能正确抽取文字；未联网时退化为按内嵌字体解析
const CMAP_URL = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${PDFJS_VERSION}/cmaps/`

let pdfjsReady: Promise<typeof import('pdfjs-dist')> | null = null

async function getPdfjs() {
  if (!pdfjsReady) {
    pdfjsReady = (async () => {
      const pdfjs = await import('pdfjs-dist')
      if (!pdfjs.GlobalWorkerOptions.workerPort) {
        try {
          const url = (await import('pdfjs-dist/build/pdf.worker.min.mjs?url')).default
          pdfjs.GlobalWorkerOptions.workerPort = new Worker(url, { type: 'module' })
        } catch {
          // 兜底：让 Vite 以自己的方式打包 worker（dev 下即行，build 下走 ?worker 管线）
          const W = (await import('pdfjs-dist/build/pdf.worker.min.mjs?worker')).default
          pdfjs.GlobalWorkerOptions.workerPort = new W()
        }
      }
      return pdfjs
    })()
  }
  return pdfjsReady
}

export interface PdfExtractResult {
  pages: string[] // 每页文本
  fullText: string
}

export async function extractPdf(
  file: File,
  onProgress?: (ratio: number, numPages: number) => void
): Promise<PdfExtractResult> {
  const pdfjs = await getPdfjs()
  const buf = await file.arrayBuffer()
  let pdf: Awaited<ReturnType<typeof import('pdfjs-dist').getDocument>['promise']>
  let loadingTask: ReturnType<typeof import('pdfjs-dist').getDocument>
  try {
    loadingTask = pdfjs.getDocument({ data: buf, cMapUrl: CMAP_URL, cMapPacked: true })
    pdf = await loadingTask.promise
  } catch (e) {
    const detail = e instanceof Error ? e.message : String(e)
    throw new Error(
      /password/i.test(detail)
        ? '该 PDF 已加密，暂不支持导入'
        : `无法打开 PDF 文件（可能已损坏或不是有效 PDF）：${detail}`
    )
  }
  const pages: string[] = []
  for (let i = 1; i <= pdf.numPages; i++) {
    try {
      const page = await pdf.getPage(i)
      const content = await page.getTextContent()
      // 按 transform Y 值聚合同一行，重建阅读顺序
      let lastY: number | null = null
      let line = ''
      const lines: string[] = []
      for (const item of content.items as Array<{ str?: string; transform?: number[]; hasEOL?: boolean }>) {
        if (typeof item.str !== 'string') continue
        const y: number | null = item.transform ? item.transform[5] : lastY
        if (lastY !== null && y !== null && Math.abs(y - lastY) > 3) {
          lines.push(line)
          line = ''
        }
        line += item.str
        lastY = y
        if (item.hasEOL) {
          lines.push(line)
          line = ''
          lastY = null
        }
      }
      if (line) lines.push(line)
      pages.push(lines.join('\n'))
      // 释放页面内存，避免大 PDF 撑爆浏览器
      page.cleanup()
    } catch {
      // 单页抽取失败不阻断整体导入
      pages.push('')
    }
    onProgress?.(i / pdf.numPages, pdf.numPages)
  }
  await loadingTask.destroy()
  return { pages, fullText: pages.join('\n\n') }
}

// ---------------- 文献导入 ----------------

/** 从 PDF 文件名推断元数据："张三等-2023-基于深度学习的XX研究.pdf" */
function guessMetaFromPdf(file: File, text: string): Partial<Literature> {
  const base = file.name.replace(/\.pdf$/i, '')
  let title = base
  let year = 0
  let authors: string[] = []
  const m = base.match(/^(.+?)[-_(](\d{4})[-_)](.+)$/)
  if (m) {
    authors = m[1]
      .split(/[等,，、]/)
      .map((s) => s.trim())
      .filter(Boolean)
    year = Number(m[2])
    title = m[3]
  } else {
    const y = base.match(/(19|20)\d{2}/)
    if (y) year = Number(y[0])
  }
  // 正文首页尝试抽取更好的标题（前几行中最长的）
  if (text) {
    const headLines = text
      .split('\n')
      .map((s) => s.trim())
      .filter((s) => s.length >= 8 && s.length <= 80 && !/^\d+$/.test(s))
      .slice(0, 6)
    if (headLines.length) {
      title = headLines.sort((a, b) => b.length - a.length)[0].replace(/\s+/g, ' ')
    }
    // 首页找 4 位年份
    if (!year) {
      const ym = text.slice(0, 2000).match(/(19|20)\d{2}/)
      if (ym) year = Number(ym[0])
    }
  }
  return { title, year: year || new Date().getFullYear(), authors }
}

export async function importPdf(
  file: File,
  onProgress?: (ratio: number, msg: string) => void
): Promise<Literature> {
  onProgress?.(0.03, '打开 PDF…')
  const { pages, fullText } = await extractPdf(file, (r, numPages) =>
    onProgress?.(0.05 + r * 0.75, `抽取文本：第 ${Math.ceil(r * numPages)} / ${numPages} 页`)
  )
  if (fullText.replace(/\s/g, '').length < 100) {
    throw new Error('未能从 PDF 中抽取到足够文本（可能是扫描版 PDF，暂不支持 OCR）')
  }
  const meta = guessMetaFromPdf(file, pages[0] || fullText)
  onProgress?.(0.85, '建立检索索引…')
  const lit: Literature = {
    id: uid(),
    title: meta.title || file.name,
    authors: meta.authors || [],
    year: meta.year ?? new Date().getFullYear(),
    venue: '',
    type: 'journal',
    abstract: (pages[0] || '').slice(0, 500),
    source: 'pdf',
    fileName: file.name,
    charCount: fullText.length,
    chunkCount: 0,
    addedAt: Date.now(),
  }
  const chunks = chunkText(pages.flatMap((p) => p.split(/\n{2,}/).map((t) => t.trim())).join('\n\n'))
  lit.chunkCount = chunks.length
  const db = await openDB()
  const tx = db.transaction([STORE_LITS, STORE_CHUNKS], 'readwrite')
  tx.objectStore(STORE_LITS).put(lit)
  const store = tx.objectStore(STORE_CHUNKS)
  for (const c of chunks) {
    store.put({ id: `${lit.id}_${c.seq}`, litId: lit.id, seq: c.seq, text: c.text } as LibChunk)
  }
  await txDone(tx)
  onProgress?.(1, '完成')
  return lit
}

export async function importManual(meta: Omit<Literature, 'id' | 'charCount' | 'chunkCount' | 'addedAt'> & { bodyText?: string }): Promise<Literature> {
  const lit: Literature = {
    ...meta,
    id: uid(),
    charCount: (meta.bodyText || meta.abstract || '').length,
    chunkCount: 0,
    addedAt: Date.now(),
  }
  const body = meta.bodyText || ''
  const chunks = body ? chunkText(body) : []
  lit.chunkCount = chunks.length
  const db = await openDB()
  const tx = db.transaction([STORE_LITS, STORE_CHUNKS], 'readwrite')
  tx.objectStore(STORE_LITS).put(lit)
  const store = tx.objectStore(STORE_CHUNKS)
  for (const c of chunks) {
    store.put({ id: `${lit.id}_${c.seq}`, litId: lit.id, seq: c.seq, text: c.text } as LibChunk)
  }
  await txDone(tx)
  return lit
}

/** 批量导入 BibTeX（解析 @type{key, title=..., author=..., year=..., journal/booktitle=...}） */
export async function importBibtex(text: string): Promise<{ ok: number; fail: number }> {
  const entries = text.split(/(?=@\w+\s*\{)/).filter((e) => /@\w+\s*\{/.test(e))
  let ok = 0
  let fail = 0
  for (const raw of entries) {
    try {
      const typeM = raw.match(/@(\w+)\s*\{/)
      const type = (typeM?.[1] || 'article').toLowerCase()
      if (type === 'comment' || type === 'preamble' || type === 'string') {
        fail++
        continue
      }
      const body = raw.slice(raw.indexOf('{') + 1, raw.lastIndexOf('}'))
      const comma = body.indexOf(',')
      const fieldsRaw = body.slice(comma + 1)
      const fields: Record<string, string> = {}
      const fieldRe = /(\w+)\s*=\s*([{"])([\s\S]*?)\2|(\w+)\s*=\s*([^,\n}]+)/g
      let fm: RegExpExecArray | null
      while ((fm = fieldRe.exec(fieldsRaw))) {
        const key = (fm[1] || fm[4] || '').toLowerCase()
        const val = (fm[3] || fm[5] || '').replace(/[{}\s]+/g, ' ').trim()
        if (key) fields[key] = val
      }
      if (!fields.title) {
        fail++
        continue
      }
      const authorNames = (fields.author || '')
        .split(/\s+and\s+|;/i)
        .map((a) => a.trim())
        .filter(Boolean)
      const venue = fields.journal || fields.booktitle || fields.publisher || ''
      const t =
        type === 'inproceedings'
          ? 'conference'
          : type === 'phdthesis' || type === 'mastersthesis'
            ? 'thesis'
            : type === 'book'
              ? 'book'
              : type === 'techreport'
                ? 'report'
                : 'journal'
      await importManual({
        title: fields.title,
        authors: authorNames,
        year: Number(fields.year) || 0,
        venue,
        type: t as Literature['type'],
        abstract: fields.abstract || '',
        keywords: (fields.keywords || '').split(/[,;，；]/).map((k) => k.trim()).filter(Boolean),
        source: 'bibtex',
        bodyText: fields.abstract || '',
      })
      ok++
    } catch {
      fail++
    }
  }
  return { ok, fail }
}

// ---------------- DOI 导入（CrossRef，浏览器直连免费 API）----------------

export interface DoiCandidate {
  doi: string
  title: string
  authors: string[]
  year: number
  venue: string
  type: Literature['type']
  abstract: string
}

/** 归一化 DOI 输入：去掉 https://doi.org/ 前缀、doi: 前缀和多余空白 */
export function normalizeDoi(input: string): string {
  return input
    .trim()
    .replace(/^https?:\/\/(dx\.)?doi\.org\//i, '')
    .replace(/^doi:\s*/i, '')
    .replace(/\s+/g, '')
}

export function looksLikeDoi(input: string): boolean {
  return /^10\.\d{4,9}\/\S+$/.test(normalizeDoi(input))
}

function stripJats(s: string | undefined): string {
  return (s || '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#?\w+;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function mapCrType(t: string): Literature['type'] {
  switch (t) {
    case 'proceedings-article':
    case 'proceedings':
      return 'conference'
    case 'book-chapter':
    case 'book':
    case 'monograph':
      return 'book'
    case 'thesis':
    case 'dissertation':
      return 'thesis'
    case 'report':
    case 'report-component':
      return 'report'
    case 'posted-content':
    case 'preprint':
    case 'web-resource':
      return 'web'
    default:
      return 'journal'
  }
}

function crToCandidate(m: Record<string, any>): DoiCandidate {
  const authors: string[] = (m.author || [])
    .map((a: { given?: string; family?: string; name?: string }) =>
      a.name || [a.given, a.family].filter(Boolean).join(' ')
    )
    .filter(Boolean)
  const year: number =
    m.issued?.['date-parts']?.[0]?.[0] || m.published?.['date-parts']?.[0]?.[0] || m.created?.['date-parts']?.[0]?.[0] || 0
  return {
    doi: m.DOI || '',
    title: stripJats(Array.isArray(m.title) ? m.title[0] : m.title) || m.DOI || '（无标题）',
    authors,
    year,
    venue: stripJats(Array.isArray(m['container-title']) ? m['container-title'][0] : m['container-title']) || m.publisher || '',
    type: mapCrType(m.type || ''),
    abstract: stripJats(m.abstract),
  }
}

async function crFetchJson(url: string): Promise<any> {
  let r: Response
  try {
    r = await fetch(url, { headers: { Accept: 'application/json' } })
  } catch (e) {
    throw new Error('无法连接 CrossRef 服务，请检查网络（该功能需联网）')
  }
  if (r.status === 404) throw new Error('未找到该 DOI，请确认输入是否正确')
  if (!r.ok) throw new Error(`CrossRef 服务返回错误（HTTP ${r.status}），请稍后重试`)
  return r.json()
}

/** 按 DOI 精确获取一条文献元数据 */
export async function searchByDoi(doiInput: string): Promise<DoiCandidate> {
  const doi = normalizeDoi(doiInput)
  if (!looksLikeDoi(doi)) throw new Error('DOI 格式不正确，应为 10.xxxx/xxxx 形式（如 10.1038/s41586-021-03819-2）')
  const j = await crFetchJson(`https://api.crossref.org/works/${encodeURIComponent(doi)}`)
  return crToCandidate(j.message)
}

/** 按标题/关键词在 CrossRef 检索文献 */
export async function searchCrossref(query: string, rows = 8): Promise<DoiCandidate[]> {
  const q = query.trim()
  if (!q) return []
  const url =
    `https://api.crossref.org/works?query.bibliographic=${encodeURIComponent(q)}` +
    `&rows=${rows}&select=DOI,title,author,issued,container-title,type,abstract`
  const j = await crFetchJson(url)
  const items: Record<string, any>[] = j.message?.items || []
  return items.map(crToCandidate)
}

/** 将 DOI 检索结果导入文献库（元数据入库；如需参与 RAG 检索请再上传对应 PDF） */
export async function importDoiCandidate(c: DoiCandidate): Promise<Literature> {
  return importManual({
    title: c.title,
    authors: c.authors,
    year: c.year,
    venue: c.venue,
    type: c.type,
    abstract: c.abstract,
    keywords: [],
    source: 'doi',
    bodyText: c.abstract,
    doi: c.doi,
  })
}

// ---------------- BM25 检索 ----------------

/** 中文按字符二元组 + 连续英文/数字词元 */
export function tokenize(text: string): string[] {
  const tokens: string[] = []
  const enRuns = text.toLowerCase().match(/[a-z0-9]+/g) || []
  tokens.push(...enRuns)
  const cjkRuns = text.match(/[\u4e00-\u9fff]+/g) || []
  for (const run of cjkRuns) {
    if (run.length === 1) {
      tokens.push(run)
      continue
    }
    for (let i = 0; i < run.length - 1; i++) tokens.push(run.slice(i, i + 2))
  }
  return tokens
}

export interface SearchOptions {
  topK?: number
  litIds?: string[] // 限定文献范围
}

export async function searchLibrary(query: string, opts: SearchOptions = {}): Promise<RetrievedChunk[]> {
  const topK = opts.topK ?? 6
  const qTokens = tokenize(query)
  if (!qTokens.length) return []
  const db = await openDB()
  const allChunks = (await reqAs(
    db.transaction(STORE_CHUNKS, 'readonly').objectStore(STORE_CHUNKS).getAll()
  )) as LibChunk[]
  const pool = opts.litIds?.length ? allChunks.filter((c) => opts.litIds!.includes(c.litId)) : allChunks
  if (!pool.length) return []
  const N = pool.length
  const avgdl = pool.reduce((s, c) => s + c.text.length, 0) / N
  const k1 = 1.5
  const b = 0.75

  // df 统计
  const df = new Map<string, number>()
  const docs = pool.map((c) => {
    const tokens = tokenize(c.text)
    const tf = new Map<string, number>()
    for (const t of tokens) tf.set(t, (tf.get(t) || 0) + 1)
    for (const t of new Set(qTokens)) {
      if (tf.has(t)) df.set(t, (df.get(t) || 0) + 1)
    }
    return { chunk: c, tf, len: c.text.length }
  })

  const scored = docs.map((d) => {
    let score = 0
    for (const t of new Set(qTokens)) {
      const f = d.tf.get(t)
      if (!f) continue
      const n = df.get(t) || 0
      const idf = Math.log(1 + (N - n + 0.5) / (n + 0.5))
      score += idf * ((f * (k1 + 1)) / (f + k1 * (1 - b + (b * d.len) / avgdl)))
    }
    return { ...d.chunk, score }
  })
  const top = scored
    .filter((s) => s.score > 0)
    .sort((a, b2) => b2.score - a.score)
    .slice(0, topK)
  // 附加文献元数据
  const lits = await listLits()
  const litMap = new Map(lits.map((l) => [l.id, l]))
  return top.map((t) => ({ ...t, lit: litMap.get(t.litId) }))
}

// ---------------- RAG 上下文构建 ----------------

export interface RagContext {
  contextText: string // 拼入 prompt 的检索片段
  citations: string[] // GB/T 7714 引用列表
  hitCount: number
}

/** 为一次 AI 生成构建文献上下文：query 取主题/输入文本 */
export async function buildRagContext(query: string, topK = 6): Promise<RagContext> {
  const hits = await searchLibrary(query, { topK })
  if (!hits.length) return { contextText: '', citations: [], hitCount: 0 }
  const litMap = new Map((await listLits()).map((l) => [l.id, l]))
  const usedLitIds = new Set<string>()
  const parts: string[] = []
  for (const h of hits) {
    const lit = h.lit || litMap.get(h.litId)
    if (!lit) continue
    usedLitIds.add(lit.id)
    const author = lit.authors[0] || lit.title.slice(0, 10)
    parts.push(`【文献片段 ${usedLitIds.size}｜${author}等 ${lit.year}｜《${lit.title}》】\n${h.text}`)
  }
  const contextText =
    `以下是你个人文献库中与写作内容最相关的 ${parts.length} 个真实文献片段。` +
    `写作时只能基于这些片段和常识性内容展开；凡引用片段观点、数据、结论处，必须以「（第一作者 等, 年份）」格式标注；` +
    `片段未覆盖的内容不得虚构文献或数据：\n\n` +
    parts.join('\n\n---\n\n')
  const citations = [...usedLitIds].map((id) => formatCitation(litMap.get(id)!))
  return { contextText, citations, hitCount: hits.length }
}

// ---------------- GB/T 7714—2015 ----------------

function fmtAuthorsGB(authors: string[], lang?: 'zh' | 'en'): string {
  if (!authors.length) return ''
  const isEn = lang === 'en' || /[a-zA-Z]/.test(authors[0])
  const list = authors.slice(0, 3).map((a) => {
    if (isEn) {
      // "Zhang San" -> "ZHANG S"
      const parts = a.replace(/[.,]/g, '').split(/\s+/).filter(Boolean)
      if (parts.length >= 2) {
        const last = parts[parts.length - 1].toUpperCase()
        const inis = parts
          .slice(0, -1)
          .map((p) => p[0].toUpperCase())
          .join('')
        return `${last} ${inis}`
      }
      return a.toUpperCase()
    }
    return a
  })
  let s = list.join(', ')
  if (authors.length > 3) s += ', 等'
  else if (isEn && authors.length <= 3) s += list.length > 1 ? '' : ''
  return s
}

export function formatCitation(lit: Literature): string {
  const authors = fmtAuthorsGB(lit.authors, /[a-zA-Z]/.test(lit.authors[0] || '') ? 'en' : 'zh')
  const a = authors ? `${authors}. ` : ''
  const t = `${lit.title}[${typeCode(lit.type)}]. `
  switch (lit.type) {
    case 'journal':
      return `${a}${t}${lit.venue || 'Unknown Journal'}, ${lit.year}.`
    case 'conference':
      return `${a}${t}Proceedings of ${lit.venue || 'the Conference'}, ${lit.year}.`
    case 'thesis':
      return `${a}${t}${lit.venue || '学位授予单位'}, ${lit.year}.`
    case 'book':
      return `${a}${t}${lit.venue || '出版社'}, ${lit.year}.`
    case 'report':
      return `${a}${t}${lit.venue || '报告机构'}, ${lit.year}.`
    default:
      return `${a}${t}${lit.venue}, ${lit.year}.`
  }
}

function typeCode(t: Literature['type']): string {
  switch (t) {
    case 'journal':
      return 'J'
    case 'conference':
      return 'C'
    case 'thesis':
      return 'D'
    case 'book':
      return 'M'
    case 'report':
      return 'R'
    default:
      return 'EB/OL'
  }
}

export function exportCitations(lits: Literature[]): string {
  return lits
    .slice()
    .sort((x, y) => {
      const ax = x.authors[0] || ''
      const ay = y.authors[0] || ''
      return ax.localeCompare(ay, 'zh')
    })
    .map((l, i) => `[${i + 1}] ${formatCitation(l)}`)
    .join('\n')
}
