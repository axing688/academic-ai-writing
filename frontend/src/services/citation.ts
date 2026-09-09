// 引用真实性校验服务
// 参考 OpenDraft 的工程实践：对 AI 生成的参考文献条目，向 CrossRef 与 OpenAlex
// 两个权威学术数据库交叉检索，匹配不到的标记出来提示人工复核。
// 两个 API 均免费、无需 Key、支持浏览器直连（已开 CORS）。
// 注意：检索不到 ≠ 一定编造（中文学位论文、部分中文期刊未被收录），
// 因此结果定位为"辅助核查"而非"判决"。

export interface RefCheck {
  index: number
  ref: string
  status: 'verified' | 'not_found' | 'error'
  doi?: string
  title?: string
  year?: string
  container?: string // 期刊/会议名
  url?: string
  score?: number // 标题相似度 0-1
  source?: 'crossref' | 'openalex'
}

const CROSSREF_API = 'https://api.crossref.org/works'
const OPENALEX_API = 'https://api.openalex.org/works'
const MAILTO = 'awa-local@users.noreply.github.com' // CrossRef 礼貌池

// ---------------- 参考文献条目抽取 ----------------

/**
 * 从 AI 生成结果中抽取参考文献条目。
 * 支持三种常见形态：
 *  1. [1] xxx / [2] xxx 编号列表
 *  2. "参考文献"标题后的非编号行
 *  3. 含 (2020) 或 (2020-05-12) 年份的散落行（兜底）
 */
export function extractRefEntries(text: string): string[] {
  if (!text) return []
  const lines = text
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
  const out: string[] = []

  const looksLikeRef = (l: string): boolean =>
    l.length >= 12 && /\((?:19|20)\d{2}[a-z]?(?:[-/](?:\d{1,2}))*\)|,(?:19|20)\d{2}|[. ](?:19|20)\d{2}\)?[.:]/.test(l)

  // 形态 1：[n] 编号
  for (const l of lines) {
    const m = l.match(/^\[?(\d{1,3})\][.、]?\s*(.+)$/)
    if (m && m[2].length >= 10) out.push(m[2])
  }
  if (out.length >= 2) return dedupe(out)

  // 形态 2：参考文献/References 标题之后
  const headIdx = lines.findIndex((l) => /^(参考文献|参\s*考\s*文\s*献|references|bibliography)$/i.test(l.replace(/[:：\s]+$/, '')))
  if (headIdx >= 0) {
    for (const l of lines.slice(headIdx + 1)) {
      if (l.length >= 12 && !/^(注|说明|【)/.test(l)) out.push(l.replace(/^\[\d+\][.、]?\s*/, ''))
    }
    if (out.length >= 2) return dedupe(out)
  }

  // 形态 3：含年份的行兜底
  for (const l of lines) {
    if (looksLikeRef(l) && !/^(【|摘\s*要|第[一二三四五六七八九十]+章|关键词)/.test(l)) out.push(l.replace(/^\[\d+\][.、]?\s*/, ''))
  }
  return dedupe(out)
}

function dedupe(arr: string[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const x of arr) {
    const k = x.slice(0, 40)
    if (!seen.has(k)) {
      seen.add(k)
      out.push(x)
    }
  }
  return out
}

// ---------------- 相似度计算 ----------------

function normTokens(s: string): Set<string> {
  return new Set(
    s
      .toLowerCase()
      .replace(/[^a-z0-9\u4e00-\u9fff]+/g, ' ')
      .split(/\s+/)
      .filter((t) => t.length > 1)
  )
}

/** 包含度相似度：短集合被长集合覆盖的比例（对"条目 vs 标题"场景更稳） */
function sim(a: string, b: string): number {
  const A = normTokens(a)
  const B = normTokens(b)
  if (!A.size || !B.size) return 0
  const [small, large] = A.size <= B.size ? [A, B] : [B, A]
  let hit = 0
  small.forEach((t) => {
    if (large.has(t)) hit++
  })
  return hit / small.size
}

