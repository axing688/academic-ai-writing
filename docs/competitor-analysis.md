# 竞品调研：类似项目与可借鉴点

> 调研时间：2026-09-09。重点检索"垂直/个性化"方向的同类开源项目，与本项目（个人文献库 + RAG 引用写作 + 导师风格适配规划）对照。

## 一、直接竞品/相关项目清单

### 通用学术 LLM 工具（横向，我们的差异化对照面）

| 项目 | Stars | 定位 | 与本项目的差距 |
|------|-------|------|----------------|
| **gpt_academic** (binary-husky) | ~71k | 论文阅读/翻译/润色/代码剖析，多模型并行对比 | 纯通用横向工具，无个性化、无文献库、无风格适配——正好印证"通用是红海"的判断；但其**多模型并行对比**（一次问题同时问多家模型）和**插件化按钮**（functional.py 动态生成）值得借鉴 |
| **paper-qa** (FutureHouse) | ~8.2k | 文献库问答，agentic RAG（迭代式改写检索词、多步工具调用） | 仅问答不做写作；但其"迭代检索"机制显著优于单次检索 |

### 个人文献库 + RAG（与我们 Phase 1 正面重叠）

| 项目 | 核心做法 | 值得抄的 |
|------|----------|----------|
| **AcademicRAG** (AlessandroCaforio) | ChromaDB + MiniLM 本地 RAG，6 个学术工具：引用生成、文献综述起草、论文对比表、观点提取、**研究空白发现（Research Gap Finder）**、**答辩预演（Defense Prep）**；LLM 结构化抽取（构念/变量/方法/结论）→ 构建**概念知识图谱**（causes/correlates/contradicts 等类型边） | ① 结构化抽取而非原文分块——把每篇论文变成"构念+变量+方法+结论"四元组再检索，召回质量远高于朴素分块；② 知识图谱增强检索上下文；③ "答辩预演"和"研究空白发现"是研究生刚需，我们路线图里应补上 |
| **RAG-Assistant-for-Zotero** (Quiet-Signals-Lab) | Zotero 桌面库全量索引，桌面应用 | ① **混合检索**：语义 embedding + BM25 + cross-encoder 重排（我们目前只有 BM25）；② **元数据过滤**：按年份/标签/作者/文集过滤检索（自然语言或控件）；③ **隐私控制**：可把指定文集排除出索引（"这些文献不发云端"）——与"未发表数据不出本机"的理念互补 |
| **Thesis_RAG** (georgebaris) | 证据门控：**检索不到证据就拒绝回答** | 与我们"检索不到就不写"的约束完全一致，证明该设计是业界共识 |
| **PaperQuay** (WangQrkkk，中文作者) | Electron 本地优先论文工作台：PDF 阅读/翻译/笔记/Zotero 导入/本地 RAG（sqlite-vec） | ① MinerU 结构化解析 + **块级预翻译缓存**（点原文即跳译文）；② 笔记与文献互链（`@paper` 引用、backlinks）；③ 面向中文研究生的产品叙事与我们高度同源 |
| **OpenDraft** (federicodeponte) | 19 个 agent 流水线生成 2 万字草稿 | **引用真实性双重校验**：每条引用的 DOI 必须在 CrossRef / OpenAlex / Semantic Scholar 中至少 2 家确认，确认不了的直接丢弃并记录——这是最值得抄的工程实践，且三个数据库 API 免费 |
| **ChiKen** | Zotero → RAG → MCP，把个人库暴露给 Claude Desktop | MCP 化个人知识库是趋势，可作远期方向 |

### 写作风格模仿（与我们 Phase 2 导师风格画像直接相关）

