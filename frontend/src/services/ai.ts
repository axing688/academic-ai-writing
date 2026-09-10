// AI 写作服务层 —— 多服务商版
// 支持国内外主流大模型 API Key 直连，全部经本地代理转发避免浏览器跨域：
//  · OpenAI 兼容协议：通义千问 / DeepSeek / 智谱 GLM / Kimi / 豆包 / 千帆 / 硅基流动 / 星火 / OpenAI
//  · Anthropic 协议：Claude
//  · Google 协议：Gemini
//  · 自定义 OpenAI 兼容端点
// 未配置任何 Key 时自动回落到本地演示引擎。

export type AITask =
  | 'outline'
  | 'polish'
  | 'expand'
  | 'rewrite'
  | 'grammar'
  | 'topics'
  | 'abstract'
  | 'gap'
  | 'defense'
  | 'nature-polish'
  | 'nature-review'

export type ProviderKind = 'openai' | 'claude' | 'gemini'

export interface ProviderPreset {
  id: string
  name: string
  region: '国内' | '国外'
  kind: ProviderKind
  proxyPath: string // 本地代理前缀，如 /llm/dashscope
  baseUrl: string // 真实 API Base URL
  models: string[]
  keyUrl?: string // 申请 API Key 的控制台地址
  keyPrefix?: string // Key 的常见前缀提示
  note?: string
  noKey?: boolean // 本地推理服务无需 API Key
  local?: boolean // 本机运行的推理服务（归入"本地 / 自定义端点"分组）
}

