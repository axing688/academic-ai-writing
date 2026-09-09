// 导师风格画像服务 —— 基于 stylometric-transfer 的显式风格指纹思路
// 设计取舍：本地纯统计提取（零 API 依赖，样本不出本机），产出**显式可编辑的
// JSON 风格指纹**而非黑盒 embedding；指纹分六段：Measurements（统计测量）→
// Targets（目标区间）→ Lexicon（措辞偏好）→ Templates（句式模板）→ 注入块 →
// Validators（一致性评分 + 偏差报告）。
// 借鉴 perfectly-replicate-writing-skills 的"反复出现 ≥3 次才算真特征"原则，
// 过滤个例噪声。

export interface StyleProfile {
  id: string
  name: string // 画像名称，如"导师 A"
  createdAt: number
  updatedAt: number
  sampleCount: number
  sampleChars: number
  // ---- Measurements：统计测量 ----
  avgSentenceLen: number // 平均句长（字）
  p50SentenceLen: number // 句长中位数
  longSentenceRatio: number // 长句（>60字）占比 0-1
  shortSentenceRatio: number // 短句（<15字）占比 0-1
  avgParagraphLen: number // 平均段长（字）
  connectiveRate: number // 连接词密度（每千字）
  hedgeRate: number // 缓冲语密度（每千字）
  firstPersonPlural: boolean // 是否常用"我们/笔者"（true=接受主观人称）
  // ---- Lexicon：措辞 ----
  topBigrams: Array<{ text: string; count: number }> // 高频学术措辞（二元组）
  connectives: Array<{ text: string; count: number }> // 高频连接词
  // ---- Templates：句式模板 ----
  patterns: Array<{ text: string; count: number }>
  openers: string[] // 常用句首
  // ---- Targets：目标区间（派生） ----
  targetSentenceLen: [number, number]
  targetParagraphLen: [number, number]
}

const PROFILE_KEY = 'awa_style_profiles'
const CURRENT_KEY = 'awa_style_current'

export function loadProfiles(): StyleProfile[] {
  try {
    return JSON.parse(localStorage.getItem(PROFILE_KEY) || '[]')
  } catch {
    return []
  }
}

export function saveProfiles(list: StyleProfile[]) {
  localStorage.setItem(PROFILE_KEY, JSON.stringify(list))
}

export function getCurrentProfileId(): string {
  return localStorage.getItem(CURRENT_KEY) || ''
}

export function setCurrentProfileId(id: string) {
  localStorage.setItem(CURRENT_KEY, id)
}

export function getCurrentProfile(): StyleProfile | null {
  const id = getCurrentProfileId()
  if (!id) return null
  return loadProfiles().find((p) => p.id === id) || null
}

// ---------------- 文本基础切分 ----------------

function splitParagraphs(text: string): string[] {
  return text
    .split(/\n+/)
    .map((s) => s.trim())
    .filter((s) => countCjk(s) > 10)
}

function splitSentences(text: string): string[] {
  return text
    .replace(/\n+/g, ' ')
    .split(/(?<=[。！？!?])/)
    .map((s) => s.trim())
    .filter((s) => countCjk(s) >= 4)
}

function countCjk(s: string): number {
  return (s.match(/[\u4e00-\u9fff]/g) || []).length
}

function countAll(s: string): number {
  return countCjk(s) + (s.match(/[a-zA-Z]+/g) || []).length
}

function median(arr: number[]): number {
  if (!arr.length) return 0
  const sorted = [...arr].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[mid] : Math.round((sorted[mid - 1] + sorted[mid]) / 2)
}

// ---------------- 特征词典 ----------------

const CONNECTIVES = [
  '然而', '但是', '因此', '所以', '此外', '同时', '进一步', '基于此', '鉴于此',
  '由此可见', '可见', '总之', '首先', '其次', '再次', '最后', '一方面', '另一方面',
  '与此同时', '值得注意的是', '需要指出的是', '研究发现', '结果表明', '换言之',
  '具体而言', '在此基础上', '从…来看', '与之相比', '进而', '从而', '即', '亦',
]

