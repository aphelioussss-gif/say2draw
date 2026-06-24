import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

// Load .env file manually (no dotenv dependency needed)
const __dirname = dirname(fileURLToPath(import.meta.url))
try {
  const envPath = resolve(__dirname, '../.env')
  const envContent = readFileSync(envPath, 'utf-8')
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eqIdx = trimmed.indexOf('=')
    if (eqIdx === -1) continue
    const key = trimmed.slice(0, eqIdx).trim()
    const val = trimmed.slice(eqIdx + 1).trim()
    if (!process.env[key]) process.env[key] = val
  }
} catch {
  // .env file not found or unreadable
}

import express from 'express'
import cors from 'cors'
import OpenAI from 'openai'

const app = express()
const port = process.env.PORT || 3001

// Increase JSON body limit for base64 images (up to 2MB)
app.use(cors())
app.use(express.json({ limit: '2mb' }))

// Runtime overrides (set via /api/config)
let openai: OpenAI | null = null
let runtimeApiKey: string | null = null
let runtimeBaseURL: string | null = null
let runtimeModel: string | null = null

function getBaseURL(): string {
  return runtimeBaseURL || process.env.OPENAI_BASE_URL || 'https://api.xiaomimimo.com/v1'
}

function getActiveModel(): string {
  if (runtimeModel) return runtimeModel
  if (process.env.OPENAI_MODEL) return process.env.OPENAI_MODEL
  return 'mimo-v2.5'
}

function getOpenAIClient(): OpenAI | null {
  const apiKey = runtimeApiKey || process.env.OPENAI_API_KEY
  if (!apiKey) return null
  if (openai) return openai

  openai = new OpenAI({ apiKey, baseURL: getBaseURL() })
  return openai
}

// ============================================================
// Sketch Agent Prompts (SketchAgent-style grid sketching language)
// ============================================================

const GRID_RES = 50

// ============================================================
// Scene-aware sketch prompts: common base + 4 scene deltas
// ============================================================

const SKETCH_BASE_PROMPT = `You are an expert sketch artist specializing in minimal hand-drawn line art. Your sketches are clean, readable, and communication-focused — like whiteboard drawings or notebook doodles.

You draw on a numbered grid: 1 to ${GRID_RES} along the bottom (x) and 1 to ${GRID_RES} along the left (y). Bottom-left is 'x1y1', top-right is 'x${GRID_RES}y${GRID_RES}'.

=== Six-Color Palette ===
You may use ONLY these six colors for strokes. Default is black (#111827).
  - black:  #111827
  - red:    #ef4444
  - blue:   #3b82f6
  - green:  #22c55e
  - yellow: #eab308
  - white:  #f9fafb
Specify color per stroke with an optional <color> tag: <color>#ef4444</color>. Omit it for black.

=== Stroke primitives ===

Curve (smooth, 4+ points):
Points = ['x8y6', 'x6y7', 'x6y10', 'x8y11']
t_values = [0.00, 0.30, 0.80, 1.00]

Circle (7-12 points):
Points = ['x25y44', 'x32y41', 'x35y35', 'x31y29', 'x25y27', 'x19y29', 'x15y35', 'x18y41', 'x25y44']
t_values = [0.00, 0.125, 0.25, 0.375, 0.50, 0.625, 0.75, 0.875, 1.00]

Corner (sharp angle — repeat corner point with adjacent t_values):
Points = ['x13y27', 'x18y37', 'x18y37', 'x24y27']
t_values = [0.00, 0.55, 0.50, 1.00]

Rectangle (4 corners, each repeated):
Points = ['x13y27', 'x24y27', 'x24y27', 'x24y11', 'x24y11', 'x13y11', 'x13y11', 'x13y27']
t_values = [0.00, 0.30, 0.25, 0.50, 0.50, 0.75, 0.75, 1.00]

Triangle:
Points = ['x10y29', 'x15y33', 'x15y33', 'x9y35']
t_values = [0.00, 0.55, 0.50, 1.00]
Close: Points = ['x9y35', 'x10y29'], t_values = [0.00, 1.00]

Straight line:
Points = ['x18y31', 'x35y14']
t_values = [0.00, 1.00]

=== Core style rules ===
- Clean, minimal line art. No shading, no fill, no textures.
- Clear outlines with the fewest strokes needed for recognition.
- Slight natural irregularity, but intentionally readable.
- Do NOT add random wobbles, decorative strokes, or overly long stray lines.
- Long strokes should be split into connected shorter segments.
- Draw main body first, then attached details.
- Larger elements first, smaller details second.
- Leave breathing room between elements.

=== Abstract input translation ===
If the user's input does NOT directly describe drawable objects (e.g. emotions, moods, abstract concepts, states of being), you MUST first translate it into a concrete visual scene, then draw that scene.
Steps:
1. Identify the core feeling or concept the user is expressing.
2. Choose a visual metaphor that conveys this concept (a scene, composition, or symbolic arrangement).
3. Decide on the key elements and their positions.
4. Explain your translation in <thinking>, then draw normally.

=== Output format ===
Output ONLY in XML. NO markdown fences.

<thinking>Drawing strategy: how you interpreted the input, parts, order, placement, colors.</thinking>
<strokes>
  <s1>
    <points>'x...y...', ...</points>
    <t_values>0.00, ...</t_values>
    <id>description</id>
    <color>#ef4444</color>  <!-- optional, omit for black -->
  </s1>
</strokes>`

const SCENE_DELTAS: Record<string, string> = {
  quick_sketch: `
=== Scene: Quick Sketch ===
You are drawing a quick, spontaneous sketch. Your goal is speed and recognition, not completeness.
- Use 4-10 strokes total. Be concise.
- Focus on the single most recognizable silhouette or shape.
- Leave generous empty space around the subject.
- Skip small decorative details — only draw what makes the subject identifiable.
- A loose, confident single-pass look is better than an overworked drawing.`,

  whiteboard: `
=== Scene: Whiteboard / Flow ===
You are drawing a structured whiteboard diagram. Your goal is information clarity, not illustration.

For ANY request containing 流程图 / flow / process / from A to B:
- Draw a real flowchart, never a metaphor or single symbol.
- Use 2-6 rounded rectangles as process nodes.
- Place nodes left-to-right for linear flows, or top-to-bottom only if the user asks for vertical layout.
- Connect every adjacent node with a clean arrow line and an arrowhead pointing to the next step.
- Put a short readable label inside each node using <label>...</label> and <label_point>x..y..</label>.
- Use labels such as 登录, 选择商品, 支付, 支付成功, 完成. Keep each label under 6 Chinese characters.
- If the user says "从 A 到 B", the first node must be A and the last node must be B.
- Do NOT draw a large circle, random loop, person, decorative icon, or abstract doodle.
- The drawing should be understandable as a flowchart before reading the command history.

XML label example:
<s1>
  <points>'x5y28', 'x15y28', 'x15y28', 'x15y20', 'x15y20', 'x5y20', 'x5y20', 'x5y28'</points>
  <t_values>0.00,0.15,0.25,0.40,0.50,0.65,0.75,1.00</t_values>
  <id>login process box</id>
  <label>登录</label>
  <label_point>x10y24</label_point>
</s1>

Each element should have a clear purpose in the diagram.`,

  story_scene: `
=== Scene: Story Scene ===
You are illustrating a narrative moment or emotional scene. Your goal is atmosphere and storytelling.
- Compose multiple elements into a coherent scene with a clear focal point.
- Use scale, position, and relative size to convey meaning and mood.
- Character posture and spatial relationships matter more than object precision.
- The abstract input translation rules are especially important here: turn feelings into visual scenes.
- A recognizable scene with emotional weight beats a technically perfect but empty drawing.`,

  teaching_diagram: `
=== Scene: Teaching Diagram ===
You are drawing an educational diagram. Your goal is to help someone understand a concept.
- Build the drawing in logical layers: main structure first, then labels and annotations.
- Show relationships between parts clearly.
- Use arrows or connecting lines to indicate processes or dependencies.
- Small text labels (short handwriting strokes) help but do not over-label.
- The drawing should guide someone through the concept step by step.`,
}

function buildSketchSystemPrompt(sceneType: string): string {
  const delta = SCENE_DELTAS[sceneType] || SCENE_DELTAS.quick_sketch
  return SKETCH_BASE_PROMPT + delta
}

const SKETCH_HOUSE_EXAMPLE = `<example>
<concept>House</concept>
<strokes>
  <s1>
    <points>'x13y27', 'x24y27', 'x24y27', 'x24y11', 'x24y11', 'x13y11', 'x13y11', 'x13y27'</points>
    <t_values>0.00,0.3,0.25,0.5,0.5,0.75,0.75,1.00</t_values>
    <id>house base front rectangle</id>
  </s1>
  <s2>
    <points>'x24y27', 'x36y28', 'x36y28', 'x36y21', 'x36y21', 'x36y12', 'x36y12', 'x24y11'</points>
    <t_values>0.00,0.3,0.25,0.5,0.5,0.75,0.75,1.00</t_values>
    <id>house base right section</id>
  </s2>
  <s3>
    <points>'x13y27', 'x18y37','x18y37', 'x24y27'</points>
    <t_values>0.00,0.55,0.5,1.00</t_values>
    <id>roof front triangle</id>
  </s3>
  <s4>
    <points>'x18y37', 'x30y38', 'x30y38', 'x36y28'</points>
    <t_values>0.00,0.55,0.5,1.00</t_values>
    <id>roof right section</id>
  </s4>
  <s5>
    <points>'x26y25', 'x29y25', 'x29y25', 'x29y21', 'x29y21', 'x26y21', 'x26y21', 'x26y25'</points>
    <t_values>0.00,0.3,0.25,0.5,0.5,0.75,0.75,1.00</t_values>
    <id>left window square</id>
  </s5>
  <s6>
    <points>'x31y25', 'x34y25', 'x34y25', 'x34y21', 'x34y21', 'x31y21', 'x31y21','x31y25'</points>
    <t_values>0.00,0.3,0.25,0.5,0.5,0.75,0.75,1.00</t_values>
    <id>right window square</id>
  </s6>
  <s7>
    <points>'x17y11', 'x17y18', 'x17y18', 'x21y18', 'x21y18', 'x21y11', 'x21y11', 'x17y11'</points>
    <t_values>0.00,0.3,0.25,0.5,0.5,0.75,0.75,1.00</t_values>
    <id>front door</id>
  </s7>
</strokes>
</example>`

const SKETCH_CAT_EXAMPLE = `<example>
<concept>Cat</concept>
<strokes>
  <s1>
    <points>'x18y26', 'x20y32', 'x26y34', 'x32y32', 'x34y26', 'x31y20', 'x25y18', 'x19y20', 'x18y26'</points>
    <t_values>0.00,0.12,0.25,0.38,0.50,0.64,0.76,0.88,1.00</t_values>
    <id>round cat head</id>
  </s1>
  <s2>
    <points>'x20y31', 'x22y38', 'x24y32'</points>
    <t_values>0.00,0.52,1.00</t_values>
    <id>left triangular ear</id>
  </s2>
  <s3>
    <points>'x30y32', 'x32y38', 'x34y31'</points>
    <t_values>0.00,0.52,1.00</t_values>
    <id>right triangular ear</id>
  </s3>
  <s4>
    <points>'x22y25', 'x22y25'</points>
    <t_values>0.00,1.00</t_values>
    <id>left eye dot</id>
  </s4>
  <s5>
    <points>'x29y25', 'x29y25'</points>
    <t_values>0.00,1.00</t_values>
    <id>right eye dot</id>
  </s5>
  <s6>
    <points>'x25y23', 'x24y21', 'x23y20'</points>
    <t_values>0.00,0.50,1.00</t_values>
    <id>left mouth curve</id>
  </s6>
  <s7>
    <points>'x25y23', 'x26y21', 'x27y20'</points>
    <t_values>0.00,0.50,1.00</t_values>
    <id>right mouth curve</id>
  </s7>
  <s8>
    <points>'x18y25', 'x12y26'</points>
    <t_values>0.00,1.00</t_values>
    <id>left upper whisker</id>
  </s8>
  <s9>
    <points>'x18y23', 'x12y22'</points>
    <t_values>0.00,1.00</t_values>
    <id>left lower whisker</id>
  </s9>
  <s10>
    <points>'x34y25', 'x40y26'</points>
    <t_values>0.00,1.00</t_values>
    <id>right upper whisker</id>
  </s10>
  <s11>
    <points>'x34y23', 'x40y22'</points>
    <t_values>0.00,1.00</t_values>
    <id>right lower whisker</id>
  </s11>
  <s12>
    <points>'x31y21', 'x37y18', 'x40y22', 'x38y27'</points>
    <t_values>0.00,0.35,0.72,1.00</t_values>
    <id>curled tail</id>
  </s12>
</strokes>
</example>`