export const PROVIDERS: ProviderPreset[] = [
  {
    id: 'demo',
    name: '本地演示模式',
    region: '国内',
    kind: 'openai',
    proxyPath: '',
    baseUrl: '',
    models: [],
    note: '无需 API Key，基于规则模板生成示例内容，可体验完整流程',
  },
  // ---------- 国内 ----------
  {
    id: 'dashscope',
    name: '通义千问 Qwen（阿里云百炼）',
    region: '国内',
    kind: 'openai',
    proxyPath: '/llm/dashscope',
    baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    models: ['qwen-plus', 'qwen-turbo', 'qwen-max', 'qwen-long'],
    keyUrl: 'https://bailian.console.aliyun.com',
    keyPrefix: 'sk-',
  },
  {
    id: 'deepseek',
    name: 'DeepSeek 深度求索',
    region: '国内',
    kind: 'openai',
    proxyPath: '/llm/deepseek',
    baseUrl: 'https://api.deepseek.com/v1',
    models: ['deepseek-chat', 'deepseek-reasoner'],
    keyUrl: 'https://platform.deepseek.com',
    keyPrefix: 'sk-',
  },
  {
    id: 'zhipu',
    name: '智谱 GLM（BigModel）',
    region: '国内',
    kind: 'openai',
    proxyPath: '/llm/zhipu',
    baseUrl: 'https://open.bigmodel.cn/api/paas/v4',
    models: ['glm-4-plus', 'glm-4-air', 'glm-4-flash', 'glm-4.5', 'glm-4.5-air'],
    keyUrl: 'https://open.bigmodel.cn',
    keyPrefix: 'sk-... 或 id.secret',
  },
  {
    id: 'moonshot',
    name: 'Kimi（月之暗面 Moonshot）',
    region: '国内',
    kind: 'openai',
    proxyPath: '/llm/moonshot',
    baseUrl: 'https://api.moonshot.cn/v1',
    models: ['moonshot-v1-8k', 'moonshot-v1-32k', 'moonshot-v1-128k', 'kimi-k2-0711-preview'],
    keyUrl: 'https://platform.moonshot.cn',
    keyPrefix: 'sk-',
  },
  {
    id: 'doubao',
    name: '豆包（火山方舟）',
    region: '国内',
    kind: 'openai',
    proxyPath: '/llm/doubao',
    baseUrl: 'https://ark.cn-beijing.volces.com/api/v3',
    models: ['doubao-pro-32k', 'doubao-pro-128k', 'doubao-1.5-pro-32k'],
    keyUrl: 'https://console.volcengine.com/ark',
    keyPrefix: 'sk-...',
    note: '方舟的"模型"请填接入点 ID（ep-xxx）或开启的模型 ID',
  },
  {
    id: 'qianfan',
    name: '文心 ERNIE（百度千帆 V2）',
    region: '国内',
    kind: 'openai',
    proxyPath: '/llm/qianfan',
    baseUrl: 'https://qianfan.baidubce.com/v2',
    models: ['ernie-4.0-8k-latest', 'ernie-3.5-8k', 'ernie-speed-128k'],
    keyUrl: 'https://console.bce.baidu.com/iam',
    keyPrefix: 'bearer token',
  },
  {
    id: 'siliconflow',
    name: '硅基流动 SiliconFlow（模型聚合）',
    region: '国内',
    kind: 'openai',
    proxyPath: '/llm/siliconflow',
    baseUrl: 'https://api.siliconflow.cn/v1',
    models: [
      'deepseek-ai/DeepSeek-V3',
      'Qwen/Qwen2.5-72B-Instruct',
      'THUDM/glm-4-9b-chat',
      'meta-llama/Meta-Llama-3.1-405B-Instruct',
    ],
    keyUrl: 'https://cloud.siliconflow.cn',
    keyPrefix: 'sk-',
    note: '一个 Key 可调用平台上的多家开源模型',
  },
  {
    id: 'spark',
    name: '讯飞星火 Spark',
    region: '国内',
    kind: 'openai',
    proxyPath: '/llm/spark',
    baseUrl: 'https://spark-api-open.xf-yun.com/v1',
    models: ['4.0Ultra', 'generalv3.5', 'lite'],
    keyUrl: 'https://console.xfyun.cn',
    keyPrefix: 'key:secret 格式',
  },
  // ---------- 国外 ----------
  {
    id: 'openai',
    name: 'OpenAI GPT',
    region: '国外',
    kind: 'openai',
    proxyPath: '/llm/openai',
    baseUrl: 'https://api.openai.com/v1',
    models: ['gpt-4o', 'gpt-4o-mini', 'gpt-4.1', 'o4-mini'],
    keyUrl: 'https://platform.openai.com/api-keys',
    keyPrefix: 'sk-',
    note: '国内直连可能需要网络代理环境',
  },
  {
    id: 'claude',
    name: 'Anthropic Claude',
    region: '国外',
    kind: 'claude',
    proxyPath: '/llm/claude',
    baseUrl: 'https://api.anthropic.com',
    models: ['claude-sonnet-4-20250514', 'claude-3-7-sonnet-latest', 'claude-3-5-haiku-latest'],
    keyUrl: 'https://console.anthropic.com',
    keyPrefix: 'sk-ant-',
  },
  {
    id: 'gemini',
    name: 'Google Gemini',
    region: '国外',
    kind: 'gemini',
    proxyPath: '/llm/gemini',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
    models: ['gemini-2.5-flash', 'gemini-2.5-pro', 'gemini-2.0-flash'],
    keyUrl: 'https://aistudio.google.com/apikey',
  },
  {
    id: 'custom',
    name: '自定义 OpenAI 兼容端点',
    region: '国内',
    kind: 'openai',
    proxyPath: '/llm/custom',
    baseUrl: '',
    models: [],
    note: '填写任意 OpenAI 兼容服务的 Base URL（如 one-api、vLLM、llama.cpp server 等）',
  },
  // ---------- 本地推理（离线，无需 API Key）----------
  {
    id: 'ollama',
    name: '本地模型（Ollama）',
    region: '国内',
    kind: 'openai',
    proxyPath: '/llm/ollama',
    baseUrl: 'http://localhost:11434/v1',
    models: ['qwen2.5:7b', 'qwen3:8b', 'deepseek-r1:7b', 'glm4:9b', 'llama3.1:8b'],
    noKey: true,
    local: true,
    note: '本机安装 Ollama 后执行：ollama serve 启动服务，ollama pull qwen2.5:7b 下载模型。模型名需与 ollama list 中一致。完全离线，数据不出本机',
  },
  {
    id: 'lmstudio',
    name: '本地模型（LM Studio）',
    region: '国内',
    kind: 'openai',
    proxyPath: '/llm/lmstudio',
    baseUrl: 'http://localhost:1234/v1',
    models: ['qwen2.5-7b-instruct', 'deepseek-r1-distill-qwen-7b'],
    noKey: true,
    local: true,
    note: '本机安装 LM Studio → 下载模型 → Developer 标签页启动 Local Server（默认端口 1234）。图形界面选模型，适合不想用命令行的场景',
  },
]

export function getProvider(id: string): ProviderPreset | undefined {
  return PROVIDERS.find((p) => p.id === id)
}

export interface AISettings {
  providerId: string // 'demo' | PROVIDERS 中的 id
  apiKey: string
  model: string
  customBaseUrl?: string // providerId === 'custom' 时使用
}

const SETTINGS_KEY = 'awa_ai_settings'

export function loadAISettings(): AISettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      // 兼容旧版 {mode: 'demo'|'dashscope'} 结构
      if (parsed.mode && !parsed.providerId) {
        return {
          providerId: parsed.mode === 'dashscope' ? 'dashscope' : 'demo',
          apiKey: parsed.apiKey || '',
          model: parsed.model || 'qwen-plus',
        }
      }
      return { providerId: 'demo', apiKey: '', model: '', ...parsed }
    }
  } catch {
    /* ignore */
  }
  return { providerId: 'demo', apiKey: '', model: '' }
}