const HEDGES = ['可能', '或许', '一定程度上', '相对', '较为', '大致', '往往', '通常', '总体上', '在一定程度上']

const PATTERN_RULES: Array<[RegExp, string]> = [
  [/研究表明|结果显示|数据表明|实证结果揭示/, '「研究表明，……」结论句式'],
  [/从[^，。]{2,8}(视角|角度|层面)(看|来看|而言|出发)/, '「从 X 视角来看」视角引入句式'],
  [/在[^，。]{2,10}(方面|层面|过程中)/, '「在 X 方面」限定句式'],
  [/为[^，。]{2,12}提供了/, '「为 X 提供了 Y」贡献句式'],
  [/不仅[^，。]{2,10}(而且|还|也)/, '「不仅 X 而且 Y」递进句式'],
  [/既有[^，。]{2,10}又有|既[^，。]{2,8}又/, '「既 X 又 Y」并列句式'],
  [/若[^，。]{2,10}(则|那么)|如果[^，。]{2,10}(则|那么)/, '「若 X 则 Y」条件推理句式'],
  [/值得注意的是|需要指出的是|值得关注的是|尤需注意的是/, '「值得注意的是」强调插入语'],
  [/鉴于|考虑到/, '「鉴于 X」原因引入句式'],
  [/有助于|有利于|旨在/, '「有助于 X」功能句式'],
]

// ---------------- 指纹提取 ----------------