// ---------------- 数据库查询 ----------------

interface DBHit {
  title: string
  doi?: string
  year?: string
  container?: string
  score: number
  source: 'crossref' | 'openalex'
}

async function fetchJson(url: string, timeoutMs = 12000): Promise<any> {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), timeoutMs)
  try {
    const resp = await fetch(url, { signal: ctrl.signal, headers: { Accept: 'application/json' } })
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
    return await resp.json()
  } finally {
    clearTimeout(timer)
  }
}

async function crossrefQuery(ref: string): Promise<DBHit[]> {
  const data = await fetchJson(
    `${CROSSREF_API}?query.bibliographic=${encodeURIComponent(ref.slice(0, 400))}&rows=4&select=DOI,title,author,issued,container-title&mailto=${MAILTO}`
  )
  const items: any[] = data?.message?.items || []
  return items
    .map((it) => {
      const title: string = (it.title && it.title[0]) || ''
      const year: string | undefined = it.issued?.['date-parts']?.[0]?.[0]?.toString()
      return {
        title,
        doi: it.DOI,
        year,
        container: (it['container-title'] && it['container-title'][0]) || undefined,
        score: title ? sim(title, ref) : 0,
        source: 'crossref' as const,
      }
    })
    .filter((h) => h.title)
}

async function openalexQuery(ref: string): Promise<DBHit[]> {
  const data = await fetchJson(
    `${OPENALEX_API}?search=${encodeURIComponent(ref.slice(0, 400))}&per-page=4&select=id,display_name,publication_year,doi,primary_location&mailto=${MAILTO}`
  )
  const results: any[] = data?.results || []
  return results
    .map((it) => ({
      title: (it.display_name as string) || '',
      doi: (it.doi as string)?.replace(/^https?:\/\/doi\.org\//, ''),
      year: it.publication_year?.toString(),
      container: it.primary_location?.source?.display_name || undefined,
      score: it.display_name ? sim(it.display_name, ref) : 0,
      source: 'openalex' as const,
    }))
    .filter((h) => h.title)
}

const VERIFY_THRESHOLD = 0.55

export async function verifyReference(ref: string): Promise<RefCheck> {
  const base: RefCheck = { index: 0, ref, status: 'not_found' }
  try {
    // 先 CrossRef，未达阈值再用 OpenAlex 兜底
    try {
      const hits = await crossrefQuery(ref)
      const best = hits.sort((a, b) => b.score - a.score)[0]
      if (best && best.score >= VERIFY_THRESHOLD) {
        return { ...base, status: 'verified', ...best }
      }
    } catch {
      /* 走兜底 */
    }
    try {
      const hits = await openalexQuery(ref)
      const best = hits.sort((a, b) => b.score - a.score)[0]
      if (best && best.score >= VERIFY_THRESHOLD) {
        return { ...base, status: 'verified', ...best }
      }
    } catch {
      /* 网络不通 */
    }
    return base
  } catch {
    return { ...base, status: 'error' }
  }
}

/** 批量校验：顺序执行 + 间隔，避免触发数据库限流 */
export async function verifyReferences(
  refs: string[],
  onEach?: (done: number, total: number, partial: RefCheck[]) => void
): Promise<RefCheck[]> {
  const out: RefCheck[] = []
  for (let i = 0; i < refs.length; i++) {
    const r = await verifyReference(refs[i])
    out.push({ ...r, index: i })
    onEach?.(i + 1, refs.length, [...out])
    if (i < refs.length - 1) await new Promise((res) => setTimeout(res, 250))
  }
  return out
}

export function refCheckSummary(checks: RefCheck[]): { verified: number; missing: number; error: number } {
  return {
    verified: checks.filter((c) => c.status === 'verified').length,
    missing: checks.filter((c) => c.status === 'not_found').length,
    error: checks.filter((c) => c.status === 'error').length,
  }
}
