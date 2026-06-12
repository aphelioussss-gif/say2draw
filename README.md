# Say2Draw｜以声绘色

A voice-first AI drawing tool that turns spoken commands into structured Canvas actions.

## 项目简介

Say2Draw 是一款纯语音控制的 AI 绘图工具，用户只需说出绘图意图，系统即可将语音指令解析为结构化绘图操作，并在 Canvas 上实时执行。

> 以声绘色，让想法被听见，也被画出来

## 当前进度

当前处于 PR 1：App 基础页面阶段。

已完成：

- 项目治理文档与 Vite 工程基线
- Say2Draw 基础三栏页面骨架
- 语音状态区、Canvas 占位区、指令历史占位区

暂未完成：

- Web Speech API 语音识别
- Canvas 真实绘图
- 指令解析与 LLM 兜底

## 核心特性

- 🎤 纯语音控制：所有操作通过语音完成
- 🎨 AI 辅助绘图：自然语言描述自动生成图形
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
- OpenAI API
- HTML5 Canvas

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