| 项目 | 核心做法 | 值得抄的 |
|------|----------|----------|
| **stylometric-transfer** (ngpepin) | 从作者语料构建**显式 JSON 风格指纹**：Measurements（句长分布/标点频率等统计）→ Targets（目标区间）→ Lexicon（偏好/回避词表）→ Templates（开头/过渡/段落范式）→ Controls（优先级/改写策略）→ **Validators（合规检查）→ Deviations（偏差报告）**，外加"风格重试循环"（合规分低就带偏差反馈重生成） | 与我们"风格规则卡"的设计几乎同构，且给出了可实现的完整 schema——**验证了我们的技术路线，可以直接照此细化数据结构**；显式可编辑 JSON 而非黑盒 embedding 的取舍也一致 |
| **TinyStyler** (EMNLP 2024) | 800M 小模型 + 作者身份 embedding 做 few-shot 风格迁移，效果超 GPT-4 | 学术上证明 few-shot 风格迁移可行；embedding 插值可做"风格强度"旋钮（我们可简化为规则权重） |
| **perfectly-replicate-writing-skills** | 7+1 维度风格分析框架，**"反复出现 ≥3 次的才是真特征"** | 维度框架（句式/措辞/结构/标点/节奏…）可直接用于我们的风格规则卡提取器；≥3 次原则可防过拟合个例 |
| **writelikeme** | 写作画像 + 风格标签 + "AI 味"检测 | "AI 味检测"对应我们的风格一致性评分 |

## 二、结论：市场格局与我们的定位

1. **通用赛道已高度拥挤**（gpt_academic 71k stars），且无一在做"导师风格适配 + 批注回流 + 修改偏好学习"——我们的垂直定位目前没有发现正面竞品，方向成立。
2. **文献库 RAG 是标配而非壁垒**（AcademicRAG/PaperQuay/Zotero-RAG 都做了）——单靠 Phase 1 不构成护城河，**必须把"结构化抽取 + 概念图谱 + 引用校验"做深**才能拉开差距。
3. **风格方向学术与工程储备都很成熟**——我们 Phase 2 的风险很低，且有现成 schema 可抄。

## 三、可落地的借鉴清单（按优先级）

| # | 借鉴点 | 来源 | 实施成本 | 优先级 |
|---|--------|------|----------|--------|
| 1 | **引用真实性校验**：对 AI 生成引用调 CrossRef/OpenAlex API 验 DOI/标题，验证不了的标红剔除 | OpenDraft | 低（免费 API，一个前端服务函数） | ⭐⭐⭐ 立即做 |
| 2 | **风格指纹 JSON schema**：Measurements/Targets/Lexicon/Templates/Validators/Deviations 六段式 + 合规分 + 重试循环 | stylometric-transfer | 低（Phase 2 数据结构照此设计） | ⭐⭐⭐ Phase 2 开工时 |
| 3 | **研究空白发现 + 答辩预演** 两个 AI 工具 | AcademicRAG | 低（新增两个 task 模板，复用现有 RAG 链路） | ⭐⭐⭐ 快赢 |
| 4 | **论文结构化抽取**（构念/变量/方法/结论四元组）入库，替代纯原文分块检索 | AcademicRAG | 中（需 LLM 调用，入库时异步执行） | ⭐⭐ Phase 2 |
| 5 | **混合检索升级**：BM25 + embedding + 重排；**元数据过滤**（年份/作者/标签） | Zotero-RAG | 中（embedding 需模型；先做元数据过滤，成本低） | ⭐⭐ |
| 6 | **多模型并行对比**：同一任务同时问 2-3 家模型，结果并排对比 | gpt_academic | 低-中 | ⭐ 体验增强 |
| 7 | **隐私排除区**：指定文献不参与任何云端调用 | Zotero-RAG | 低 | ⭐ 契合卖点 |
| 8 | Zotero 本地 API 导入（localhost:23119）替代/补充 .bib | ChiKen / PaperQuay | 中 | ⭐ 远期 |
| 9 | 概念知识图谱（contradicts/supports 等关系边） | AcademicRAG | 高 | 🔮 远期 |

## 四、竞品链接

- gpt_academic: https://github.com/binary-husky/gpt_academic
- paper-qa: https://github.com/Future-House/paper-qa
- AcademicRAG: https://github.com/AlessandroCaforio/AcademicRAG
- RAG-Assistant-for-Zotero: https://github.com/aahepburn/RAG-Assistant-for-Zotero
- Thesis_RAG: https://github.com/georgebaris/Thesis_RAG
- PaperQuay: https://github.com/WangQrkkk/PaperQuay
- OpenDraft: https://github.com/federicodeponte/opendraft
- stylometric-transfer: https://github.com/ngpepin/stylometric-transfer
- TinyStyler: https://github.com/zacharyhorvitz/TinyStyler
- perfectly-replicate-writing-skills: https://github.com/zrh091110225/perfectly-replicate-writing-skills
- writelikeme: https://github.com/97115104/writelikeme
- ChiKen: https://github.com/yuanjua/chiken