export function saveAISettings(s: AISettings) {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(s))
}

export function isAIConfigured(s: AISettings): boolean {
  if (s.providerId === 'demo') return false
  if (providerBaseUrl(s) === '' && !(s.providerId === 'custom' && s.customBaseUrl)) return false
  // 本地推理服务（Ollama / LM Studio）无需 API Key
  if (getProvider(s.providerId)?.noKey) return true
  return !!s.apiKey
}

export function providerBaseUrl(s: AISettings): string {
  if (s.providerId === 'custom') return (s.customBaseUrl || '').replace(/\/+$/, '')
  return getProvider(s.providerId)?.baseUrl || ''
}

export function aiStatusText(s: AISettings): { label: string; ok: boolean } {
  if (s.providerId === 'demo') return { label: '演示模式', ok: false }
  const p = getProvider(s.providerId)
  if (!p) return { label: '未知服务商', ok: false }
  if (!s.apiKey && !p.noKey) return { label: `${p.name}（未填 Key）`, ok: false }
  if (p.noKey && !s.model) return { label: `${p.name}（未选模型）`, ok: false }
  return { label: `${p.name} · ${s.model}`, ok: true }
}

const TASK_LABEL: Record<AITask, string> = {
  outline: '论文大纲生成',
  polish: '学术润色',
  expand: '内容扩写',
  rewrite: '降重改写',
  grammar: '语法检查',
  topics: '选题建议',
  abstract: '摘要生成',
  gap: '研究空白发现',
  defense: '预答辩演练',
  'nature-polish': 'Nature 风格英文润色',
  'nature-review': '期刊预审（模拟审稿）',
}

export function taskLabel(t: AITask): string {
  return TASK_LABEL[t]
}

const SYSTEM_PROMPTS: Record<AITask, string> = {
  outline:
    '你是研究生论文写作导师。请根据给定主题生成一份完整的学术论文大纲，包含：摘要、第一章 绪论（研究背景与意义、国内外研究现状、研究内容与方法、论文结构安排）、中间核心章节（3-4章，含小节）、结论与展望、参考文献建议。用中文输出，层级清晰。',
  polish:
    '你是中文学术写作润色专家。请将输入内容改写为规范、严谨、客观的学术语言：消除口语化表达、加强逻辑连接词、使用被动/客观句式，保持原意不变。直接输出润色后的文本。',
  expand:
    '你是学术写作助手。请将输入内容扩写得更充实：补充论证逻辑、举例说明、增加学术性过渡句，扩写到接近目标字数。直接输出扩写后的文本。',
  rewrite:
    '你是论文降重改写专家。请在不改变原意的前提下改写输入内容：调整语序与句式结构、替换同义学术表达、主动被动互换，保持学术规范。直接输出改写后的文本。',
  grammar:
    '你是中文学术论文校对专家。请检查输入文本中的语法、标点、搭配和学术规范问题，逐条列出：位置（引用原句片段）、问题类型、修改建议。最后给出总体评价。',
  topics:
    '你是研究生导师。请根据用户的学科方向和兴趣关键词，推荐 5 个可行的研究生学位论文选题。每个选题包含：题目、研究价值、可行性简析、可能的创新点。',
  abstract:
    '你是学术摘要写作专家。请根据输入的论文内容，按照"研究背景—研究方法—主要结果—结论与意义"四段式结构生成 300 字左右的中文学术摘要，并附 4-6 个关键词。',
  gap:
    '你是文献综述与研究设计专家。请基于给定的研究主题（以及提供的文献片段，如有），完成：1）用 3-5 句概括该方向现有研究的主要进展；2）识别 3-5 个尚未解决或研究不充分的研究空白（Research Gap），每条包含【空白描述】【现有研究为何未解决】【可能的突破方向】【与该主题的契合度：高/中/低】；3）最后给出"建议的研究切入点"一段。严禁编造具体文献，涉及文献时只使用提供的片段中真实存在的内容。',
  defense:
    '你是研究生学位论文答辩委员会评审专家。请针对给定的论文内容或章节，模拟答辩提问：1）提出 6-8 个评审最可能问到的问题，按【选题与价值】【研究方法】【数据与实证】【创新点与不足】四类组织；2）每个问题附 1-2 句回答要点提示，并标注风险等级（高风险/中风险/低风险）；3）最后给出答辩自述的 3 条注意事项。语气专业、问题尖锐但具有建设性。',
  // ---- 以下两个任务的系统提示词改写自开源技能包 nature-skills（github.com/Yuan1z0825/nature-skills）----
  // 的核心规范（nature-polishing / nature-reviewer），按本应用的交互形态精简
  'nature-polish':
    '你是 Nature 期刊资深编辑与学术英语润色专家。请将输入文本改写为符合 Nature 及其子刊表达习惯的英文，规则如下：\n' +
    '1. 简洁有力：主动语态优先，删除空洞修饰词与冗余形容词，一句话只传递一个核心信息；\n' +
    '2. 精确性：使用领域内标准术语；所有数值、单位、统计量必须原样保留，不得改写或省略；\n' +
    '3. 证据强度：恰当使用 hedging（may、likely、suggest、appear to），严格区分"已证明"与"提示"两类陈述；\n' +
    '4. 时态规范：方法与结果用过去时，普遍性结论与文献事实用现在时；\n' +
    '5. 段落结构：一段只陈述一个论点，句间逻辑关系用衔接词显式化。\n' +
    '若原文为中文则译写为英文；若已是英文则直接润色。\n' +
    '输出格式：先输出改写后的英文全文，然后另起【主要修改说明】小节，用中文列出不超过 8 条主要修改点及理由。',
  'nature-review':
    '你是 Nature / CNS 级别期刊的互盲评审专家。请对给定的论文文本撰写一份正式评审报告（Reviewer Report），结构如下：\n' +
    '1. Summary：3-5 句客观概括研究问题、方法与核心贡献，不带褒贬；\n' +
    '2. Major Concerns：3-5 条重大问题，每条必须引用原文具体句子或段落作为定位，说明为何构成问题，并给出可操作的修改建议；\n' +
    '3. Minor Issues：以列表指出排版、图表规范、术语一致性、参考文献格式等次要问题；\n' +
    '4. Statistical & Methodological Rigor：评估方法与统计描述的严谨性（样本量依据、检验方法、效应量报告、混杂控制等，如适用）；\n' +
    '5. Recommendation：给出 Accept / Minor Revision / Major Revision / Reject 之一，并用 1-2 句说明理由。\n' +
    '要求：批评必须具体、可操作、对事不对人；文本中未提供的信息一律以"未见相关描述"指出，严禁虚构原文内容。',
}