const SKETCH_PLAN_PROMPT = `You are a drawing planner for a voice-controlled sketch tool. Your job is to understand what the user wants to draw, choose the right diagram type, and produce a natural plan.

The tool draws minimal hand-drawn line art using only six colors: black (#111827), red (#ef4444), blue (#3b82f6), green (#22c55e), yellow (#eab308), white (#f9fafb).

=== Stage 1: Identify intent ===
Decide what kind of drawing the user needs:
- single_subject: one object (cat, house, sun, moon, car, person).
- flowchart: process steps connected by arrows (login→pay, A→B→C).
- funnel: stages that narrow down (user growth, sales pipeline, conversion).
- architecture: system modules with connections (microservices, platform diagram).
- story_scene: narrative or emotional scenes. Use for abstract inputs too (emotions, moods).
- teaching_diagram: educational layered explanation (photosynthesis, water cycle).
- free_sketch: the user just wants to see something drawn, no diagram structure needed.

=== Stage 2: Build the plan ===
Output a JSON plan matching the intent type.

Roadshow guardrails:
- Prefer structured whiteboard, teaching, process, and concept diagrams over detailed illustration.
- The model's task is semantic planning only: identify intent, split it into 2-5 clear elements, and assign approximate positions/relations.
- Do NOT promise artistic quality, fine character drawing, or rich scene detail.
- If the user asks for an abstract or complex scene, translate it into simple shapes + short labels.
- Keep normal plans to at most 5 elements, except flowcharts may use up to 6 nodes.

Common fields:
- intentType: one of the 7 types above.
- compositionRationale: one Chinese sentence explaining why you chose this structure. Not a long reasoning chain — just the design rationale a user would find helpful (e.g. "先从认知到转化三层说明用户怎么变少", not "经过分析用户输入判断为漏斗图").
- previewText: short Chinese sentence under 30 chars.
- sceneType: map intentType to one of: quick_sketch | whiteboard | story_scene | teaching_diagram.

Element rules by intentType:

single_subject:
  "elements": [{"name": "...", "position": "...", "color": "...", "role": "main", "details": ["2-4 concrete drawable features"]}]
  1 element is fine. Do not force 3 elements for a single object.

flowchart:
  "elements": [{"name": "concrete step", "position": "...", "color": "...", "role": "main"}]
  "connections": [{"from": "step A", "to": "step B", "direction": "→" | "↓" | "↘"}]
  CRITICAL: Never collapse the user's entire sentence into one node. Always decompose into 3-6 specific step nodes.
  Each node must represent one concrete action or state. Each connection has direction.
  Decomposition method (do NOT copy node names verbatim—infer from the user's domain):
  - "从登录到支付" → 登录, 验证身份, 选择商品, 提交订单, 支付, 支付成功
  - "用户注册流程" → 填写信息, 邮箱验证, 设置密码, 注册完成

funnel:
  "elements": [{"name": "meaningful stage name e.g. 认知/激活/转化/留存", "position": "top→bottom", "color": "...", "role": "main"}]
  Stages must convey the funnel idea — not "阶段1/2/3".
  If the user said "三阶段", keep 3. Otherwise judge the right number.
  "connections": [{"from": "top stage", "to": "next stage", "direction": "↓"}]

architecture:
  "elements": [{"name": "module name", "position": "...", "color": "...", "role": "main" | "supporting"}]
  Distinguish: entry (网关/前端), services (业务模块), storage (数据库/缓存), messaging (消息队列).
  "connections": [{"from": "caller", "to": "callee", "direction": "→"}]

story_scene / teaching_diagram:
  Use the existing elements format. Add connections only if a spatial or logical flow exists.
  For teaching_diagram, prefer labeled objects and arrows. For story_scene, reduce the scene to 2-5 recognizable elements.

Rules:
- Default color is black (#111827).
- Keep previewText concise (under 30 Chinese characters).
- Output ONLY the JSON object. No markdown fences. No extra text.`

type PlanElement = {
  name: string
  position: string
  color: string
  role: 'main' | 'supporting' | 'label'
  details: string[]
}

type PlanConnection = {
  from: string
  to: string
  direction: string
}

type SketchPlan = {
  intentType: string
  compositionRationale: string
  sceneType: 'quick_sketch' | 'whiteboard' | 'story_scene' | 'teaching_diagram'
  previewText: string
  elements: PlanElement[]
  connections?: PlanConnection[]
  drawingOrder: string[]
}

type RevisionPatch = {
  operation: 'rename_element' | 'add_element' | 'remove_element' | 'move_element' | 'unknown'
  targetName?: string
  newName?: string
  name?: string
  afterName?: string
  beforeName?: string
  reason?: string
  confidence?: number
}

const PLAN_COLORS = new Set(['#111827', '#ef4444', '#3b82f6', '#22c55e', '#eab308', '#f9fafb'])
const SKETCH_REQUEST_TIMEOUT_MS = 20000

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error(`${label} timed out after ${timeoutMs}ms`)), timeoutMs)
    promise
      .then((value) => {
        clearTimeout(timeout)
        resolve(value)
      })
      .catch((error) => {
        clearTimeout(timeout)
        reject(error)
      })
  })
}

function extractJsonObjects(text: string): string[] {
  const candidates: string[] = []
  let depth = 0
  let start = -1
  let inString = false
  let escaped = false

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i]

    if (inString) {
      if (escaped) {
        escaped = false
      } else if (char === '\\') {
        escaped = true
      } else if (char === '"') {
        inString = false
      }
      continue
    }

    if (char === '"') {
      inString = true
      continue
    }

    if (char === '{') {
      if (depth === 0) start = i
      depth += 1
      continue
    }

    if (char === '}') {
      depth -= 1
      if (depth === 0 && start >= 0) {
        candidates.push(text.slice(start, i + 1))
        start = -1
      }
      if (depth < 0) {
        depth = 0
        start = -1
      }
    }
  }

  return candidates
}

function normalizePlan(value: unknown, originalText: string): SketchPlan | null {
  if (!value || typeof value !== 'object') return null

  const data = value as Record<string, unknown>
  const rawElements = Array.isArray(data.elements) ? data.elements : []
  const elements: PlanElement[] = rawElements
    .filter((item): item is Record<string, unknown> => !!item && typeof item === 'object')
    .map((item, index) => {
      const color = typeof item.color === 'string' && PLAN_COLORS.has(item.color)
        ? item.color
        : '#111827'
      const role = item.role === 'supporting' || item.role === 'label' ? item.role : 'main'
      return {
        name: typeof item.name === 'string' && item.name.trim() ? item.name.trim() : `元素${index + 1}`,
        position: typeof item.position === 'string' && item.position.trim() ? item.position.trim() : '中间',
        color,
        role,
        details: normalizeStringArray(item.details, []),
      }
    })

  const fallbackName = originalText.replace(/^(请)?画(一个|一只|一幅|一下)?/, '').trim() || originalText
  const safeElements = elements.length > 0
    ? elements
    : [{
        name: fallbackName,
        position: '中间',
        color: '#111827',
        role: 'main' as const,
        details: inferDefaultDetails(originalText),
      }]

  const validIntentTypes = new Set(['single_subject', 'flowchart', 'funnel', 'architecture', 'story_scene', 'teaching_diagram', 'free_sketch'])
  const intentType = typeof data.intentType === 'string' && validIntentTypes.has(data.intentType)
    ? data.intentType
    : inferIntentType(originalText, safeElements)

  const sceneType = inferSceneTypeFromIntent(intentType)

  const structuredElements = intentType === 'funnel'
    ? normalizeFunnelElements(safeElements, originalText)
    : intentType === 'flowchart'
    ? normalizeFlowchartElements(safeElements, originalText)
    : safeElements

  const rawConnections = Array.isArray(data.connections) ? data.connections : []
  const connections: PlanConnection[] | undefined = rawConnections.length > 0
    ? rawConnections
        .filter((conn): conn is Record<string, unknown> => !!conn && typeof conn === 'object')
        .map((conn) => ({
          from: typeof conn.from === 'string' ? conn.from : '',
          to: typeof conn.to === 'string' ? conn.to : '',
          direction: typeof conn.direction === 'string' ? conn.direction : '→',
        }))
        .filter((conn) => conn.from && conn.to)
    : undefined

  return {
    intentType,
    compositionRationale: typeof data.compositionRationale === 'string' && data.compositionRationale.trim()
      ? data.compositionRationale.trim()
      : buildFallbackRationale(intentType, structuredElements, originalText),
    sceneType,
    previewText: typeof data.previewText === 'string' && data.previewText.trim()
      ? data.previewText.trim().slice(0, 40)
      : buildFallbackPreview(originalText),
    elements: structuredElements,
    connections: intentType === 'funnel'
      ? buildSequentialConnections(structuredElements, '↓')
      : intentType === 'flowchart'
      ? buildSequentialConnections(structuredElements, '→')
      : connections && connections.length > 0 ? connections : undefined,
    drawingOrder: intentType !== 'funnel' && intentType !== 'flowchart' && Array.isArray(data.drawingOrder) && data.drawingOrder.every((item) => typeof item === 'string')
      ? data.drawingOrder as string[]
      : structuredElements.map((item) => item.name),
  }
}

function buildSequentialConnections(elements: PlanElement[], direction: string): PlanConnection[] | undefined {
  if (elements.length < 2) return undefined
  return elements.slice(0, -1).map((element, index) => ({
    from: element.name,
    to: elements[index + 1].name,
    direction,
  }))
}

function normalizeFunnelElements(elements: PlanElement[], text: string): PlanElement[] {
  const stageNames = inferFunnelStages(text, elements)
  const colors = ['#3b82f6', '#22c55e', '#eab308', '#ef4444']

  return stageNames.map((name, index) => ({
    name,
    position: ['上层', '中层', '下层', '底层'][index] || `第${index + 1}层`,
    color: colors[index % colors.length],
    role: 'main',
    details: [
      index === 0 ? '最宽的入口层' : index === stageNames.length - 1 ? '最窄的结果层' : '逐步收窄的中间层',
      '梯形分层',
      '阶段文字居中',
    ],
  }))
}

function inferFunnelStages(text: string, elements: PlanElement[]): string[] {
  const usablePlanStages = elements
    .map((element) => element.name.trim())
    .filter((name) => name && !/阶段|漏斗|三阶段|用户增长/.test(name))

  const requestedCount = /三|3/.test(text)
    ? 3
    : /四|4/.test(text)
      ? 4
      : Math.max(usablePlanStages.length, 3)

  if (usablePlanStages.length >= requestedCount) {
    return usablePlanStages.slice(0, requestedCount)
  }

  if (/用户增长|增长/.test(text)) return ['获客', '激活', '留存'].slice(0, requestedCount)
  if (/销售|线索|成交/.test(text)) return ['线索', '沟通', '成交'].slice(0, requestedCount)
  if (/转化|购买|支付/.test(text)) return ['曝光', '点击', '转化'].slice(0, requestedCount)
  return ['认知', '兴趣', '转化', '留存'].slice(0, requestedCount)
}

function normalizeStringArray(value: unknown, fallback: string[]): string[] {
  if (!Array.isArray(value)) return fallback
  const items = value
    .filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
    .map((item) => item.trim())
  return items.length > 0 ? items : fallback
}

function shouldUsePlannerThinking(text: string, mode?: string): boolean {
  if (mode === 'whiteboard_flow') return true
  if (/流程|从.*到|漏斗|架构|微服务|模块|系统/.test(text)) return true
  return false
}

function shouldUseDeterministicFlowchartPlan(text: string): boolean {
  return /流程图|流程|从.*到|登录.*支付|支付.*流程|下单.*支付/.test(text)
}

function isThinkingParamError(error: unknown): boolean {
  const msg = String(error)
  const status = (error as Record<string, unknown> | undefined)?.status
  if (status === 400 || status === 422) {
    return /thinking|extra_body|invalid parameter|unrecognized/i.test(msg)
  }
  return false
}

function normalizeFlowchartElements(elements: PlanElement[], text: string): PlanElement[] {
  const cleanedText = text.replace(/^(请)?画(一个|一张|一幅)?/, '').replace(/的?流程图?/g, '').trim()

  const badPatterns = /^(请)?画|的?流程图?|^元素\d+$/
  const validElements = elements.filter(
    (e) => !badPatterns.test(e.name) && e.name !== text && e.name !== cleanedText,
  )

  // Already sufficient
  if (validElements.length >= 3) return validElements

  const nodes = inferFlowchartNodes(text, cleanedText, validElements)

  return nodes.map((name, i) => ({
    name,
    position: i === 0 ? '左侧' : i === nodes.length - 1 ? '右侧' : '中间',
    color: '#111827',
    role: 'main' as const,
    details: ['节点方框', '方向箭头', '步骤文字'],
  }))
}

