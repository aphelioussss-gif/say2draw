# Say2Draw｜以声绘色

A voice-first AI drawing tool that turns spoken commands into structured Canvas actions.

## 项目简介

Say2Draw 是一款纯语音控制的 AI 绘图工具，用户只需说出绘图意图，系统即可将语音指令解析为结构化绘图操作，并在 Canvas 上实时执行。

> 以声绘色，让想法被听见，也被画出来

## 与现有方案的区别

| 维度 | AI 文生图 (Midjourney/DALL-E) | Say2Draw |
|------|-------------------------------|----------|
| 执行单位 | 整张图 | 单个图形 |
| 可编辑性 | 黑箱，无法修改局部 | 结构化，可逐个操作 |
| 响应方式 | 等待生成 (数秒~数十秒) | 实时执行 |
| 迭代成本 | 重新生成整张图 | 撤销/修改单个元素 |
| 累积性 | 每次独立生成 | 图形持续累积在画布上 |

Say2Draw 的核心价值：**可控、可累积、可中断的语音绘图体验**。当 AI 不确定如何绘制对象时，Say2Draw 不会返回空结果，而是生成一个保守草图作为起点，让用户用自然语言逐轮打磨。

## 当前进度

当前处于 PR16：三层降级 Fallback Sketch Mode 阶段。

已完成：

- 项目治理文档与 Vite 工程基线
- Say2Draw 基础三栏页面骨架
- Canvas 真实绘图引擎（circle / ellipse / rect / line / polygon / text）
- useReducer 绘图状态与历史记录
- Web Speech API 自动语音监听
- 中文本地规则 parser
- 语音 final text → local parser → reducer → Canvas 绘图闭环
- 紧急暂停/恢复监听控制
- SpeechSynthesis 语音反馈 + 回声保护
- LLM 结构化指令解析器（OpenAI-compatible）
- batch_actions 复杂指令拆解
- 模糊指令澄清机制
- 对象自我拆解 primitives（polyline / arc）
- 三层降级 Fallback Sketch Mode（PR16）

## 核心特性

- 🎤 纯语音控制：所有操作通过语音完成
- 🎨 AI 辅助绘图：自然语言描述自动生成图形
- 🖌️ 草图打磨：AI 不会画时生成草图起点，用户逐轮调整
- ⚡ 实时响应：低延迟的语音识别和绘图
- 🔄 撤销/重做：语音控制历史操作

## 快速开始

### 环境要求

- Node.js >= 18
- 现代浏览器（Chrome 推荐）

### 安装

```bash
npm install
```

### 开发

```bash
npm run dev
```

打开本地地址后，应用会自动尝试启动浏览器语音识别。推荐使用 Chrome，并允许浏览器麦克风权限。

### 构建

```bash
npm run build
```

## 语音指令

MVP 计划支持以下语音指令：

```text
画一个红色圆形
写上你好
撤销上一步
清空画布
画一个太阳、两朵云和一棵树
```

## 技术栈

- React + TypeScript
- Vite
- Web Speech API
- OpenAI-compatible LLM provider（可选）
- HTML5 Canvas

## LLM 配置（可选）

Say2Draw 的 LLM 功能是可选的。未配置 API key 时，系统仍可正常运行本地指令。

如需启用 LLM fallback：

1. 复制 `.env.example` 为 `.env`
2. 填入你的 OpenAI API key
3. 启动服务端：`npm run server`
4. 启动前端：`npm run dev`

```bash
cp .env.example .env
# 编辑 .env 填入 API key
npm run server
npm run dev
```

## LLM 策略

MVP 优先使用本地规则 parser，基础指令不依赖任何模型 API。

后续复杂指令解析会设计为 OpenAI-compatible LLM provider，而不是绑定单一 OpenAI 服务。只要 DeepSeek、Mimo 等服务提供兼容 OpenAI 的接口，就可以作为候选 provider。

API key 不会放入前端代码；LLM 兜底会通过后端代理或 serverless API 接入。

## 项目结构

```
say2draw-ai/
├── docs/           # 项目文档
├── src/            # 源代码
├── public/         # 静态资源
└── ...
```

## 文档

- [PRD - 产品需求文档](docs/PRD.md)
- [PLAN - 开发计划](docs/PLAN.md)
- [SYSTEM - 系统设计](docs/SYSTEM.md)
- [DEMO_SCRIPT - 演示脚本](docs/DEMO_SCRIPT.md)

## 许可证

MIT

---

*72小时 AI 实训营项目*