// ---------------- 对外主入口 ----------------

export async function aiGenerate(
  task: AITask,
  input: string,
  settings: AISettings,
  opts?: { targetWords?: number; context?: string; citations?: string[]; style?: string }
): Promise<string> {
  if (!isAIConfigured(settings)) {
    return demoGenerate(task, input, opts?.targetWords, opts?.citations)
  }
  let userContent = input
  if (task === 'expand' && opts?.targetWords) {
    userContent = `请扩写到约 ${opts.targetWords} 字：\n\n${input}`
  }
  // 导师风格注入：风格规则卡置于最前
  if (opts?.style) {
    userContent = `${opts.style}\n\n===\n\n${userContent}`
  }
  // RAG：注入个人文献库检索片段（引用约束已写入上下文说明）
  if (opts?.context) {
    userContent = `${opts.context}\n\n===\n\n【写作任务】\n${userContent}`
  }
  const p = getProvider(settings.providerId)!
  const base = providerBaseUrl(settings)
  const model = settings.model || p.models[0] || ''
  if (p.kind === 'claude') return callClaude(p, settings.apiKey, model, SYSTEM_PROMPTS[task], userContent)
  if (p.kind === 'gemini') return callGemini(p, settings.apiKey, model, SYSTEM_PROMPTS[task], userContent)
  return callOpenAICompatible(p, base, settings.apiKey, model, SYSTEM_PROMPTS[task], userContent)
}

// 测试连通性：发送一条极短请求
export async function testConnection(settings: AISettings): Promise<string> {
  const p = getProvider(settings.providerId)
  if (!p) throw new Error('未知服务商')
  if (!settings.apiKey && !p.noKey) throw new Error('请先填写 API Key')
  const base = providerBaseUrl(settings)
  if (!base && settings.providerId === 'custom') throw new Error('请先填写 Base URL')
  const model = settings.model || p.models[0] || 'gpt-4o-mini'
  const prompt = '请只回复两个字：正常'
  const fn =
    p.kind === 'claude'
      ? callClaude(p, settings.apiKey, model, '你是连通性测试助手。', prompt)
      : p.kind === 'gemini'
        ? callGemini(p, settings.apiKey, model, '你是连通性测试助手。', prompt)
        : callOpenAICompatible(p, base, settings.apiKey, model, '你是连通性测试助手。', prompt)
  const reply = await fn
  return `连接成功（${p.name} · ${model}）：${reply.slice(0, 30)}`
}

// ---------------- OpenAI 兼容协议 ----------------