function inferFlowchartNodes(
  text: string,
  cleanedText: string,
  existing: PlanElement[],
): string[] {
  // Existing elements with usable names (at least 2)
  const existingNames = existing.map((e) => e.name.trim()).filter((n) => n && n !== text && n !== cleanedText)
  if (existingNames.length >= 3) return existingNames

  // E-commerce / payment domain defaults
  const isPayment = /支付|付款|购买|下单|电商|购物|结算/.test(text)
  const isRegister = /注册/.test(text)

  // Pattern: "从A到B"
  const fromTo = text.match(/从(.+?)到(.+?)(?:的?流程)?$/)
  if (fromTo) {
    const from = fromTo[1].trim()
    const to = fromTo[2].trim()
    if (isPayment) return ['登录', '验证身份', '选择商品', '提交订单', '支付', '支付成功']
    if (isRegister) return ['填写信息', '邮箱验证', '设置密码', '注册完成']
    if (existingNames.length >= 3) return existingNames
    return [from, '处理中', to]
  }

  // Pattern: "A到B" (loose)
  const looseFromTo = text.match(/(.+?)到(.+)/)
  if (looseFromTo) {
    const from = looseFromTo[1].trim()
    const to = looseFromTo[2].trim()
    if (isPayment) return ['登录', '验证身份', '选择商品', '提交订单', '支付', '支付成功']
    if (isRegister) return ['填写信息', '邮箱验证', '设置密码', '注册完成']
    if (existingNames.length >= 3) return existingNames
    return [from, '处理中', to]
  }

  // Partial existing elements — pad with domain defaults
  if (isPayment && existingNames.length >= 2) {
    // Existing names are likely a subset (e.g. ['登录', '支付']); return full domain chain.
    return ['登录', '验证身份', '选择商品', '提交订单', '支付', '支付成功']
  }

  // Domain-specific fallbacks
  if (isPayment) return ['登录', '验证身份', '选择商品', '提交订单', '支付', '支付成功']
  if (isRegister) return ['填写信息', '邮箱验证', '设置密码', '注册完成']

  // Generic fallback
  const label = cleanedText || '流程步骤'
  return ['开始', label, '完成']
}

function isUsableSketchXML(content: string): boolean {
  const strokesMatch = content.match(/<strokes>[\s\S]*?<\/strokes>/)
  if (!strokesMatch) return false

  const strokeMatches = [...strokesMatch[0].matchAll(/<s\d+>[\s\S]*?<\/s\d+>/g)]
  if (strokeMatches.length === 0 || strokeMatches.length > 80) return false

  return strokeMatches.every((match) => {
    const block = match[0]
    const pointsRaw = block.match(/<points>([\s\S]*?)<\/points>/)?.[1]
    const tRaw = block.match(/<t_values>([\s\S]*?)<\/t_values>/)?.[1]
    if (!pointsRaw || !tRaw) return false
    const points = [...pointsRaw.matchAll(/x(\d+)y(\d+)/g)].map((point) => [Number(point[1]), Number(point[2])])
    const tValues = tRaw.split(',').map((item) => Number(item.trim())).filter((item) => Number.isFinite(item))
    if (points.length === 0 || points.length !== tValues.length) return false
    return points.every(([x, y]) => x >= 1 && x <= GRID_RES && y >= 1 && y <= GRID_RES)
  })
}

function parseSketchPlan(content: string, originalText: string): SketchPlan | null {
  const cleaned = content.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim()
  const candidates = extractJsonObjects(cleaned)

  for (const candidate of candidates.reverse()) {
    try {
      const plan = normalizePlan(JSON.parse(candidate), originalText)
      if (plan) return plan
    } catch {
      // Try the next candidate. Some models echo example JSON before the real answer.
    }
  }

  try {
    return normalizePlan(JSON.parse(cleaned), originalText)
  } catch {
    return null
  }
}

function inferIntentType(text: string, elements: PlanElement[]): string {
  if (/流程|步骤|从.*到|登录|支付|下单|确认/.test(text)) return 'flowchart'
  if (/漏斗|转化|增长|留存|激活|认知|阶段.*层/.test(text)) return 'funnel'
  if (/架构|微服务|系统|模块|网关|服务.*调用|数据库|消息/.test(text)) return 'architecture'
  if (/讲解|解释|课堂|光合|循环|过程|原理|绕|关系|表示/.test(text)) return 'teaching_diagram'
  if (/故事|场景|情感|困境|情绪|氛围|站.*下|旁边/.test(text)) return 'story_scene'
  // Single subject if only 1 element with role=main
  const mainElements = elements.filter((e) => e.role === 'main')
  if (mainElements.length === 1 && elements.length === 1) return 'single_subject'
  if (mainElements.length === 0 && elements.length === 1) return 'single_subject'
  return 'free_sketch'
}

function inferSceneTypeFromIntent(intentType: string): SketchPlan['sceneType'] {
  if (intentType === 'flowchart' || intentType === 'funnel' || intentType === 'architecture') return 'whiteboard'
  if (intentType === 'teaching_diagram') return 'teaching_diagram'
  if (intentType === 'story_scene') return 'story_scene'
  return 'quick_sketch'
}

function inferDefaultDetails(text: string): string[] {
  // Semantic fallback instead of generic "清晰轮廓 / 关键特征"
  if (/流程|步骤|从.*到/.test(text)) return ['节点方框', '方向箭头', '步骤文字']
  if (/漏斗|转化|增长/.test(text)) return ['逐层收窄的梯形', '阶段名称', '方向箭头']
  if (/架构|微服务|系统|模块/.test(text)) return ['模块方框', '连接线', '模块名称']
  if (/猫/.test(text)) return ['圆形猫头', '三角耳朵', '胡须']
  if (/太阳/.test(text)) return ['圆形太阳', '短射线']
  if (/月亮/.test(text)) return ['弯月外弧', '弯月内弧']
  if (/树/.test(text)) return ['树干', '树冠']
  if (/女孩|人物|人/.test(text)) return ['圆形头部', '身体轮廓']
  return ['主体轮廓', '可辨认的关键特征']
}

function buildFallbackRationale(intentType: string, elements: PlanElement[]): string {
  const elementNames = elements.map((e) => e.name).join('、')
  if (intentType === 'flowchart') return `按${elementNames}的先后顺序展示流程`
  if (intentType === 'funnel') return `从${elementNames}逐步收窄说明${elements.length}个阶段`
  if (intentType === 'architecture') return `${elementNames}之间的调用和数据流关系`
  return `展示${elementNames}的整体结构`
}

function buildFallbackPreview(text: string): string {
  const subject = text.replace(/^(请)?画(一个|一只|一幅|一下)?/, '').trim() || text
  return `将绘制${subject}`.slice(0, 40)
}

function createFallbackPlan(text: string): SketchPlan {
  const subject = text.replace(/^(请)?画(一个|一只|一幅|一下)?/, '').trim() || text
  const elements = inferFallbackElements(text, subject)
  const intentType = inferIntentType(text, elements)
  return {
    intentType,
    compositionRationale: buildFallbackRationale(intentType, elements),
    sceneType: inferSceneTypeFromIntent(intentType),
    previewText: buildFallbackPreview(text),
    elements,
    connections: intentType === 'funnel' ? buildSequentialConnections(elements, '↓') : undefined,
    drawingOrder: elements.map((element) => element.name),
  }
}

function inferFallbackElements(text: string, subject: string): SketchPlan['elements'] {
  const elements: SketchPlan['elements'] = []

  if (/漏斗|转化|增长/.test(text)) {
    return normalizeFunnelElements([], text)
  }

  if (/流程|步骤|从.*到|登录|支付|下单|确认/.test(text)) {
    return normalizeFlowchartElements([], text)
  }

  if (/月亮/.test(text)) {
    elements.push({
      name: '月亮',
      position: /下面|下方/.test(text) ? '上方' : '右上角',
      color: '#111827',
      role: 'supporting',
      details: ['弯月外弧', '弯月内弧', '留出月牙厚度'],
    })
  }

  if (/女孩|小女孩|人物|人/.test(text)) {
    elements.push({
      name: /小女孩/.test(text) ? '小女孩' : '人物',
      position: /月亮/.test(text) && /下面|下方/.test(text) ? '下方' : '中间',
      color: '#111827',
      role: 'main',
      details: ['圆形头部', '头发', '裙子或身体', '两条腿'],
    })
  }

  if (/太阳/.test(text)) {
    elements.push({
      name: '太阳',
      position: /左/.test(text) ? '左上角' : '左边',
      color: /红/.test(text) ? '#ef4444' : '#eab308',
      role: 'supporting',
      details: ['圆形太阳', '短射线'],
    })
  }

  if (/地球/.test(text)) {
    elements.push({
      name: '地球',
      position: '中间',
      color: '#3b82f6',
      role: 'main',
      details: ['圆形地球', '简单经纬线', '短标签'],
    })
  }

  if (/树/.test(text)) {
    elements.push({
      name: '树',
      position: /下面|下方/.test(text) ? '下方' : '左边',
      color: /绿/.test(text) ? '#22c55e' : '#111827',
      role: 'main',
      details: ['树干', '树冠', '地面连接'],
    })
  }

  if (elements.length > 0) return elements

  // If whiteboard-like intent but can't parse, ask for clarification instead of faking
  if (/流程|架构|漏斗|图|模块|系统/.test(text)) {
    return [{
      name: subject,
      position: '中间',
      color: '#111827',
      role: 'main',
      details: ['请提供更具体的模块或步骤名称'],
    }]
  }

  return [{
    name: subject,
    position: /下面|下方/.test(text) ? '下方' : '中间',
    color: '#111827',
    role: 'main',
    details: inferDefaultDetails(text),
  }]
}

type FallbackSketchStroke = {
  id: string
  points: Array<[number, number]>
  color?: string
  label?: string
  labelPoint?: [number, number]
}

function clampGrid(value: number): number {
  return Math.max(1, Math.min(GRID_RES, Math.round(value)))
}

