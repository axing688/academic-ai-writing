# 本地模型 + Nature 技能包集成说明

> 2026-09-10 实现。原"本地演示模式"（规则模板引擎）保留作为零配置兜底；
> 本次新增两条升级路径：**本地大模型推理**与 **Nature 期刊技能任务**。

## 一、本地模型（Ollama / LM Studio）——真·离线 AI 写作

### 架构

```
浏览器 ──/llm/ollama/chat/completions──▶ 本机代理（vite dev / nginx 容器）
                                            │ X-AWA-Target: http://localhost:11434/v1
                                            ▼
                                    Ollama (OpenAI 兼容 API)
```

- 前端固定写入 `X-AWA-Target: http://localhost:11434/v1`（或 LM Studio 1234 端口）
- 开发环境（vite 中间件）：Node 在宿主机直接转发到 localhost:11434
- Docker 环境（nginx）：`nginx.conf` 中的 `map $http_x_awa_target $llm_target`
  自动把 `localhost/127.0.0.1` 重写为 `host.docker.internal`（容器内 localhost 不是宿主机）
- resolver 追加了 `127.0.0.11`（Docker 内置 DNS），支持转发到 compose 内的容器名

### 使用步骤（Ollama）

1. 安装 Ollama：https://ollama.com/download（Windows 版安装后自动后台运行）
2. 拉取模型：`ollama pull qwen2.5:7b`（中文写作推荐；7B 量化约 4.7GB，需约 6GB 显存或 16GB 内存）
3. 应用「设置」页 → 服务商选「本地模型（Ollama）」→ 模型选 `qwen2.5:7b` → 测试连接 → 保存

### 使用步骤（LM Studio，图形界面）

1. 安装 LM Studio → 搜索并下载模型（如 Qwen2.5-7B-Instruct）
2. Developer 标签页 → Start Local Server（默认端口 1234，OpenAI 兼容）
3. 应用设置页选「本地模型（LM Studio）」

### 代码位置

- `frontend/src/services/ai.ts`：`PROVIDERS` 中 `ollama` / `lmstudio` 条目（`noKey: true, local: true`）
- `isAIConfigured` / `aiStatusText` / `testConnection`：免 Key 逻辑
- `callOpenAICompatible`：无 Key 时不发送 Authorization 头
- `frontend/docker/nginx.conf`：localhost → host.docker.internal 重写 + Docker DNS

## 二、Nature 期刊技能任务（源自 nature-skills）

从开源技能包 [nature-skills](https://github.com/Yuan1z0825/nature-skills) 中提取了两个技能的
**核心提示词规范**（SKILL.md 的规则部分），按本应用交互形态精简为两个新任务：

| 任务 | 提取来源 | 说明 |
|---|---|---|
| `nature-polish`（Nature 风格英文润色） | skills/nature-polishing | 主动语态、精确术语、hedging 证据分级、时态规范、数值保留；中文译写为英文 |
| `nature-review`（期刊预审） | skills/nature-reviewer | 互盲评审报告五段式：Summary / Major Concerns（引用原文定位）/ Minor Issues / 统计严谨性 / Recommendation |

- 提示词位于 `ai.ts` 的 `SYSTEM_PROMPTS`，与"导师风格注入""RAG 文献引用"可叠加
- 演示模式下输出规范占位说明；配置任一模型（云端 Key 或本地 Ollama）后生效
- 注意：nature-skills 仓库中的 Python 脚本、MCP 服务、浏览器自动化等运行时依赖
  无法在纯 web 应用中复用，此处仅提取其提示词与学术规范（这也是技能包中跨平台可移植的部分）

## 三、推荐组合（全离线工作流）

```
Ollama (qwen2.5:7b)  ← 推理引擎，完全离线
  + nature-polish / nature-review 技能提示词  ← 学术规范
  + 个人文献库 RAG  ← 真实引用（GB/T 7714）
  + 导师风格画像  ← 句式指纹注入
```

全部数据不出本机：文档存浏览器 localStorage、文献库存 IndexedDB、推理在本机 GPU/CPU。