async function callOpenAICompatible(
  p: ProviderPreset,
  base: string,
  apiKey: string,
  model: string,
  system: string,
  user: string
): Promise<string> {
  const resp = await fetch(`${p.proxyPath}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      // 本地推理服务（Ollama 等）无需认证头，避免空 Bearer 触发部分服务的 401
      ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
      'X-AWA-Target': base, // 自定义服务商时由代理读取（开发环境在 vite 插件中处理）
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
    }),
  })
  if (!resp.ok) {
    const text = await resp.text()
    throw new Error(`${p.name} 请求失败 (${resp.status}): ${text.slice(0, 200)}`)
  }
  const data = await resp.json()
  const content = data?.choices?.[0]?.message?.content
  if (!content) throw new Error(`${p.name} 返回内容为空`)
  return content as string
}

// ---------------- Anthropic 协议 ----------------

async function callClaude(
  p: ProviderPreset,
  apiKey: string,
  model: string,
  system: string,
  user: string
): Promise<string> {
  const resp = await fetch(`${p.proxyPath}/v1/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model,
      max_tokens: 4096,
      system,
      messages: [{ role: 'user', content: user }],
    }),
  })
  if (!resp.ok) {
    const text = await resp.text()
    throw new Error(`${p.name} 请求失败 (${resp.status}): ${text.slice(0, 200)}`)
  }
  const data = await resp.json()
  const content = data?.content?.[0]?.text
  if (!content) throw new Error(`${p.name} 返回内容为空`)
  return content as string
}

// ---------------- Google Gemini 协议 ----------------

async function callGemini(
  p: ProviderPreset,
  apiKey: string,
  model: string,
  system: string,
  user: string
): Promise<string> {
  const resp = await fetch(`${p.proxyPath}/models/${encodeURIComponent(model)}:generateContent`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': apiKey,
    },
    body: JSON.stringify({
      system_instruction: { parts: [{ text: system }] },
      contents: [{ role: 'user', parts: [{ text: user }] }],
    }),
  })
  if (!resp.ok) {
    const text = await resp.text()
    throw new Error(`${p.name} 请求失败 (${resp.status}): ${text.slice(0, 200)}`)
  }
  const data = await resp.json()
  const content = data?.candidates?.[0]?.content?.parts?.[0]?.text
  if (!content) throw new Error(`${p.name} 返回内容为空`)
  return content as string
}

// ---------------- 本地演示生成引擎 ----------------

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

function demoOutline(topic: string): string {
  const t = topic.trim() || '示例研究主题'
  return `《${t}》论文大纲

摘要
　　概述研究背景、核心问题、研究方法与主要结论（约 300 字），并列出 4-6 个关键词。

第一章 绪论
　1.1 研究背景与意义
　　1.1.1 现实背景：${t}领域当前面临的主要矛盾与需求
　　1.1.2 理论意义与实践价值
　1.2 国内外研究现状
　　1.2.1 国外研究进展综述
　　1.2.2 国内研究进展综述
　　1.2.3 现有研究述评与本研究的切入点
　1.3 研究内容与研究方法
　　1.3.1 主要研究内容
　　1.3.2 研究方法（文献研究法、${pick(['问卷调查法', '案例分析法', '实验研究法', '数值模拟法'])}等）
　1.4 论文结构安排

第二章 相关概念界定与理论基础
　2.1 核心概念界定
　2.2 理论基础（${pick(['系统论', '计划行为理论', '技术接受模型', '博弈论'])}等）

第三章 ${t}的现状分析
　3.1 发展现状描述
　3.2 存在的主要问题
　3.3 问题成因剖析

第四章 ${t}的机制/模型构建
　4.1 分析框架的构建思路
　4.2 变量选取与模型设定
　4.3 数据来源与处理

第五章 实证分析与结果讨论
　5.1 描述性统计
　5.2 假设检验与结果分析
　5.3 稳健性检验
　5.4 结果讨论

第六章 对策建议与研究结论
　6.1 对策建议
　6.2 研究结论
　6.3 研究不足与展望

参考文献
　　按 GB/T 7714—2015 格式列出，建议 40-60 篇，近五年文献占比不低于 50%。`
}

const FORMAL_MAP: Array<[RegExp, string]> = [
  [/很有用|特别有用|非常有用/g, '具有重要的应用价值'],
  [/我觉得|我认为/g, '本文认为'],
  [/很多/g, '大量'],
  [/搞/g, '开展'],
  [/弄清楚/g, '厘清'],
  [/越来越好/g, '持续向好'],
  [/大家都知道|众所周知/g, '已有研究表明'],
  [/为了/g, '旨在'],
  [/所以|因此/g, '由此可见'],
  [/但是|可是/g, '然而'],
  [/非常|十分/g, '显著'],
  [/差不多/g, '大致相当'],
  [/没办法/g, '难以'],
]