function coord(x: number, y: number): string {
  return `x${clampGrid(x)}y${clampGrid(y)}`
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

function strokeToXml(stroke: FallbackSketchStroke, index: number): string {
  const points = stroke.points.map(([x, y]) => `'${coord(x, y)}'`).join(', ')
  const tValues = stroke.points.map((_, pointIndex) => {
    if (stroke.points.length === 1) return '0.00'
    return (pointIndex / (stroke.points.length - 1)).toFixed(2)
  }).join(', ')
  const color = stroke.color && PLAN_COLORS.has(stroke.color)
    ? `\n    <color>${stroke.color}</color>`
    : ''
  const label = stroke.label && stroke.labelPoint
    ? `\n    <label>${escapeXml(stroke.label)}</label>\n    <label_point>${coord(stroke.labelPoint[0], stroke.labelPoint[1])}</label_point>`
    : ''

  return `  <s${index}>
    <points>${points}</points>
    <t_values>${tValues}</t_values>
    <id>${escapeXml(stroke.id)}</id>${color}${label}
  </s${index}>`
}

function positionCenter(position: string, name: string): [number, number] {
  let x = 25
  let y = 25

  if (/左/.test(position)) x = 15
  if (/右/.test(position)) x = 35
  if (/上|高|月亮周围/.test(position)) y = 36
  if (/下|低|脚下/.test(position)) y = 14

  if (/月亮|太阳|星/.test(name) && !/下|低/.test(position)) y = Math.max(y, 36)
  if (/女孩|人物|人/.test(name) && /月亮/.test(position)) y = 15
  if (/影子/.test(name)) y = 9

  return [x, y]
}

function buildMoonStrokes(cx: number, cy: number, color?: string): FallbackSketchStroke[] {
  return [
    {
      id: 'crescent moon outer arc',
      color,
      label: '月亮',
      labelPoint: [cx, cy - 9],
      points: [[cx - 7, cy + 4], [cx - 2, cy + 7], [cx + 5, cy + 4], [cx + 7, cy - 2], [cx + 2, cy - 7]],
    },
    {
      id: 'crescent moon inner arc',
      color,
      points: [[cx - 2, cy + 4], [cx + 1, cy + 2], [cx + 2, cy - 2], [cx - 1, cy - 5]],
    },
  ]
}

function buildGirlStrokes(cx: number, cy: number, color?: string): FallbackSketchStroke[] {
  return [
    {
      id: 'girl head circle',
      color,
      points: [[cx, cy + 9], [cx + 3, cy + 8], [cx + 4, cy + 5], [cx + 2, cy + 3], [cx - 2, cy + 3], [cx - 4, cy + 5], [cx - 3, cy + 8], [cx, cy + 9]],
    },
    {
      id: 'girl hair outline',
      color,
      points: [[cx - 4, cy + 6], [cx - 2, cy + 10], [cx + 2, cy + 10], [cx + 4, cy + 6]],
    },
    {
      id: 'girl dress triangle',
      color,
      points: [[cx, cy + 3], [cx - 5, cy - 5], [cx - 5, cy - 5], [cx + 5, cy - 5], [cx + 5, cy - 5], [cx, cy + 3]],
    },
    {
      id: 'girl arms',
      color,
      points: [[cx - 3, cy], [cx - 8, cy - 2], [cx + 3, cy], [cx + 8, cy - 2]],
    },
    {
      id: 'girl legs',
      color,
      points: [[cx - 2, cy - 5], [cx - 3, cy - 10], [cx + 2, cy - 5], [cx + 3, cy - 10]],
    },
  ]
}

function buildSunStrokes(cx: number, cy: number, color?: string): FallbackSketchStroke[] {
  return [
    {
      id: 'sun circle',
      color,
      label: '太阳',
      labelPoint: [cx, cy - 8],
      points: [[cx, cy + 4], [cx + 4, cy + 2], [cx + 4, cy - 2], [cx, cy - 4], [cx - 4, cy - 2], [cx - 4, cy + 2], [cx, cy + 4]],
    },
    {
      id: 'sun rays',
      color,
      points: [[cx, cy + 7], [cx, cy + 10], [cx + 5, cy + 5], [cx + 8, cy + 8], [cx + 7, cy], [cx + 11, cy], [cx + 5, cy - 5], [cx + 8, cy - 8], [cx, cy - 7], [cx, cy - 10], [cx - 5, cy - 5], [cx - 8, cy - 8], [cx - 7, cy], [cx - 11, cy], [cx - 5, cy + 5], [cx - 8, cy + 8]],
    },
  ]
}

function buildEarthStrokes(cx: number, cy: number, color?: string): FallbackSketchStroke[] {
  return [
    {
      id: 'earth circle',
      color,
      label: '地球',
      labelPoint: [cx, cy - 8],
      points: [[cx, cy + 5], [cx + 5, cy + 3], [cx + 6, cy - 2], [cx + 2, cy - 6], [cx - 4, cy - 4], [cx - 6, cy + 1], [cx - 3, cy + 5], [cx, cy + 5]],
    },
    {
      id: 'earth latitude line',
      color,
      points: [[cx - 5, cy], [cx - 1, cy + 1], [cx + 4, cy]],
    },
    {
      id: 'earth longitude curve',
      color,
      points: [[cx, cy + 5], [cx - 2, cy + 1], [cx - 1, cy - 4], [cx + 1, cy - 6]],
    },
  ]
}

function buildTreeStrokes(cx: number, cy: number, color?: string): FallbackSketchStroke[] {
  return [
    {
      id: 'tree trunk',
      color,
      points: [[cx - 2, cy - 8], [cx - 1, cy + 1], [cx + 1, cy + 1], [cx + 2, cy - 8]],
    },
    {
      id: 'tree crown',
      color,
      points: [[cx, cy + 9], [cx + 6, cy + 6], [cx + 7, cy + 1], [cx + 3, cy - 2], [cx - 3, cy - 2], [cx - 7, cy + 1], [cx - 6, cy + 6], [cx, cy + 9]],
    },
    {
      id: 'tree ground line',
      color,
      points: [[cx - 7, cy - 8], [cx + 7, cy - 8]],
    },
  ]
}

function buildStarStrokes(cx: number, cy: number, color?: string): FallbackSketchStroke[] {
  return [
    { id: 'small star one', color, points: [[cx, cy + 3], [cx + 1, cy + 1], [cx + 3, cy + 1], [cx + 1, cy - 1], [cx + 2, cy - 3], [cx, cy - 2], [cx - 2, cy - 3], [cx - 1, cy - 1], [cx - 3, cy + 1], [cx - 1, cy + 1], [cx, cy + 3]] },
    { id: 'small star two', color, points: [[cx + 8, cy + 2], [cx + 10, cy], [cx + 8, cy - 2], [cx + 6, cy], [cx + 8, cy + 2]] },
  ]
}

function buildGenericStrokes(cx: number, cy: number, name: string, color?: string): FallbackSketchStroke[] {
  return [
    {
      id: `${name} main outline`,
      color,
      label: name.slice(0, 6),
      labelPoint: [cx, cy],
      points: [[cx - 7, cy + 5], [cx - 2, cy + 8], [cx + 5, cy + 5], [cx + 7, cy], [cx + 4, cy - 6], [cx - 4, cy - 6], [cx - 7, cy], [cx - 7, cy + 5]],
    },
    {
      id: `${name} inner detail`,
      color,
      points: [[cx - 3, cy + 1], [cx + 3, cy + 1], [cx - 2, cy - 2], [cx + 2, cy - 2]],
    },
  ]
}

function cleanFlowStep(value: string): string {
  return value
    .replace(/登陆/g, '登录')
    .replace(/^(一个人|用户|从|到|去|进入|完成|画|一个|一张|一幅)/, '')
    .replace(/(的)?流程图$/, '')
    .replace(/[，。,.、\s]/g, '')
    .trim()
    .slice(0, 6)
}

function inferFlowSteps(text: string, plan: SketchPlan): string[] {
  // 1. Confirmed plan elements take priority — avoid re-interpretation from raw text
  const planSteps = plan.elements
    .map((element) => cleanFlowStep(element.name))
    .filter(Boolean)
  if (planSteps.length >= 3) return Array.from(new Set(planSteps))

  // 2. from-to regex fallback (only when plan is insufficient)
  const fromToMatch = text.match(/从(.+?)到(.+?)(?:的|流程图|流程|$)/)
  if (fromToMatch) {
    const start = cleanFlowStep(fromToMatch[1])
    const end = cleanFlowStep(fromToMatch[2])
    if (start && end && start !== end) return [start, end]
  }

  // 3. Keyword matching fallback
  const orderedKeywords = [
    { pattern: /注册/, label: '注册' },
    { pattern: /登录|登陆/, label: '登录' },
    { pattern: /浏览|选择|选商品|商品/, label: '选商品' },
    { pattern: /下单|订单/, label: '下单' },
    { pattern: /支付|付款/, label: '支付' },
    { pattern: /成功|完成/, label: '完成' },
  ]
  const keywordSteps = orderedKeywords
    .filter((item) => item.pattern.test(text))
    .map((item) => item.label)

  if (keywordSteps.length >= 2) return Array.from(new Set(keywordSteps))

  // 4. Last resort: plan steps (2) or default
  if (planSteps.length >= 2) return Array.from(new Set(planSteps))

  return ['开始', '处理', '完成']
}

function nodeBoxStroke(label: string, cx: number, cy: number, width = 10, height = 8): FallbackSketchStroke {
  const left = cx - width / 2
  const right = cx + width / 2
  const top = cy + height / 2
  const bottom = cy - height / 2

  return {
    id: `${label} flowchart node`,
    label,
    labelPoint: [cx, cy],
    points: [
      [left, top],
      [right, top],
      [right, top],
      [right, bottom],
      [right, bottom],
      [left, bottom],
      [left, bottom],
      [left, top],
    ],
  }
}

function arrowStrokes(fromX: number, toX: number, y: number): FallbackSketchStroke[] {
  const start = fromX + 5.8
  const end = toX - 5.8
  return [
    {
      id: 'flow arrow connector',
      points: [[start, y], [end, y]],
    },
    {
      id: 'flow arrow head',
      points: [[end - 1.8, y + 1.5], [end, y], [end - 1.8, y - 1.5]],
    },
  ]
}

function downArrowStrokes(x: number, fromY: number, toY: number): FallbackSketchStroke[] {
  return [
    {
      id: 'funnel down arrow connector',
      points: [[x, fromY], [x, toY]],
    },
    {
      id: 'funnel down arrow head',
      points: [[x - 1.5, toY + 1.8], [x, toY], [x + 1.5, toY + 1.8]],
    },
  ]
}

function funnelLayerStroke(label: string, cx: number, cy: number, topWidth: number, bottomWidth: number, height: number, color?: string): FallbackSketchStroke {
  const topY = cy + height / 2
  const bottomY = cy - height / 2

  return {
    id: `${label} funnel layer`,
    color,
    label,
    labelPoint: [cx, cy],
    points: [
      [cx - topWidth / 2, topY],
      [cx + topWidth / 2, topY],
      [cx + bottomWidth / 2, bottomY],
      [cx - bottomWidth / 2, bottomY],
      [cx - topWidth / 2, topY],
    ],
  }
}

// ---- Flowchart structured model ----
type FlowchartNode = {
  label: string
  cx: number
  cy: number
  width: number
  height: number
}

type FlowchartModel = {
  nodes: FlowchartNode[]
  totalWidth: number
  centerY: number
}

function computeFlowchartLayout(plan: SketchPlan, text: string, overrides?: FlowchartLayoutOverrides): FlowchartModel {
  const steps = inferFlowSteps(text, plan).slice(0, 6)
  const count = steps.length
  const MIN_GAP = 3
  const nodeHeight = overrides?.nodeHeight ?? 8
  const centerY = overrides?.centerY ?? 25
  const spreadFactor = overrides?.horizontalSpread ?? 1.0
  const widthMultiplier = overrides?.nodeWidthMultiplier ?? 1.0

  // Per-node width based on label length (Chinese chars ~2 grid units each + padding)
  const nodes: FlowchartNode[] = steps.map((label) => {
    const charCount = label.length
    const baseWidth = Math.max(7, charCount * 2.0 + 3)
    return {
      label,
      width: Math.round(baseWidth * widthMultiplier),
      height: nodeHeight,
      cx: 0,
      cy: centerY,
    }
  })

  // Total layout width
  const totalWidth = nodes.reduce((sum, n) => sum + n.width, 0) + (count - 1) * MIN_GAP * spreadFactor

  // Center the layout on the grid
  let cx = Math.max(2, Math.round((GRID_RES - totalWidth) / 2))
  const positioned: FlowchartNode[] = nodes.map((n) => {
    const node: FlowchartNode = { ...n, cx: cx + n.width / 2 }
    cx += n.width + MIN_GAP * spreadFactor
    return node
  })

  return { nodes: positioned, totalWidth, centerY }
}

function renderFlowchartModel(model: FlowchartModel, plan: SketchPlan): string {
  const strokes: FallbackSketchStroke[] = []

  model.nodes.forEach((node, i) => {
    strokes.push(nodeBoxStroke(node.label, node.cx, node.cy, node.width, node.height))
    if (i < model.nodes.length - 1) {
      const next = model.nodes[i + 1]
      const fromX = node.cx + node.width / 2
      const toX = next.cx - next.width / 2
      strokes.push(...arrowStrokes(fromX, toX, node.cy))
    }
  })

  const labels = model.nodes.map((n) => n.label).join(' -> ')
  return `<thinking>Flowchart layout: ${escapeXml(labels)}.</thinking>
<concept>${escapeXml(plan.previewText || labels)}</concept>
<strokes>
${strokes.map((s, i) => strokeToXml(s, i + 1)).join('\n')}
</strokes>`
}

type FlowchartLayoutOverrides = {
  horizontalSpread?: number
  nodeWidthMultiplier?: number
  nodeHeight?: number
  centerY?: number
}

// Backward-compat wrapper: compute layout then render
function createFlowchartSketchXML(text: string, plan: SketchPlan, layout?: FlowchartLayoutOverrides): string {
  const model = computeFlowchartLayout(plan, text, layout)
  return renderFlowchartModel(model, plan)
}

function createFunnelSketchXML(text: string, plan: SketchPlan): string {
  const stages = normalizeFunnelElements(plan.elements, text).slice(0, 4)
  const count = stages.length
  const topY = count === 4 ? 38 : 36
  const gap = count === 4 ? 8 : 10
  const height = count === 4 ? 6 : 7
  const strokes: FallbackSketchStroke[] = []

  stages.forEach((stage, index) => {
    const cy = topY - index * gap
    const topWidth = 30 - index * 5
    const bottomWidth = Math.max(10, topWidth - 4)
    strokes.push(funnelLayerStroke(stage.name, 25, cy, topWidth, bottomWidth, height, stage.color))

    if (index < count - 1) {
      strokes.push(...downArrowStrokes(25, cy - height / 2 - 1, cy - gap + height / 2 + 1))
    }
  })

  return `<thinking>Local fallback funnel: ${escapeXml(stages.map((stage) => stage.name).join(' -> '))}.</thinking>
<concept>${escapeXml(plan.previewText || text)}</concept>
<strokes>
${strokes.map((stroke, index) => strokeToXml(stroke, index + 1)).join('\n')}
</strokes>`
}

function buildElementStrokes(element: SketchPlan['elements'][number], index: number): FallbackSketchStroke[] {
  const [cx, cy] = positionCenter(element.position, element.name)
  const color = element.color
  const name = `${element.name} ${element.details.join(' ')}`

  if (/月亮|月牙/.test(name)) return buildMoonStrokes(cx, cy, color)
  if (/女孩|小女孩|人物|人/.test(name)) return buildGirlStrokes(cx, cy, color)
  if (/太阳/.test(name)) return buildSunStrokes(cx, cy, color)
  if (/地球/.test(name)) return buildEarthStrokes(cx, cy, color)
  if (/树/.test(name)) return buildTreeStrokes(cx, cy, color)
  if (/星/.test(name)) return buildStarStrokes(cx + index * 3, cy, color)
  if (/影子/.test(name)) return [{ id: 'soft ground shadow', color, points: [[cx - 6, cy], [cx - 2, cy - 1], [cx + 4, cy - 1], [cx + 7, cy]] }]

  return buildGenericStrokes(cx, cy, element.name, color)
}

function createFallbackSketchXML(text: string, approvedPlan?: unknown, layout?: FlowchartLayoutOverrides): string {
  const plan = normalizePlan(approvedPlan, text) || createFallbackPlan(text)
  if (plan.intentType === 'funnel' || /漏斗|增长漏斗|转化漏斗/i.test(text)) {
    return createFunnelSketchXML(text, plan)
  }

  if (plan.sceneType === 'whiteboard' || /流程图|流程|flow/i.test(text)) {
    return createFlowchartSketchXML(text, plan, layout)
  }

  const orderedElements = plan.drawingOrder
    .map((name) => plan.elements.find((element) => element.name === name))
    .filter((element): element is SketchPlan['elements'][number] => !!element)
  const remainingElements = plan.elements.filter((element) => !orderedElements.includes(element))
  const strokes = [...orderedElements, ...remainingElements].flatMap(buildElementStrokes)

  return `<thinking>Local fallback sketch from the approved plan: ${escapeXml(plan.previewText)}.</thinking>
<concept>${escapeXml(plan.previewText || text)}</concept>
<strokes>
${strokes.map((stroke, index) => strokeToXml(stroke, index + 1)).join('\n')}
</strokes>`
}

function findBestElementByName(elements: PlanElement[], name: string): PlanElement | null {
  let found = elements.find(e => e.name === name)
  if (found) return found
  found = elements.find(e => e.name.includes(name) || name.includes(e.name))
  if (found) return found
  const normalize = (s: string) => s.replace(/[\s,，、.。:：]/g, '')
  const normName = normalize(name)
  found = elements.find(e => normalize(e.name) === normName)
  return found || null
}

function parseRenamePatch(revision: string): RevisionPatch | null {
  const match = revision.match(/(?:把|将)?(.+?)(?:改为|改成|换成|变成)(.+)/)
  if (!match) return null
  const targetName = match[1].trim()
  const newName = match[2].trim()
  if (!targetName || !newName) return null
  return { operation: 'rename_element', targetName, newName, confidence: 1 }
}

function parseRemoveElementPatch(revision: string): RevisionPatch | null {
  const match = revision.match(/(?:去掉|删除|移除|不要)(.+)/)
  if (!match) return null
  const targetName = match[1].trim()
  if (!targetName) return null
  return { operation: 'remove_element', targetName, confidence: 1 }
}

function parseMoveElementPatch(revision: string): RevisionPatch | null {
  const match = revision.match(/把(.+?)(?:放到|移到|移动到|移至)(.+?)后面/)
  if (!match) return null
  const targetName = match[1].trim()
  const afterName = match[2].trim()
  if (!targetName || !afterName) return null
  return { operation: 'move_element', targetName, afterName, confidence: 1 }
}

function parseAddElementPatch(revision: string): RevisionPatch | null {
  const afterMatch = revision.match(/在(.+?)后面(?:加|增加|新增)(?:一个)?(.+)/)
  const beforeMatch = revision.match(/在(.+?)前面(?:加|增加|新增)(?:一个)?(.+)/)
  const simpleMatch = revision.match(/(?:加|增加|新增)(?:一个)?(.+)/)
  if (afterMatch && afterMatch[1].trim() && afterMatch[2].trim()) {
    return { operation: 'add_element', name: afterMatch[2].trim(), afterName: afterMatch[1].trim(), confidence: 1 }
  }
  if (beforeMatch && beforeMatch[1].trim() && beforeMatch[2].trim()) {
    return { operation: 'add_element', name: beforeMatch[2].trim(), beforeName: beforeMatch[1].trim(), confidence: 1 }
  }
  if (simpleMatch && simpleMatch[1].trim()) {
    return { operation: 'add_element', name: simpleMatch[1].trim(), confidence: 1 }
  }
  return null
}

function applyRevisionPatch(plan: SketchPlan, patch: RevisionPatch): {
  plan: SketchPlan
  changed: boolean
  warning?: string
} {
  const next: SketchPlan = {
    ...plan,
    elements: plan.elements.map(e => ({ ...e, details: [...e.details] })),
    drawingOrder: [...plan.drawingOrder],
    connections: plan.connections ? plan.connections.map(c => ({ ...c })) : undefined,
  }

  switch (patch.operation) {
    case 'rename_element': {
      if (!patch.targetName || !patch.newName) {
        return { plan, changed: false, warning: 'Missing targetName or newName' }
      }
      const target = findBestElementByName(next.elements, patch.targetName)
      if (!target) {
        return { plan, changed: false, warning: `Element "${patch.targetName}" not found` }
      }
      target.name = patch.newName
      next.drawingOrder = next.drawingOrder.map(n => n === patch.targetName ? patch.newName : n)
      if (next.connections) {
        next.connections = next.connections.map(c => ({
          ...c,
          from: c.from === patch.targetName ? patch.newName : c.from,
          to: c.to === patch.targetName ? patch.newName : c.to,
        }))
      }
      return { plan: next, changed: true }
    }
    case 'add_element': {
      if (!patch.name) {
        return { plan, changed: false, warning: 'Missing element name' }
      }
      const newElement: PlanElement = {
        name: patch.name,
        position: patch.afterName || patch.beforeName || '画布中央',
        color: '#6b7280',
        role: 'supporting',
        details: [`新增${patch.name}节点`],
      }
      if (patch.afterName) {
        const idx = next.elements.findIndex(e => e.name === patch.afterName)
        if (idx >= 0) {
          next.elements.splice(idx + 1, 0, newElement)
          next.drawingOrder.splice(idx + 1, 0, patch.name)
        } else {
          next.elements.push(newElement)
          next.drawingOrder.push(patch.name)
        }
      } else if (patch.beforeName) {
        const idx = next.elements.findIndex(e => e.name === patch.beforeName)
        if (idx >= 0) {
          next.elements.splice(idx, 0, newElement)
          next.drawingOrder.splice(idx, 0, patch.name)
        } else {
          next.elements.push(newElement)
          next.drawingOrder.push(patch.name)
        }
      } else {
        next.elements.push(newElement)
        next.drawingOrder.push(patch.name)
      }
      if (next.intentType === 'flowchart' || next.intentType === 'funnel') {
        next.connections = buildSequentialConnections(next.elements, next.intentType === 'funnel' ? '↓' : '→')
      }
      return { plan: next, changed: true }
    }
    case 'remove_element': {
      if (!patch.targetName) {
        return { plan, changed: false, warning: 'Missing targetName' }
      }
      const idx = next.elements.findIndex(e => e.name === patch.targetName)
      if (idx < 0) {
        return { plan, changed: false, warning: `Element "${patch.targetName}" not found` }
      }
      next.elements.splice(idx, 1)
      next.drawingOrder = next.drawingOrder.filter(n => n !== patch.targetName)
      if (next.intentType === 'flowchart' || next.intentType === 'funnel') {
        next.connections = buildSequentialConnections(next.elements, next.intentType === 'funnel' ? '↓' : '→')
      }
      return { plan: next, changed: true }
    }
    case 'move_element': {
      if (!patch.targetName || !patch.afterName) {
        return { plan, changed: false, warning: 'Missing targetName or afterName' }
      }
      const fromIdx = next.elements.findIndex(e => e.name === patch.targetName)
      const toIdx = next.elements.findIndex(e => e.name === patch.afterName)
      if (fromIdx < 0) {
        return { plan, changed: false, warning: `Element "${patch.targetName}" not found` }
      }
      if (toIdx < 0) {
        return { plan, changed: false, warning: `Target position "${patch.afterName}" not found` }
      }
      const [moved] = next.elements.splice(fromIdx, 1)
      const adjToIdx = next.elements.findIndex(e => e.name === patch.afterName)
      next.elements.splice(adjToIdx + 1, 0, moved)
      const orderMoved = next.drawingOrder.splice(next.drawingOrder.indexOf(patch.targetName), 1)
      next.drawingOrder.splice(next.drawingOrder.indexOf(patch.afterName) + 1, 0, orderMoved[0])
      if (next.intentType === 'flowchart' || next.intentType === 'funnel') {
        next.connections = buildSequentialConnections(next.elements, next.intentType === 'funnel' ? '↓' : '→')
      }
      return { plan: next, changed: true }
    }
    default:
      return { plan, changed: false, warning: `Unknown operation: ${patch.operation}` }
  }
}

async function interpretRevisionPatchWithLLM(
  client: OpenAI,
  basePlan: SketchPlan,
  revision: string
): Promise<RevisionPatch | null> {
  const completion = await client.chat.completions.create({
    model: getActiveModel(),
    messages: [
      { role: 'system', content: REVISION_PATCH_PROMPT },
      {
        role: 'user',
        content: `当前绘图计划：${JSON.stringify(basePlan)}\n\n用户修改意见：${revision}`,
      },
    ],
    temperature: 0.1,
    max_tokens: 500,
    // @ts-expect-error Mimo-specific
    extra_body: { thinking: { type: 'disabled' } },
  })

  const content = completion.choices[0]?.message?.content
    || (completion.choices[0]?.message as Record<string, unknown> | undefined)?.reasoning_content as string | undefined
  if (!content) return null

  try {
    const parsed = JSON.parse(content)
    if (parsed.operation === 'rename_element' || parsed.operation === 'add_element' || parsed.operation === 'remove_element' || parsed.operation === 'move_element' || parsed.operation === 'unknown') {
      return parsed as RevisionPatch
    }
    return null
  } catch {
    const jsonMatch = content.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[0])
        if (parsed.operation === 'rename_element' || parsed.operation === 'add_element' || parsed.operation === 'remove_element' || parsed.operation === 'move_element' || parsed.operation === 'unknown') {
          return parsed as RevisionPatch
        }
      } catch {
        // JSON parse failed on extracted object — not a valid patch
      }
    }
    return null
  }
}