export function extractProfile(name: string, samples: string[]): StyleProfile {
  const joined = samples.filter((s) => s.trim()).join('\n')
  const paras = splitParagraphs(joined)
  const sents = splitSentences(joined)
  const totalChars = countAll(joined)
  const lens = sents.map(countCjk)
  const avgSentenceLen = lens.length ? Math.round(lens.reduce((a, b) => a + b, 0) / lens.length) : 0

  // 连接词 / 缓冲语频次
  const connectiveCount = new Map<string, number>()
  for (const c of CONNECTIVES) {
    const n = countOccurrences(joined, c)
    if (n >= 3) connectiveCount.set(c, n)
  }
  const hedgeTotal = HEDGES.reduce((acc, h) => acc + countOccurrences(joined, h), 0)

  // 高频二元组（≥3 次原则，过滤虚词组合）
  const bigrams = new Map<string, number>()
  const cjkText = joined.replace(/[^\u4e00-\u9fff]+/g, '')
  for (let i = 0; i < cjkText.length - 1; i++) {
    const bg = cjkText.slice(i, i + 2)
    bigrams.set(bg, (bigrams.get(bg) || 0) + 1)
  }
  const STOP_BIGRAM = /[的是了在和与或及地对被把将从也为有着]/u
  const topBigrams = [...bigrams.entries()]
    .filter(([t, n]) => n >= 3 && !STOP_BIGRAM.test(t))
    .sort((a, b) => b[1] - a[1])
    .slice(0, 14)
    .map(([text, count]) => ({ text, count }))

  // 句式模板（≥3 次原则放宽到 ≥2，句式天然低频）
  const patterns = PATTERN_RULES.map(([re, label]) => {
    const m = joined.match(new RegExp(re.source, 'g'))
    return { text: label, count: m ? m.length : 0 }
  })
    .filter((p) => p.count >= 2)
    .sort((a, b) => b.count - a.count)

  // 句首（≥3 次）
  const openersMap = new Map<string, number>()
  for (const s of sents) {
    const head = s.slice(0, Math.min(8, s.length)).replace(/[，、；]/g, '')
    if (head.length >= 3) openersMap.set(head, (openersMap.get(head) || 0) + 1)
  }
  const openers = [...openersMap.entries()]
    .filter(([, n]) => n >= 3)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([t]) => t)

  const connectiveRate = totalChars ? (hedgeTotal + [...connectiveCount.values()].reduce((a, b) => a + b, 0)) / totalChars * 1000 : 0
  const weCount = countOccurrences(joined, '我们') + countOccurrences(joined, '笔者认为') + countOccurrences(joined, '我们认为')
  const thisPaper = countOccurrences(joined, '本文') + countOccurrences(joined, '本研究')

  const profile: StyleProfile = {
    id: `sty_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    name: name.trim() || '未命名画像',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    sampleCount: samples.filter((s) => s.trim()).length,
    sampleChars: totalChars,
    avgSentenceLen,
    p50SentenceLen: median(lens),
    longSentenceRatio: lens.length ? lens.filter((l) => l > 60).length / lens.length : 0,
    shortSentenceRatio: lens.length ? lens.filter((l) => l < 15).length / lens.length : 0,
    avgParagraphLen: paras.length ? Math.round(paras.map(countAll).reduce((a, b) => a + b, 0) / paras.length) : 0,
    connectiveRate: Math.round(connectiveRate * 10) / 10,
    hedgeRate: totalChars ? Math.round(((hedgeTotal / totalChars) * 1000) * 10) / 10 : 0,
    firstPersonPlural: weCount > thisPaper,
    topBigrams,
    connectives: [...connectiveCount.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([text, count]) => ({ text, count })),
    patterns,
    openers,
    targetSentenceLen: [Math.max(12, Math.round(avgSentenceLen * 0.7)), Math.round(avgSentenceLen * 1.4) + 2],
    targetParagraphLen: [
      Math.max(80, Math.round((paras.length ? avgParagraphLen(countParaFallback(paras)) : 0) * 0.6)),
      Math.round((paras.length ? avgParagraphLen(countParaFallback(paras)) : 0) * 1.5) + 20,
    ],
  }
  return profile
}

function countParaFallback(paras: string[]): number[] {
  return paras.map(countAll)
}

function avgParagraphLen(lens: number[]): number {
  return lens.length ? Math.round(lens.reduce((a, b) => a + b, 0) / lens.length) : 250
}

function countOccurrences(haystack: string, needle: string): number {
  if (!needle) return 0
  let n = 0
  let pos = 0
  while ((pos = haystack.indexOf(needle, pos)) !== -1) {
    n++
    pos += needle.length
  }
  return n
}

// ---------------- 注入块（风格要求 → 生成上下文） ----------------

export function profileToPrompt(p: StyleProfile): string {
  const lines: string[] = []
  lines.push('【风格要求：请严格模仿以下写作风格特征（来自目标作者的写作样本统计）】')
  lines.push(`1. 句长控制：平均每句约 ${p.avgSentenceLen} 字（目标区间 ${p.targetSentenceLen[0]}-${p.targetSentenceLen[1]} 字），长句（60 字以上）占比控制在 ${Math.round(p.longSentenceRatio * 100)}% 左右`)
  if (p.avgParagraphLen) lines.push(`2. 段落规模：平均每段约 ${p.avgParagraphLen} 字`)
  if (p.connectives.length) {
    lines.push(`3. 逻辑连接习惯：适度使用这些连接表达——${p.connectives.map((c) => `「${c.text}」`).join('、')}`)
  }
  if (p.patterns.length) {
    lines.push(`4. 常用句式：${p.patterns.map((x) => x.text).join('；')}（自然穿插，不要堆砌）`)
  }
  if (p.topBigrams.length) {
    lines.push(`5. 措辞偏好：倾向使用以下词汇组合——${p.topBigrams.slice(0, 8).map((b) => b.text).join('、')}`)
  }
  if (p.firstPersonPlural) {
    lines.push('6. 人称习惯：可使用"我们/笔者"等主观人称')
  } else {
    lines.push('6. 人称习惯：避免"我们/笔者认为"等主观人称，使用"本文/本研究"')
  }
  if (p.openers.length) {
    lines.push(`7. 常见句首：${p.openers.map((o) => `「${o}…」`).join('、')}`)
  }
  lines.push('请在保证学术严谨与原意的前提下，将上述风格特征融入输出。')
  return lines.join('\n')
}

// ---------------- Validators：一致性评分 + 偏差报告 ----------------

export interface StyleDeviation {
  excerpt: string
  reason: string
  severity: 'high' | 'mid' | 'low'
}

export interface StyleScore {
  score: number // 0-100
  deviations: StyleDeviation[]
  stats: {
    avgSentenceLen: number
    longSentenceRatio: number
    connectiveRate: number
    firstPerson: boolean
  }
}

export function scoreAgainstProfile(text: string, p: StyleProfile): StyleScore {
  const sents = splitSentences(text)
  const totalChars = countAll(text)
  const lens = sents.map(countCjk)
  const avgSentenceLen = lens.length ? Math.round(lens.reduce((a, b) => a + b, 0) / lens.length) : 0
  const longRatio = lens.length ? lens.filter((l) => l > 60).length / lens.length : 0
  const connTotal = [...p.connectives.map((c) => c.text), ...CONNECTIVES].reduce(
    (acc, c) => acc + countOccurrences(text, c),
    0
  )
  const connRate = totalChars ? Math.round(((connTotal / totalChars) * 1000) * 10) / 10 : 0
  const hasFirstPerson = /我们|笔者认为|我们认为/.test(text)
  const deviations: StyleDeviation[] = []

  // 1. 句长偏差
  const [lo, hi] = p.targetSentenceLen
  if (avgSentenceLen < lo * 0.7) {
    deviations.push({
      excerpt: `全文平均句长 ${avgSentenceLen} 字`,
      reason: `明显短于画像目标区间（${lo}-${hi} 字），句子偏碎，可适当合并增强逻辑密度`,
      severity: 'mid',
    })
  } else if (avgSentenceLen > hi * 1.25) {
    deviations.push({
      excerpt: `全文平均句长 ${avgSentenceLen} 字`,
      reason: `明显长于画像目标区间（${lo}-${hi} 字），存在冗长句，建议拆分`,
      severity: 'mid',
    })
  }

  // 2. 超长句逐条标记（"AI 味"最重的部分通常是 60+ 字的复合长句）
  const longSents = sents
    .map((s) => ({ s, len: countCjk(s) }))
    .filter((x) => x.len > Math.max(hi * 1.8, 62))
    .sort((a, b) => b.len - a.len)
    .slice(0, 3)
  for (const x of longSents) {
    deviations.push({
      excerpt: x.s.slice(0, 30) + '…',
      reason: `超长句（${x.len} 字），超出画像句长习惯，建议拆分`,
      severity: 'high',
    })
  }

  // 3. 人称
  if (!p.firstPersonPlural && hasFirstPerson) {
    deviations.push({
      excerpt: '出现"我们/笔者认为"等表述',
      reason: '画像作者不使用主观人称，建议改为"本文/本研究"',
      severity: 'high',
    })
  }

  // 4. 连接词密度
  if (sents.length >= 6 && connRate < p.connectiveRate * 0.4) {
    deviations.push({
      excerpt: `连接词密度 ${connRate}/千字`,
      reason: `低于画像水平（${p.connectiveRate}/千字），逻辑衔接不足，建议补充"然而/因此/具体而言"类衔接`,
      severity: 'mid',
    })
  }

  // 5. 常用句式缺失（软提醒）
  if (p.patterns.length >= 2 && !p.patterns.some((pat) => text.includes(pat.text.slice(1, 5)))) {
    deviations.push({
      excerpt: '未检测到画像中的典型句式',
      reason: `可自然融入如：${p.patterns.slice(0, 2).map((x) => x.text).join('、')}`,
      severity: 'low',
    })
  }

  // 评分：100 起扣
  let score = 100
  for (const d of deviations) {
    score -= d.severity === 'high' ? 12 : d.severity === 'mid' ? 7 : 3
  }
  score = Math.max(40, Math.min(100, score))

  return {
    score,
    deviations: deviations.slice(0, 6),
    stats: { avgSentenceLen, longSentenceRatio: Math.round(longRatio * 100) / 100, connectiveRate: connRate, firstPerson: hasFirstPerson },
  }
}