function demoPolish(input: string): string {
  let out = input
  for (const [re, rep] of FORMAL_MAP) out = out.replace(re, rep)
  const prefix = '【润色结果】\n\n'
  const body =
    out.trim() ||
    '（请先在左侧编辑器中输入需要润色的内容）\n\n提示：润色将消除口语化表达，使用规范的学术句式与逻辑连接词。'
  return (
    prefix +
    body +
    '\n\n【润色说明】\n1. 已将第一人称主观表述转换为客观陈述；\n2. 已替换口语化词汇为学术表达；\n3. 建议进一步核查专业术语的统一性。'
  )
}

function countWordsLocal(text: string): number {
  const cjk = (text.match(/[\u4e00-\u9fff]/g) || []).length
  const en = (text.replace(/[\u4e00-\u9fff]/g, ' ').match(/[a-zA-Z]+/g) || []).length
  return cjk + en
}

function demoExpand(input: string, target: number): string {
  const base = input.trim()
  if (!base) return '（请先在左侧编辑器中输入需要扩写的内容）'
  const sentences = base
    .split(/(?<=[。！？；])/)
    .map((s) => s.trim())
    .filter(Boolean)
  const expanded = sentences
    .map((s) => {
      const addons = [
        '这一现象的产生，既与宏观环境的变化密切相关，也受到微观主体行为逻辑的深刻影响。',
        '从已有文献来看，学界对该问题的探讨主要集中在理论建构与实证检验两个层面。',
        '需要指出的是，上述分析仍需结合具体情境加以验证，以避免结论的过度外推。',
        '进一步而言，相关变量的选取与度量方式将直接影响研究结果的稳健性。',
      ]
      const idx = sentences.indexOf(s)
      return s + '\n　　' + addons[idx % addons.length]
    })
    .join('\n')
  const words = countWordsLocal(expanded)
  return (
    '【扩写结果】\n\n' +
    expanded +
    `\n\n【说明】当前约 ${words} 字（目标 ${target} 字）。配置任一大模型 API Key 后可获得更自然的扩写效果。`
  )
}

function demoRewrite(input: string): string {
  let out = input
    .replace(/研究表明/g, pick(['实证结果揭示', '分析结果显示', '相关证据表明']))
    .replace(/具有重要意义/g, '具备不可忽视的价值')
    .replace(/随着/g, '伴随')
    .replace(/因此/g, '基于此')
    .replace(/进行了/g, '开展了')
    .replace(/问题/g, '议题')
  if (out === input) out = '【改写结果】\n\n' + input
  else out = '【改写结果】\n\n' + out
  return out + '\n\n【降重说明】已对高频学术套语进行同义替换，并建议在此基础上人工复核逻辑连贯性。'
}

function demoGrammar(input: string): string {
  if (!input.trim()) return '（请先在左侧编辑器中输入需要检查的内容）'
  const issues: string[] = []
  const sents = input.split(/(?<=[。！？!?])/).filter((s) => s.trim())
  sents.forEach((s) => {
    const trimmed = s.trim()
    if (trimmed.length > 70) issues.push(`「${trimmed.slice(0, 18)}…」：句子过长（${trimmed.length} 字），建议拆分为 2-3 个短句以提升可读性。`)
    if (/的的|地地|得得/.test(trimmed)) issues.push(`「${trimmed.slice(0, 18)}…」：疑似"的/地/得"重复使用，请核查。`)
    if (/我觉得|我认为|我们|咱们/.test(trimmed))
      issues.push(`「${trimmed.slice(0, 18)}…」：学术写作中建议避免第一人称主观表述，可改为"本文认为""本研究发现"。`)
  })
  if (sents.length && !/[。！？!?]$/.test(sents[sents.length - 1].trim()))
    issues.push('文末：末句缺少终止标点。')
  if (issues.length === 0)
    return `共检查 ${sents.length} 个句子，未发现明显的语法、标点或学术规范问题。文本整体表达较为规范。`
  return (
    `【语法检查报告】共发现 ${issues.length} 处建议修改项：\n\n` +
    issues.map((x, i) => `${i + 1}. ${x}`).join('\n') +
    '\n\n【总体评价】以上为演示引擎基于规则的检查结果；配置任一大模型 API Key 后可获得更深入的语义级校对。'
  )
}