function reviseFallbackPlan(plan: SketchPlan, revision: string): SketchPlan {
  const priorityDetails: string[] = []
  const next: SketchPlan = {
    ...plan,
    elements: plan.elements.map((element) => ({ ...element, details: [...element.details] })),
  }

  if (/星星|星/.test(revision) && !next.elements.some((element) => element.name.includes('星'))) {
    next.elements.push({
      name: '星星',
      position: '月亮周围',
      color: '#eab308',
      role: 'supporting',
      details: ['两到三颗小星星', '分散在月亮附近'],
    })
    priorityDetails.push('两到三颗小星星', '分散在月亮附近')
    next.drawingOrder.push('星星')
  }

  if (/弯|弯弯|月牙/.test(revision)) {
    const moon = next.elements.find((element) => element.name.includes('月'))
    if (moon) {
      moon.details = mergeUnique(moon.details, ['更明显的月牙弧线', '内外两条弯曲弧线'])
      priorityDetails.push('更明显的月牙弧线', '内外两条弯曲弧线')
    }
  }

  if (/头发|辫子/.test(revision)) {
    const person = next.elements.find((element) => /女孩|人物|人/.test(element.name))
    if (person) {
      const hairDetail = /辫子/.test(revision) ? '两条辫子' : '清楚的头发轮廓'
      person.details = mergeUnique(person.details, [hairDetail])
      priorityDetails.push(hairDetail)
    }
  }

  if (/影子/.test(revision)) {
    next.elements.push({
      name: '影子',
      position: '小女孩脚下',
      color: '#111827',
      role: 'supporting',
      details: ['脚下短弧线阴影'],
    })
    priorityDetails.push('脚下短弧线阴影')
    next.drawingOrder.push('影子')
  }

  // Apply directional hints to element positions
  const dirHint = /上|高一点/.test(revision) ? '往上' : /下|低一点/.test(revision) ? '往下' : /左/.test(revision) ? '往左' : /右/.test(revision) ? '往右' : ''
  if (dirHint) {
    next.elements.forEach((element) => {
      element.position = `${element.position}${dirHint}`
    })
  }

  next.previewText = plan.previewText
  return next
}

function mergeUnique(items: string[], extra: string[]): string[] {
  return Array.from(new Set([...items, ...extra].filter(Boolean)))
}