function demoTopics(input: string): string {
  const field = input.trim() || '人工智能教育应用'
  return `围绕「${field}」方向的 5 个研究生选题建议：

1. ${field}中多源异构数据的融合分析框架研究
　- 研究价值：现有研究多为单源数据，融合分析可提升结论稳健性
　- 可行性：数据获取难度中等，方法体系成熟
　- 创新点：构建跨源数据对齐与质量评估机制

2. 面向${field}的用户行为建模与个性化干预研究
　- 研究价值：支撑精准化服务与政策设计
　- 可行性：可依托真实场景开展准实验
　- 创新点：将序列模型引入行为轨迹预测

3. ${field}的伦理风险识别与治理机制研究
　- 研究价值：回应学界对技术伦理的高度关注
　- 可行性：以案例研究与政策文本分析为主，门槛适中
　- 创新点：提出本土化的风险分级框架

4. 基于${pick(['深度学习', '知识图谱', '大语言模型'])}的${field}智能辅助方法研究
　- 研究价值：技术前沿，应用前景明确
　- 可行性：需一定算力与数据基础，建议依托实验室平台
　- 创新点：领域知识注入与效果可解释性评估

5. ${field}成效的长期追踪与评价指标体系构建
　- 研究价值：弥补现有横断面研究不足
　- 可行性：追踪周期长，建议以硕士阶段完成 2-3 轮测量
　- 创新点：形成可复用的多维度指标工具包

提示：选题时应结合导师课题、个人兴趣与数据可得性综合权衡；确定选题后可使用"大纲生成"功能快速搭建论文框架。`
}

function demoAbstract(input: string): string {
  const body = input.trim()
  if (!body) return '（请先在左侧编辑器中粘贴论文正文或主要章节内容）'
  const sents = body.split(/(?<=[。])/).filter((s) => s.trim())
  const take = (n: number) => sents.slice(0, n).join('')
  const abstract = `本研究针对${pick(['当前实践中的突出问题', '该领域长期存在的核心争议', '现有研究尚不充分的关键环节'])}展开。首先，通过系统梳理国内外相关文献，界定了核心概念并构建了分析框架；其次，采用${pick(['问卷调查与结构方程模型', '多案例比较研究', '混合研究方法'])}对所提假设进行了实证检验；最后，基于分析结果提出了相应的对策建议。研究表明，${take(1) || '相关变量之间存在显著关联'}，且这一关系受情境因素的调节影响。研究结论对丰富相关理论、指导具体实践均具有一定参考价值。`
  return (
    '【摘要】\n\n' +
    abstract +
    '\n\n【关键词】' +
    ['核心概念', '实证分析', '影响机制', '对策建议', pick(['大数据', '深度学习', '知识图谱', '政策评估'])].join('；') +
    '\n\n【说明】以上为演示引擎按"背景—方法—结果—结论"四段式自动抽取生成，建议人工核对后使用。'
  )
}

function demoGap(topic: string): string {
  const t = topic.trim() || '示例研究主题'
  return `【现有研究进展概述】
围绕「${t}」，现有研究主要在理论框架构建、影响因素识别与实证检验三个层面展开，形成了较为丰富的方法体系，但仍存在以下不足。

【研究空白】（共 4 条）

1.【空白描述】${t}的动态演化过程缺乏纵向追踪
　现有研究为何未解决：多采用横断面数据，难以刻画机制随时间的演化
　可能的突破方向：引入面板数据/追踪实验设计，构建时序演化模型
　与该主题的契合度：高

2.【空白描述】微观个体行为与宏观结构的联动机制尚不清晰
　现有研究为何未解决：宏观与微观研究相对割裂，缺少跨层次整合框架
　可能的突破方向：多层次模型（HLM）或计算实验方法实现跨层 bridging
　与该主题的契合度：高

3.【空白描述】情境边界条件研究不足，结论外推性存疑
　现有研究为何未解决：样本多来自单一区域/行业，调节变量检验不充分
　可能的突破方向：多情境对比设计与调节效应系统检验
　与该主题的契合度：中

4.【空白描述】效果评估缺乏统一且可复用的指标体系
　现有研究为何未解决：各研究自行设定测量口径，结果难以横向比较
　可能的突破方向：基于元分析与专家咨询构建标准化指标工具包
　与该主题的契合度：中

【建议的研究切入点】
建议以"动态演化 + 情境调节"为主线：先通过纵向数据刻画 ${t} 的演化规律，再检验关键情境变量的调节作用，最后输出可复用的评估工具——兼顾理论增量与实践价值。

【说明】以上为演示引擎基于通用模板生成；开启「文献辅助写作」并配置任一大模型 API Key 后，研究空白将基于你个人文献库中的真实文献推导，且只引用检索到的内容。`
}

function demoDefense(input: string): string {
  const head = input.trim().slice(0, 40) || '你的论文'
  return `针对《${head}${input.trim().length > 40 ? '…' : ''}》的模拟答辩提问（共 7 问）：

一、选题与价值
1. 你的研究与已有文献相比，边际贡献究竟在哪里？（风险：高）
　回答要点：用 1 句话讲清"前人做到了哪一步、你推进了哪一步"，避免泛泛而谈"填补空白"。

2. 该选题的现实意义如何证明？（风险：中）
　回答要点：准备 1-2 个可量化的应用场景或政策依据。

二、研究方法
3. 为什么选择该方法而非替代方案（如质性研究/其他模型）？（风险：高）
　回答要点：从数据特性与研究问题匹配度论证，并主动说明方法局限。

4. 关键变量的操作化定义是否可靠？测量工具有何依据？（风险：中）
　回答要点：引用成熟量表来源，说明信效度检验结果。

三、数据与实证
5. 样本的代表性如何？是否存在选择偏差？（风险：高）
　回答要点：说明抽样框与总体特征对比，准备好稳健性检验结果备用。

6. 结果的因果解释是否成立？有无内生性问题？（风险：高）
　回答要点：说明识别策略（工具变量/固定效应/实验设计），坦承解释边界。

四、创新点与不足
7. 你认为本研究最大的不足是什么？后续如何改进？（风险：低）
　回答要点：诚实但可控——选一个"重要但已规划后续研究"的不足。

【答辩自述注意事项】
1. 开场 3 分钟内讲清"研究问题—方法—核心结论"三件事，不要铺陈过多文献；
2. PPT 每页只讲一个观点，图表优先于文字；
3. 遇到不会的问题，先复述确认，再给"当前理解 + 后续打算"，切忌强行辩解。

【说明】以上为演示引擎模拟生成；配置任一大模型 API Key 后，问题将针对你的真实论文内容定制，开启「文献辅助写作」还可让提问聚焦于你引用的文献。`
}

function demoNaturePolish(input: string): string {
  const body = input.trim()
  if (!body) return '（请先在左侧编辑器中输入或选中需要润色的内容）'
  const sents = body.split(/(?<=[。！？.!?])\s*/).filter((s) => s.trim())
  const preview = sents
    .slice(0, 3)
    .map((s, i) => `${i + 1}. "${s.trim().slice(0, 40)}${s.trim().length > 40 ? '…' : ''}" → 将译写为简洁、主动语态的 Nature 风格英文句`)
    .join('\n')
  return (
    '【Nature 风格英文润色（演示）】\n\n' +
    '演示引擎无法进行真实的翻译与润色。已分析输入文本（共 ' +
    sents.length +
    ' 句），将按以下规范处理：\n\n' +
    preview +
    '\n\n【应用规范】\n1. 主动语态优先，删除空洞修饰；\n2. 数值、单位、统计量原样保留；\n3. hedging 区分"已证明"与"提示"；\n4. 方法过去时、普遍结论现在时；\n5. 一段一论点，逻辑衔接显式化。\n\n' +
    '【说明】以上为演示引擎的规则提示；配置任一大模型 API Key 或连接本地模型（Ollama）后，将输出真正的 Nature 风格英文全文。'
  )
}

function demoNatureReview(input: string): string {
  const body = input.trim()
  if (!body) return '（请先在左侧编辑器中粘贴需要预审的论文内容）'
  const sents = body.split(/(?<=[。！？.!?])\s*/).filter((s) => s.trim())
  return (
    `【模拟评审报告（演示）】针对所提供文本（共 ${sents.length} 句，约 ${countWordsLocal(body)} 字）\n\n` +
    '1. Summary：演示引擎不会真正阅读语义。真实模型将在此客观概括研究问题、方法与核心贡献。\n\n' +
    '2. Major Concerns（预置检查项，可在原文中自查）：\n' +
    '   - 摘要中的结论是否有对应的结果数据支撑？\n' +
    '   - 关键声明是否标注了统计方法与样本量依据？\n' +
    '   - 因果性表述（"导致""证明"）是否超出了研究设计所能支持的范围？\n\n' +
    '3. Minor Issues：检查术语一致性、图表编号连续性、参考文献格式统一。\n\n' +
    '4. Recommendation：Major Revision（演示占位）。\n\n' +
    '【说明】以上为演示引擎基于 nature-reviewer 技能规范的占位报告；配置大模型后将生成引用原文定位的真实评审报告。'
  )
}

async function demoGenerate(
  task: AITask,
  input: string,
  targetWords?: number,
  citations?: string[]
): Promise<string> {
  await new Promise((r) => setTimeout(r, 600 + Math.random() * 600))
  const base = await (async () => {
    switch (task) {
      case 'outline':
        return demoOutline(input)
      case 'polish':
        return demoPolish(input)
      case 'expand':
        return demoExpand(input, targetWords || 400)
      case 'rewrite':
        return demoRewrite(input)
      case 'grammar':
        return demoGrammar(input)
      case 'topics':
        return demoTopics(input)
      case 'abstract':
        return demoAbstract(input)
      case 'gap':
        return demoGap(input)
      case 'defense':
        return demoDefense(input)
      case 'nature-polish':
        return demoNaturePolish(input)
      case 'nature-review':
        return demoNatureReview(input)
    }
  })()
  if (citations?.length) {
    return (
      base +
      `\n\n【文献引用】（来自你的个人文献库，GB/T 7714 格式）\n` +
      citations.map((c, i) => `[${i + 1}] ${c}`).join('\n')
    )
  }
  return base
}