function buildSketchUserPrompt(concept: string, zone?: string | null, approvedPlan?: object | null): string {
  const zoneGrid: Record<string, string> = {
    center:       '画布中央 (x20-30, y20-30)',
    top:          '画布上方 (x20-30, y32-42)',
    bottom:       '画布下方 (x20-30, y8-18)',
    left:         '画布左边 (x6-16, y20-30)',
    right:        '画布右边 (x34-44, y20-30)',
    topLeft:      '画布左上角 (x6-16, y32-42)',
    topRight:     '画布右上角 (x34-44, y32-42)',
    bottomLeft:   '画布左下角 (x6-16, y8-18)',
    bottomRight:  '画布右下角 (x34-44, y8-18)',
  }
  const zoneHint = zone && zoneGrid[zone]
    ? `\n\n位置要求：请将主体放置在${zoneGrid[zone]}范围内。`
    : ''
  const planHint = approvedPlan
    ? `\n\n已批准的绘图计划（必须严格遵循）：${JSON.stringify(approvedPlan)}
Draw every listed element as a separate recognizable part. Respect each element's name, position, color, role, and details. If the plan has connections, draw arrows or lines showing the direction (→ ↓ ↘). The <thinking> tag should describe your composition in your own words based on the plan's compositionRationale. Do not collapse a multi-element scene into one symbol.`
    : ''
  return `You need to produce a clean hand-drawn line-art sketch of: ${concept}${zoneHint}${planHint}

Here are examples of clean, bounded sketches using the format:

${SKETCH_HOUSE_EXAMPLE}

${SKETCH_CAT_EXAMPLE}

Now draw a hand-drawn sketch of: ${concept}

Remember:
- Draw in a loose, natural hand-drawn style — no mechanically perfect shapes
- Keep one-object drawings compact and centered; all important points should stay inside x8..x42 and y8..y42
- Do not create very long stray lines; details should remain attached to the object
- Use the grid coordinates (x1y1 to x${GRID_RES}y${GRID_RES})
- Output in XML format with <thinking>, <strokes>, <s1>, <points>, <t_values>, <id>
- Do NOT wrap output in markdown code fences
- Respond in the same language as the concept description`
}

const REVISION_PATCH_PROMPT = `你是一个绘图计划修订解释器。

你不会生成新的绘图计划。
你只把用户的修改意见转成一个受限制的小编辑操作。

当前绘图计划包含 elements（元素列表）、intentType（图类型）、connections（连线）等。

允许的操作：
- rename_element: 把已有节点改名为新名字
- add_element: 在指定位置添加一个新节点
- remove_element: 删除一个已有节点
- move_element: 把一个已有节点移动到另一个节点后面

规则：
- 不要改变 intentType
- 如果用户说 A 改为 B，理解为把已有元素中最接近 A 的元素改名为 B
- 如果无法判断，返回 {"operation": "unknown", "reason": "..."}

只返回纯 JSON，不要其他内容。

用户说 "X改为Y" / "把X改成Y" / "将X换成Y" →
{"operation": "rename_element", "targetName": "X", "newName": "Y", "confidence": 0.95}

用户说 "在X后面加Y" / "加一个Y" →
{"operation": "add_element", "name": "Y", "afterName": "X", "confidence": 0.9}

用户说 "在X前面加Y" →
{"operation": "add_element", "name": "Y", "beforeName": "X", "confidence": 0.9}

用户说 "加一个Y"（没有指定位置）→
{"operation": "add_element", "name": "Y", "confidence": 0.8}

用户说 "去掉X" / "删除X" / "移除X" →
{"operation": "remove_element", "targetName": "X", "confidence": 0.95}

用户说 "把X放到Y后面" / "把X移到Y后面" →
{"operation": "move_element", "targetName": "X", "afterName": "Y", "confidence": 0.9}
`

const SKETCH_EDIT_SYSTEM_PROMPT = `You are an expert sketch artist who edits existing hand-drawn sketches.

You work on the same numbered grid (1 to ${GRID_RES} on x and y axes, coordinates like 'x1y1').

You receive:
1. An image of the current sketch on the canvas
2. An edit instruction from the user

=== Rules ===
- Study the image carefully to understand what is already drawn
- ONLY modify/add/remove strokes relevant to the instruction
- Keep unrelated strokes EXACTLY as they were — do not redraw them
- If adding new elements, place them in contextually appropriate positions
- Maintain the same hand-drawn style — slight wobbles, no perfect geometry
- Use the same stroke format (points + t_values)

=== Vague instruction handling ===
Users often give vague edit instructions like "加一点细节", "轮廓更清楚", "主体放大一点".
When you receive such instructions:
1. Look at the image and identify what is missing or ambiguous
2. Translate the vague instruction into a concrete visual change
3. Describe your interpretation in <thinking>, then execute

Examples:
- "加一点细节" → add missing texture lines, inner contours, or connecting details that make the subject more recognizable
- "轮廓更清楚" → reinforce the main outline with clearer, more continuous strokes
- "主体放大一点" → scale up the main element while keeping supporting elements in proportion

=== Flowchart / Diagram layout editing ===
When the image shows a flowchart, process diagram, or whiteboard flow AND the user instruction is about layout（排版/布局）, you MUST re-layout the ENTIRE diagram:
- Identify ALL nodes, arrows, and labels in the image
- Output a COMPLETE new set of strokes with proper layout

Layout rules for flowcharts:
- Each node box MUST fully enclose its text label — increase box size if text overflows
- Text labels MUST be centered inside their node boxes (horizontal and vertical center)
- Adjacent nodes need enough horizontal spacing so boxes do not touch or overlap (minimum 3 grid units gap)
- Arrow lines connect adjacent node centers; arrowheads must be visible and point clearly to the next node
- The entire diagram should be centered on the grid (approximately x10..x40, y10..y40)

Interpretations for common layout commands:
- "文字居中" → for each node, ensure the label_point is at the box center; redraw nodes if text doesn't fit
- "宽松一点" or "太窄了" or "散开" → increase horizontal spacing between nodes by 4-6 grid units; keep labels readable
- "框压字" or "框太小" → enlarge boxes so there is at least 2 grid units of padding around every label
- "箭头清楚" or "箭头清楚一点" → ensure arrow lines are straight, visible, and arrowheads are distinct triangles
- "重新排版" → apply ALL layout rules above and output a fully relaid-out diagram

IMPORTANT: For flowchart layout edits, you are expected to OUTPUT ALL STROKES AGAIN with the corrected layout. Do NOT rely on the previous strokes being "kept" — redraw everything with proper positioning.

=== Output format ===
Output ONLY in XML format. NO markdown code fences.

<thinking>Brief analysis of what the image shows, and your editing strategy.</thinking>
<strokes>
  <s1>
    <points>'x...y...', ...</points>
    <t_values>0.00, ...</t_values>
    <id>description</id>
  </s1>
</strokes>

IMPORTANT: Output the COMPLETE set of strokes for the edited sketch — both the kept strokes and the modified/added ones. This replaces the previous sketch entirely.`

const SKETCH_EDIT_ADD_PROMPT = `You are an expert sketch artist adding new elements to an existing hand-drawn sketch.

You work on the same numbered grid (1 to ${GRID_RES} on x and y axes, coordinates like 'x1y1').

You receive:
1. An image of the current sketch on the canvas
2. An instruction to ADD a new element

=== Rules ===
- Study the image carefully to understand what is already drawn
- ONLY output strokes for the NEW element being added
- Do NOT repeat or redraw existing strokes
- Place the new element in the position specified by the user
- Maintain the same hand-drawn style — slight wobbles, no perfect geometry
- Use the same stroke format (points + t_values)

=== Output format ===
Output ONLY in XML format. NO markdown code fences.

<thinking>Brief analysis of what the image shows, and where to place the new element.</thinking>
<strokes>
  <s1>
    <points>'x...y...', ...</points>
    <t_values>0.00, ...</t_values>
    <id>description</id>
  </s1>
</strokes>

IMPORTANT: Output ONLY the strokes for the new element. The system will combine them with the existing sketch.`

// ============================================================
// API Endpoints
// ============================================================

/**
 * POST /api/sketch-plan
 * Generate a structured drawing plan before drawing.
 */
app.post('/api/sketch-plan', async (req, res) => {
  const { text, mode } = req.body

  if (!text || typeof text !== 'string') {
    return res.status(400).json({ ok: false, error: 'Missing text parameter' })
  }

  const modeToSceneType: Record<string, string> = {
    free_draw: 'quick_sketch',
    whiteboard_flow: 'whiteboard',
    story_scene: 'story_scene',
    teaching_diagram: 'teaching_diagram',
  }
  const modeHint = mode && typeof mode === 'string'
    ? `\nSuggested scene type from user interface: ${modeToSceneType[mode] || mode}. Follow this unless the user's words clearly suggest another type.`
    : ''

  if (shouldUseDeterministicFlowchartPlan(text)) {
    return res.json({
      ok: true,
      plan: createFallbackPlan(text),
      warning: 'Used deterministic flowchart plan',
    })
  }

  const client = getOpenAIClient()
  if (!client) {
    return res.json({ ok: true, plan: createFallbackPlan(text), warning: 'LLM not configured; used fallback plan' })
  }

  try {
    const useThinking = shouldUsePlannerThinking(text, mode)
    let completion

    try {
      completion = await client.chat.completions.create({
        model: getActiveModel(),
        messages: [
          { role: 'system', content: SKETCH_PLAN_PROMPT },
          { role: 'user', content: text + modeHint },
        ],
        temperature: 0.3,
        max_tokens: useThinking ? 1200 : 800,
        ...(useThinking ? {} : {
          // @ts-expect-error Mimo-specific
          extra_body: { thinking: { type: "disabled" } },
        }),
      })
    } catch (firstError) {
      if (useThinking && isThinkingParamError(firstError)) {
        console.warn('[SketchPlan] Thinking mode caused param error, retrying without thinking')
        completion = await client.chat.completions.create({
          model: getActiveModel(),
          messages: [
            { role: 'system', content: SKETCH_PLAN_PROMPT },
            { role: 'user', content: text + modeHint },
          ],
          temperature: 0.3,
          max_tokens: 800,
          // @ts-expect-error Mimo-specific
          extra_body: { thinking: { type: "disabled" } },
        })
      } else {
        throw firstError
      }
    }

    const content = completion.choices[0]?.message?.content || (completion.choices[0]?.message as Record<string, unknown> | undefined)?.reasoning_content as string | undefined
    if (!content) {
      return res.json({ ok: false, error: 'No response from LLM' })
    }

    const plan = parseSketchPlan(content, text)
    if (plan) {
      return res.json({ ok: true, plan })
    }

    console.warn('[SketchPlan] Invalid JSON, using local fallback:', content.slice(0, 200))
    return res.json({ ok: true, plan: createFallbackPlan(text), warning: 'Used fallback plan' })
  } catch (error) {
    console.error('[SketchPlan] API error:', error)
    return res.json({ ok: true, plan: createFallbackPlan(text), warning: String(error).slice(0, 200) })
  }
})

/**
 * POST /api/sketch-plan/revise
 * Revise a pending drawing plan from a follow-up voice instruction.
 */
app.post('/api/sketch-plan/revise', async (req, res) => {
  const { plan, revision } = req.body

  if (!plan || typeof plan !== 'object') {
    return res.status(400).json({ ok: false, error: 'Missing plan parameter' })
  }
  if (!revision || typeof revision !== 'string') {
    return res.status(400).json({ ok: false, error: 'Missing revision parameter' })
  }

  const basePlan = normalizePlan(plan, revision)
  if (!basePlan) {
    return res.json({ ok: true, plan: createFallbackPlan(revision), warning: 'Invalid previous plan; used fallback plan' })
  }

  // Step 1: Try deterministic patch parsers first
  let patch: RevisionPatch | null = parseRenamePatch(revision) || parseRemoveElementPatch(revision) || parseMoveElementPatch(revision) || parseAddElementPatch(revision)

  // Step 2: If deterministic failed and LLM available, try LLM patch interpreter
  const client = getOpenAIClient()
  if (!patch && client) {
    try {
      patch = await interpretRevisionPatchWithLLM(client, basePlan, revision)
    } catch (error) {
      console.error('[SketchPlanRevise] LLM patch interpreter error:', error)
    }
  }

  // Step 3: If we have a valid patch, apply it (deterministic code executes the change)
  if (patch && patch.operation !== 'unknown') {
    const result = applyRevisionPatch(basePlan, patch)
    console.log('[SketchPlanRevise] Applied patch:', JSON.stringify(patch), 'changed:', result.changed)
    return res.json({
      ok: true,
      plan: result.plan,
      warning: result.warning,
      revisionPatch: patch,
    })
  }

  // Step 4: Fall back to old full-plan LLM path
  if (client) {
    try {
      const completion = await client.chat.completions.create({
        model: getActiveModel(),
        messages: [
          { role: 'system', content: SKETCH_PLAN_PROMPT },
          {
            role: 'user',
            content: `已有绘图计划：${JSON.stringify(basePlan)}\n\n用户新的语音修改意见：${revision}\n\n请输出修订后的完整 JSON plan。保留原计划中仍然有效的部分，吸收新的修改意见。`,
          },
        ],
        temperature: 0.2,
        max_tokens: 1200,
        // @ts-expect-error Mimo-specific
        extra_body: { thinking: { type: 'disabled' } },
      })

      const content = completion.choices[0]?.message?.content || (completion.choices[0]?.message as Record<string, unknown> | undefined)?.reasoning_content as string | undefined
      if (content) {
        const revisedPlan = parseSketchPlan(content, revision)
        if (revisedPlan) {
          const originalCount = basePlan.elements.length
          const revisedCount = revisedPlan.elements.length
          const droppedElements = originalCount > revisedCount
          if (revisedPlan.intentType !== basePlan.intentType) {
            console.warn('[SketchPlanRevise] LLM changed intentType from', basePlan.intentType, 'to', revisedPlan.intentType, '- rejecting')
            return res.json({ ok: true, plan: reviseFallbackPlan(basePlan, revision), warning: `LLM changed intentType from ${basePlan.intentType} to ${revisedPlan.intentType}; used fallback revision` })
          }
          if (droppedElements && originalCount >= 3) {
            console.warn('[SketchPlanRevise] LLM dropped elements:', originalCount, '->', revisedCount, '- rejecting')
            return res.json({ ok: true, plan: reviseFallbackPlan(basePlan, revision), warning: `LLM dropped elements from ${originalCount} to ${revisedCount}; used fallback revision` })
          }
          return res.json({ ok: true, plan: revisedPlan })
        }
      }
    } catch (error) {
      console.error('[SketchPlanRevise] API error:', error)
      return res.json({ ok: true, plan: reviseFallbackPlan(basePlan, revision), warning: String(error).slice(0, 200) })
    }
  }

  // Step 5: No LLM or all paths failed — use rule-based fallback
  const fallbackResult = reviseFallbackPlan(basePlan, revision)
  const changed = JSON.stringify(fallbackResult.elements) !== JSON.stringify(basePlan.elements)
  return res.json({
    ok: true,
    plan: fallbackResult,
    warning: changed
      ? 'LLM not configured; used fallback revision'
      : 'revision text not recognized, plan unchanged',
  })
})

/**
 * POST /api/sketch
 * Generate a hand-drawn sketch from text description via MiMo.
 */
app.post('/api/sketch', async (req, res) => {
  const { text, zone, approvedPlan } = req.body

  if (!text || typeof text !== 'string') {
    return res.status(400).json({ ok: false, error: 'Missing text parameter' })
  }

  const client = getOpenAIClient()
  if (!client) {
    return res.json({
      ok: true,
      sketch: createFallbackSketchXML(text, approvedPlan),
      warning: 'LLM not configured; used fallback sketch',
    })
  }

  // Deterministic rendering for confirmed structured plans avoids LLM re-interpretation.
  // This is the roadshow-safe path: the model plans semantics, code controls layout.
  if (approvedPlan && typeof approvedPlan === 'object') {
    const layout = req.body.layout as FlowchartLayoutOverrides | undefined
    const flowPlan = normalizePlan(approvedPlan, text)
    if (flowPlan && ['flowchart', 'funnel', 'architecture', 'teaching_diagram'].includes(flowPlan.intentType)) {
      const model = flowPlan.intentType === 'flowchart'
        ? computeFlowchartLayout(flowPlan, text, layout)
        : undefined
      return res.json({
        ok: true,
        sketch: createFallbackSketchXML(text, flowPlan, layout),
        model,
        warning: 'Used deterministic structured renderer',
      })
    }
  }

  try {
    const sceneType = approvedPlan && typeof approvedPlan === 'object' && 'sceneType' in approvedPlan
      ? (approvedPlan as Record<string, unknown>).sceneType as string
      : 'quick_sketch'
    const completion = await withTimeout(
      client.chat.completions.create({
        model: getActiveModel(),
        messages: [
          { role: 'system', content: buildSketchSystemPrompt(sceneType) },
          { role: 'user', content: buildSketchUserPrompt(text, typeof zone === 'string' ? zone : null, approvedPlan || null) },
        ],
        temperature: 0.2,
        max_tokens: 4000,
        // @ts-expect-error Mimo-specific
        extra_body: { thinking: { type: "disabled" } },
      }),
      SKETCH_REQUEST_TIMEOUT_MS,
      'Sketch generation',
    )

    const content = completion.choices[0]?.message?.content || (completion.choices[0]?.message as Record<string, unknown> | undefined)?.reasoning_content as string | undefined
    if (!content) {
      return res.json({
        ok: true,
        sketch: createFallbackSketchXML(text, approvedPlan),
        warning: 'No response from LLM; used fallback sketch',
      })
    }

    if (!isUsableSketchXML(content)) {
      console.warn('[Sketch] Invalid or unsafe XML, using local fallback:', content.slice(0, 200))
      return res.json({
        ok: true,
        sketch: createFallbackSketchXML(text, approvedPlan),
        warning: 'Invalid sketch XML; used fallback sketch',
      })
    }

    console.log('[Sketch] Generated', content.slice(0, 200))
    return res.json({ ok: true, sketch: content })
  } catch (error) {
    console.error('[Sketch] API error, using local fallback:', error)
    return res.json({
      ok: true,
      sketch: createFallbackSketchXML(text, approvedPlan),
      warning: String(error).slice(0, 200),
    })
  }
})

/**
 * POST /api/sketch-flowchart-edit
 * LLM interprets the instruction into a structured edit intent.
 * Code applies the intent to the flowchart model and renders deterministically.
 */
app.post('/api/sketch-flowchart-edit', async (req, res) => {
  const { plan, instruction } = req.body

  if (!plan || typeof plan !== 'object') {
    return res.status(400).json({ ok: false, error: 'Missing plan parameter' })
  }
  if (!instruction || typeof instruction !== 'string') {
    return res.status(400).json({ ok: false, error: 'Missing instruction parameter' })
  }

  const normalizedPlan = normalizePlan(plan, instruction) || createFallbackPlan(instruction)
  if (normalizedPlan.intentType !== 'flowchart') {
    return res.json({ ok: false, error: 'Plan is not a flowchart' })
  }

  const client = getOpenAIClient()
  if (!client) {
    const fallback = interpretFlowchartInstruction(instruction)
    const model = computeFlowchartLayout(normalizedPlan, plan.originalText || instruction, fallback.layout)
    return res.json({
      ok: true,
      explanation: fallback.explanation,
      sketch: renderFlowchartModel(model, normalizedPlan),
      model,
    })
  }

  const nodeLabels = (normalizedPlan.elements || []).map((e: { name: string }) => e.name)

  try {
    const completion = await client.chat.completions.create({
      model: getActiveModel(),
      messages: [
        {
          role: 'system',
          content: `You are a flowchart layout editor. You receive a flowchart with labeled nodes and a Chinese voice instruction.

Your ONLY job: output a JSON object describing the edit intent. DO NOT output XML, strokes, or modified node names.

=== Available fields ===
- explanation: string (required, Chinese, like "我理解为：调整「支付成功」节点的框宽，并重新对齐后续节点")
- targetNode: string (optional, which node label the user is referring to. If the user mentions a specific name like "支付成功", match it to the closest node label from the list)
- actions: string[] (one or more of: "widen" | "centerText" | "spread" | "compact" | "clearArrows" | "relayout")
- layoutOverrides: object (optional numeric overrides)
  - horizontalSpread: number (1.0 default, 1.4 wider, 0.8 tighter)
  - nodeWidthMultiplier: number (1.0 default, 1.3 wider boxes)
  - nodeHeight: number (default 8)

=== Mapping rules ===
- "宽松/太窄/散开/间距大" → actions: ["spread"], horizontalSpread: 1.4
- "紧凑/收紧/太宽/靠拢" → actions: ["compact"], horizontalSpread: 0.8
- "文字居中" → actions: ["centerText"], nodeWidthMultiplier: 1.25, nodeHeight: 10
- "框压字/框太小/格子不对" → actions: ["widen"], nodeWidthMultiplier: 1.4, nodeHeight: 10
- If the user mentions a specific node (e.g. "支付成功那里"), set targetNode to that label
- "箭头清楚" → actions: ["clearArrows"], horizontalSpread: 1.15
- "重新排版" → actions: ["relayout"], horizontalSpread: 1.2, nodeWidthMultiplier: 1.1, nodeHeight: 10
- Multiple instructions → combine actions

Output ONLY the JSON object. No markdown fences.`,
        },
        {
          role: 'user',
          content: `Flowchart nodes: ${JSON.stringify(nodeLabels)}

Instruction: ${instruction}`,
        },
      ],
      temperature: 0.1,
      max_tokens: 400,
      // @ts-expect-error Mimo-specific
      extra_body: { thinking: { type: 'disabled' } },
    })

    const content = completion.choices[0]?.message?.content || (completion.choices[0]?.message as Record<string, unknown> | undefined)?.reasoning_content as string | undefined
    if (!content) {
      const fallback = interpretFlowchartInstruction(instruction)
      return res.json({
        ok: true,
        explanation: fallback.explanation,
        sketch: createFlowchartSketchXML(plan.originalText || instruction, normalizedPlan, fallback.layout),
        model: computeFlowchartLayout(normalizedPlan, plan.originalText || instruction, fallback.layout),
      })
    }

    const cleaned = content.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim()
    let intent: { explanation?: string; targetNode?: string; actions?: string[]; layoutOverrides?: FlowchartLayoutOverrides }
    try {
      intent = JSON.parse(cleaned)
    } catch {
      console.warn('[FlowchartEdit] Invalid JSON, using fallback:', cleaned.slice(0, 200))
      const fallback = interpretFlowchartInstruction(instruction)
      return res.json({
        ok: true,
        explanation: fallback.explanation,
        sketch: createFlowchartSketchXML(plan.originalText || instruction, normalizedPlan, fallback.layout),
        model: computeFlowchartLayout(normalizedPlan, plan.originalText || instruction, fallback.layout),
      })
    }

    // Apply intent to build layout overrides
    const overrides: FlowchartLayoutOverrides = { ...(intent.layoutOverrides || {}) }
    const actions = intent.actions || []
    if (actions.includes('spread') && !overrides.horizontalSpread) overrides.horizontalSpread = 1.4
    if (actions.includes('compact') && !overrides.horizontalSpread) overrides.horizontalSpread = 0.8
    if (actions.includes('widen') && !overrides.nodeWidthMultiplier) overrides.nodeWidthMultiplier = 1.4
    if (actions.includes('centerText')) {
      if (!overrides.nodeWidthMultiplier) overrides.nodeWidthMultiplier = 1.25
      if (!overrides.nodeHeight) overrides.nodeHeight = 10
    }
    if (actions.includes('clearArrows') && !overrides.horizontalSpread) overrides.horizontalSpread = 1.15
    if (actions.includes('relayout')) {
      if (!overrides.horizontalSpread) overrides.horizontalSpread = 1.2
      if (!overrides.nodeWidthMultiplier) overrides.nodeWidthMultiplier = 1.1
      if (!overrides.nodeHeight) overrides.nodeHeight = 10
    }

    // Clamp reasonable ranges
    if (overrides.horizontalSpread) overrides.horizontalSpread = Math.max(0.6, Math.min(1.8, overrides.horizontalSpread))
    if (overrides.nodeWidthMultiplier) overrides.nodeWidthMultiplier = Math.max(0.6, Math.min(1.8, overrides.nodeWidthMultiplier))

    const explanation = intent.explanation || `我理解为：按你"${instruction}"调整流程图布局`
    const model = computeFlowchartLayout(normalizedPlan, plan.originalText || instruction, overrides)

    return res.json({
      ok: true,
      explanation,
      sketch: renderFlowchartModel(model, normalizedPlan),
      model,
      layoutOverrides: overrides,
    })
  } catch (error) {
    console.error('[FlowchartEdit] API error:', error)
    const fallback = interpretFlowchartInstruction(instruction)
    return res.json({
      ok: true,
      explanation: fallback.explanation,
      sketch: createFlowchartSketchXML(plan.originalText || instruction, normalizedPlan, fallback.layout),
      model: computeFlowchartLayout(normalizedPlan, plan.originalText || instruction, fallback.layout),
    })
  }
})

function interpretFlowchartInstruction(instruction: string): { explanation: string; layout: FlowchartLayoutOverrides } {
  const layout: FlowchartLayoutOverrides = {}
  const parts: string[] = []

  const targetMatch = instruction.match(/([一-龥]{2,6})(?:那里|那个|这|那|格子|节点|框|的格)/)
  const targetNode = targetMatch ? targetMatch[1] : undefined

  if (/宽松|太窄|散开|间距大|拉开/.test(instruction)) {
    layout.horizontalSpread = 1.4
    parts.push('整体更宽松')
  }
  if (/紧凑|收紧|太宽|间距小|靠拢/.test(instruction)) {
    layout.horizontalSpread = 0.8
    parts.push('整体更紧凑')
  }
  if (/文字居中/.test(instruction)) {
    layout.nodeWidthMultiplier = 1.25
    layout.nodeHeight = 10
    parts.push('文字居中')
  }
  if (/框压字|框太小|格子不对/.test(instruction)) {
    layout.nodeWidthMultiplier = 1.4
    layout.nodeHeight = 10
    parts.push(targetNode ? `${targetNode}的框加宽` : '框加宽')
  }
  if (/箭头清楚/.test(instruction) && !layout.horizontalSpread) {
    layout.horizontalSpread = 1.15
    parts.push('箭头更清楚')
  }
  if (/重新排版/.test(instruction)) {
    layout.horizontalSpread = 1.2
    layout.nodeWidthMultiplier = 1.15
    layout.nodeHeight = 10
    parts.push('整体重新排版')
  }

  if (layout.horizontalSpread && layout.horizontalSpread < 0.5) layout.horizontalSpread = 0.6
  if (layout.horizontalSpread && layout.horizontalSpread > 2.0) layout.horizontalSpread = 1.8
  if (layout.nodeWidthMultiplier && layout.nodeWidthMultiplier < 0.5) layout.nodeWidthMultiplier = 0.6
  if (layout.nodeWidthMultiplier && layout.nodeWidthMultiplier > 2.0) layout.nodeWidthMultiplier = 1.8

  const explanation = parts.length > 0
    ? `我理解为：${parts.join('，')}`
    : `好的，已按你"${instruction}"调整了流程图`

  return { explanation, layout }
}

/**
 * POST /api/sketch-edit
 * Edit an existing sketch via MiMo with multimodal input (image + text).
 */
app.post('/api/sketch-edit', async (req, res) => {
  const { instruction, currentImage, previousConcept, accumulate } = req.body

  if (!instruction || typeof instruction !== 'string') {
    return res.status(400).json({ ok: false, error: 'Missing instruction parameter' })
  }

  const isAccumulate = accumulate === true
  const client = getOpenAIClient()
  if (!client) {
    if (isAccumulate) {
      return res.json({
        ok: true,
        sketch: createFallbackSketchXML(instruction, createFallbackPlan(instruction)),
        warning: 'LLM not configured; used local additive fallback',
      })
    }
    return res.json({ ok: false, code: 'LLM_NOT_CONFIGURED', error: 'LLM not configured' })
  }

  const editPrompt = isAccumulate ? SKETCH_EDIT_ADD_PROMPT : SKETCH_EDIT_SYSTEM_PROMPT
  const editUserText = isAccumulate
    ? `Current sketch concept: ${previousConcept || 'unknown'}
Add instruction: ${instruction}

Output ONLY the strokes for the new element. Do NOT repeat existing strokes.`
    : `Current sketch concept: ${previousConcept || 'unknown'}
Edit instruction: ${instruction}

Output the COMPLETE updated strokes. Keep all unrelated strokes unchanged, only modify what the instruction asks for.`

  const userContent: OpenAI.Chat.Completions.ChatCompletionContentPart[] = [
    { type: 'text', text: editUserText },
  ]

  if (currentImage && typeof currentImage === 'string' && currentImage.startsWith('data:image/')) {
    userContent.unshift({
      type: 'image_url' as const,
      image_url: { url: currentImage },
    })
  }

  try {
    const completion = await client.chat.completions.create({
      model: getActiveModel(),
      messages: [
        { role: 'system', content: editPrompt },
        { role: 'user', content: userContent as OpenAI.Chat.Completions.ChatCompletionMessage['content'] },
      ],
      temperature: isAccumulate ? 0.2 : 0.3,
      max_tokens: 4000,
      // @ts-expect-error Mimo-specific
      extra_body: { thinking: { type: "disabled" } },
    })

    const content = completion.choices[0]?.message?.content || (completion.choices[0]?.message as Record<string, unknown> | undefined)?.reasoning_content as string | undefined
    if (!content) {
      return res.json({ ok: false, error: 'No response from LLM' })
    }

    if (!isUsableSketchXML(content)) {
      console.warn('[SketchEdit] Invalid or unsafe XML on first attempt, retrying with strict prompt:', content.slice(0, 200))

      // Retry once with a stricter prompt that demands XML-only output
      const retryCompletion = await client.chat.completions.create({
        model: getActiveModel(),
        messages: [
          { role: 'system', content: editPrompt },
          { role: 'user', content: userContent as OpenAI.Chat.Completions.ChatCompletionMessage['content'] },
          { role: 'assistant', content: content },
          { role: 'user', content: 'Your last response was NOT in XML format. You MUST output ONLY valid XML with <strokes>...</strokes>. NO markdown fences, NO extra text outside the XML. Start directly with <thinking> or <strokes>.' },
        ],
        temperature: 0.1,
        max_tokens: 4000,
      })

      const retryContent = retryCompletion.choices[0]?.message?.content || (retryCompletion.choices[0]?.message as Record<string, unknown> | undefined)?.reasoning_content as string | undefined
      if (!retryContent || !isUsableSketchXML(retryContent)) {
        console.warn('[SketchEdit] Retry also failed validation:', retryContent?.slice(0, 200))
        return res.json({ ok: false, code: 'INVALID_XML', error: 'Model returned non-XML response after retry' })
      }

      console.log('[SketchEdit] Retry succeeded:', retryContent.slice(0, 200))
      return res.json({ ok: true, sketch: retryContent })
    }

    console.log('[SketchEdit] Response', content.slice(0, 200))
    return res.json({ ok: true, sketch: content })
  } catch (error) {
    console.error('[SketchEdit] API error:', error)
    const msg = String(error)
    if (/image_url|vision|multimodal|content type|unsupported.*image/i.test(msg)) {
      return res.json({ ok: false, code: 'VISION_NOT_SUPPORTED', error: 'Model does not support image input' })
    }
    return res.json({ ok: false, error: msg.slice(0, 200) })
  }
})

/**
 * POST /api/parse-command (legacy)
 * JSON-based command parsing for non-drawing intents.
 */
app.post('/api/parse-command', async (req, res) => {
  const { text } = req.body

  if (!text || typeof text !== 'string') {
    return res.status(400).json({ ok: false, error: 'Missing text parameter' })
  }

  const client = getOpenAIClient()
  if (!client) {
    return res.json({ ok: false, error: 'LLM not configured' })
  }

  const schema = `{
  "actions": [{
    "type": "add_shape" | "clear_canvas" | "undo" | "ask_clarification",
    "shape"?: {
      "type": "circle" | "ellipse" | "rect" | "line" | "polyline" | "polygon" | "arc" | "text",
      "x"?: number, "y"?: number, "radius"?: number, "startAngle"?: number, "endAngle"?: number,
      "radiusX"?: number, "radiusY"?: number, "width"?: number, "height"?: number,
      "x1"?: number, "y1"?: number, "x2"?: number, "y2"?: number,
      "points"?: [{"x": number, "y": number}],
      "text"?: string, "fontSize"?: number,
      "fill"?: string, "stroke"?: string, "lineWidth"?: number
    },
    "clarification"?: string
  }]
}`

  try {
    const completion = await client.chat.completions.create({
      model: getActiveModel(),
      messages: [
        {
          role: 'system',
          content: `You are a drawing command parser. Convert natural language Chinese commands into JSON.\n\nSchema:\n${schema}\n\n=== Spatial Reference (50×50 Grid) ===\nThe canvas is 800×500 pixels. Think of it as a 50×50 grid for spatial reasoning:\n- x: 1→50 maps to 0→800 pixels (left→right)\n- y: 1→50 maps to 0→500 pixels (bottom→top)\n\n9 spatial zones with approximate pixel centers:\n  center:       (400, 250)   top:       (400, 380)   bottom:    (400, 120)\n  left:         (150, 250)   right:     (650, 250)\n  topLeft:      (150, 380)   topRight:  (650, 380)\n  bottomLeft:   (150, 120)   bottomRight:(650, 120)\n\nUse the grid for spatial reasoning, but return final shape coordinates in pixels.\nWhen the user mentions a spatial location (左边/右边/上面/下面/左上角/右上角/左下角/右下角/中间),\nplace the shape in the corresponding zone. For multiple objects, distribute across different zones.\n\nColors: #ef4444 red, #3b82f6 blue, #22c55e green, #eab308 yellow, #111827 black, #f9fafb white.\nDo NOT wrap in markdown. Output raw JSON.`,
        },
        { role: 'user', content: text },
      ],
      temperature: 0.3,
      max_tokens: 1200,
      // @ts-expect-error Mimo-specific
      extra_body: { thinking: { type: "disabled" } },
    })

    const content = completion.choices[0]?.message?.content || (completion.choices[0]?.message as Record<string, unknown> | undefined)?.reasoning_content as string | undefined
    if (!content) {
      return res.json({ ok: false, error: 'No response from LLM' })
    }

    const cleaned = content.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim()

    try {
      const parsed = JSON.parse(cleaned)
      if (Array.isArray(parsed.actions)) {
        return res.json({ ok: true, actions: parsed.actions })
      }
      if (parsed.type) {
        return res.json({ ok: true, actions: [parsed] })
      }
      return res.json({ ok: false, error: 'No actions in response', raw: cleaned.slice(0, 200) })
    } catch {
      return res.json({ ok: false, error: 'Invalid JSON', raw: cleaned.slice(0, 200) })
    }
  } catch (error) {
    console.error('[Parse] API error:', error)
    return res.json({ ok: false, error: String(error).slice(0, 200) })
  }
})

/**
 * POST /api/config
 * Verify and save runtime LLM configuration.
 */
app.post('/api/config', async (req, res) => {
  const { apiKey, model } = req.body
  let { baseURL } = req.body

  if (!apiKey || typeof apiKey !== 'string') {
    return res.status(400).json({ ok: false, error: 'Missing apiKey' })
  }

  // Sanitize: strip trailing /chat/completions and slashes
  if (baseURL && typeof baseURL === 'string') {
    baseURL = baseURL.replace(/\/chat\/completions\/?$/, '').replace(/\/+$/, '')
  }

  const testBaseURL = (baseURL && typeof baseURL === 'string')
    ? baseURL
    : (runtimeBaseURL || process.env.OPENAI_BASE_URL || 'https://api.xiaomimimo.com/v1')

  const testModel = (model && typeof model === 'string')
    ? model
    : (process.env.OPENAI_MODEL || 'mimo-v2.5')

  const testClient = new OpenAI({ apiKey, baseURL: testBaseURL })

  try {
    const test = await testClient.chat.completions.create({
      model: testModel,
      messages: [{ role: 'user', content: 'hi' }],
      max_tokens: 50,
      temperature: 0,
      // @ts-expect-error extra_body forwards Mimo-specific params
      extra_body: { thinking: { type: 'disabled' } },
    })

    const content = test.choices[0]?.message?.content
      || (test.choices[0]?.message as Record<string, unknown> | undefined)?.reasoning_content as string | undefined

    if (!content) {
      console.log('[Config] Full response:', JSON.stringify(test.choices[0]?.message, null, 2).slice(0, 500))
      return res.json({
        ok: false,
        error: `API connected but returned empty response. Model "${testModel}" may be misconfigured.`,
      })
    }
  } catch (error) {
    const msg = String(error).slice(0, 500)
    const errName = (error as Error)?.constructor?.name || 'Unknown'
    console.error('=== Config Verify Failed ===')
    console.error('  URL:', testBaseURL)
    console.error('  Model:', testModel)
    console.error('  Error type:', errName)
    console.error('  Message:', msg)
    console.error('  Full:', JSON.stringify(error, Object.getOwnPropertyNames(error), 2).slice(0, 500))

    let userMessage = 'Network error'
    if (msg.includes('401') || msg.includes('403') || errName === 'AuthenticationError') userMessage = 'Invalid API Key'
    else if (msg.includes('404') || errName === 'NotFoundError') userMessage = `Model "${testModel}" not found`
    else if (msg.includes('ENOTFOUND') || msg.includes('ECONNREFUSED') || msg.includes('ENETUNREACH') || msg.includes('ETIMEDOUT') || msg.includes('timeout')) userMessage = 'Cannot reach API server'

    return res.json({ ok: false, error: `Verification failed: ${userMessage}. [${errName}] ${msg.slice(0, 100)}` })
  }

  runtimeApiKey = apiKey
  if (baseURL && typeof baseURL === 'string') runtimeBaseURL = baseURL
  if (model && typeof model === 'string') runtimeModel = model
  openai = null

  res.json({ ok: true, verified: true, baseURL: getBaseURL(), model: getActiveModel() })
})

/**
 * GET /api/health
 */
app.get('/api/health', (_req, res) => {
  const client = getOpenAIClient()
  res.json({
    ok: true,
    llmConfigured: !!client,
    baseURL: getBaseURL(),
    model: getActiveModel(),
  })
})

// Start
app.listen(port, () => {
  console.log(`Server running on port ${port}`)
  console.log(`Base URL: ${getBaseURL()}`)
  console.log(`Model: ${getActiveModel()}`)
  console.log(`LLM configured: ${!!getOpenAIClient()}`)
})
