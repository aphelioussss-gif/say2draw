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

const SKETCH_SYSTEM_PROMPT = `You are an expert sketch artist specializing in minimal hand-drawn line art. Your sketches are clean, readable, and communication-focused — like whiteboard drawings or notebook doodles, not fine art.

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

=== Style rules ===
- Clean, minimal line art. No shading, no fill, no textures.
- Clear outlines with the fewest strokes needed for recognition.
- Whiteboard / notebook style: slight natural irregularity, but intentionally readable.
- Do NOT add random wobbles, decorative strokes, or overly long stray lines.
- Long strokes should be split into connected shorter segments.
- Text/characters: short connected handwriting strokes.

=== Composition ===
- Place objects in the zone requested by the user. Default to center if no zone specified.
- Keep objects inside x8..x42 and y8..y42.
- Use 4-20 strokes per object. Simple objects use fewer; complex objects use more.
- Draw main body first, then attached details (ears, legs, tail, face).
- Larger elements first, smaller details second.
- Leave breathing room between elements.

=== Output format ===
Output ONLY in XML. NO markdown fences.

<thinking>Brief drawing strategy: parts, order, placement, colors.</thinking>
<strokes>
  <s1>
    <points>'x...y...', ...</points>
    <t_values>0.00, ...</t_values>
    <id>description</id>
    <color>#ef4444</color>  <!-- optional, omit for black -->
  </s1>
</strokes>`

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

const SKETCH_PLAN_PROMPT = `You are a drawing planner for a voice-controlled sketch tool. Your job is to analyze what the user wants to draw and produce a structured plan BEFORE any drawing happens.

The tool draws minimal hand-drawn line art using only six colors: black (#111827), red (#ef4444), blue (#3b82f6), green (#22c55e), yellow (#eab308), white (#f9fafb).

Given the user's spoken command, output a JSON plan:
{
  "sceneType": "quick_sketch" | "whiteboard" | "story_scene" | "teaching_diagram",
  "previewText": "short Chinese sentence describing what will be drawn",
  "layoutBrief": "Chinese composition brief with positions, scale, spacing, and relationship between elements",
  "styleBrief": "Chinese visual style brief for recognizable minimal line art",
  "elements": [{
    "name": "Chinese name of the element",
    "position": "Chinese position description (中间/左上角/右边/下面 etc.)",
    "color": "#111827" | "#ef4444" | "#3b82f6" | "#22c55e" | "#eab308" | "#f9fafb",
    "role": "main" | "supporting" | "label",
    "details": ["2-4 concrete drawable details, e.g. 弯月弧线, 长头发, 裙摆, 星星"]
  }],
  "drawingOrder": ["element names in order"],
  "detailChecklist": ["3-6 concrete details that must appear in the sketch"],
  "avoid": ["2-4 mistakes to avoid"],
  "polishHints": ["3-5 natural Chinese refinement commands the user can say after drawing"]
}

Rules:
- Default color is black (#111827). Only use other colors when the user explicitly mentions them.
- If the user says an unsupported color (e.g., purple, orange), map it to the nearest palette color.
- Do not make a shallow plan. Split scenes into multiple drawable elements.
- Include concrete visible details that help the sketch stay recognizable.
- Keep previewText concise (one sentence, under 30 Chinese characters).
- Output ONLY the JSON object. No markdown fences. No extra text.`

type SketchPlan = {
  sceneType: 'quick_sketch' | 'whiteboard' | 'story_scene' | 'teaching_diagram'
  previewText: string
  layoutBrief: string
  styleBrief: string
  elements: Array<{
    name: string
    position: string
    color: string
    role: 'main' | 'supporting' | 'label'
    details: string[]
  }>
  drawingOrder: string[]
  detailChecklist: string[]
  avoid: string[]
  polishHints: string[]
}

const PLAN_COLORS = new Set(['#111827', '#ef4444', '#3b82f6', '#22c55e', '#eab308', '#f9fafb'])

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
  const elements = rawElements
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
        details: ['清晰轮廓', '关键特征'],
      }]

  const sceneTypes = new Set(['quick_sketch', 'whiteboard', 'story_scene', 'teaching_diagram'])
  const sceneType = typeof data.sceneType === 'string' && sceneTypes.has(data.sceneType)
    ? data.sceneType as SketchPlan['sceneType']
    : inferSceneType(originalText)

  return {
    sceneType,
    previewText: typeof data.previewText === 'string' && data.previewText.trim()
      ? data.previewText.trim().slice(0, 40)
      : buildFallbackPreview(originalText),
    layoutBrief: typeof data.layoutBrief === 'string' && data.layoutBrief.trim()
      ? data.layoutBrief.trim()
      : buildFallbackLayoutBrief(safeElements),
    styleBrief: typeof data.styleBrief === 'string' && data.styleBrief.trim()
      ? data.styleBrief.trim()
      : '用干净的手绘线条表达主体，减少无意义笔画，保证每个元素可辨认。',
    elements: safeElements,
    drawingOrder: Array.isArray(data.drawingOrder) && data.drawingOrder.every((item) => typeof item === 'string')
      ? data.drawingOrder as string[]
      : safeElements.map((item) => item.name),
    detailChecklist: normalizeStringArray(data.detailChecklist, safeElements.flatMap((item) => item.details).slice(0, 6)),
    avoid: normalizeStringArray(data.avoid, ['不要把所有元素堆在一起', '不要省略主体的关键特征']),
    polishHints: Array.isArray(data.polishHints) && data.polishHints.every((item) => typeof item === 'string')
      ? (data.polishHints as string[]).slice(0, 5)
      : buildFallbackPolishHints(originalText),
  }
}

function normalizeStringArray(value: unknown, fallback: string[]): string[] {
  if (!Array.isArray(value)) return fallback
  const items = value
    .filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
    .map((item) => item.trim())
  return items.length > 0 ? items : fallback
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

function inferSceneType(text: string): SketchPlan['sceneType'] {
  if (/流程|步骤|箭头|关系|图/.test(text)) return 'whiteboard'
  if (/绕|表示|解释|讲解|课堂/.test(text)) return 'teaching_diagram'
  if (/站|坐|下面|旁边|故事|场景/.test(text)) return 'story_scene'
  return 'quick_sketch'
}

function buildFallbackPreview(text: string): string {
  const subject = text.replace(/^(请)?画(一个|一只|一幅|一下)?/, '').trim() || text
  return `将绘制${subject}`.slice(0, 40)
}

function buildFallbackLayoutBrief(elements: SketchPlan['elements']): string {
  return elements
    .map((element) => `${element.name}放在${element.position}`)
    .join('，') || '主体放在画布中间，保持元素之间有留白。'
}

function buildFallbackPolishHints(text: string): string[] {
  if (/月亮|女孩/.test(text)) {
    return ['月亮更弯一点', '给女孩加头发', '加两颗星星', '女孩小一点']
  }
  if (/流程|步骤/.test(text)) {
    return ['箭头更明显', '节点分开一点', '加上文字标签']
  }
  if (/太阳|树/.test(text)) {
    return ['太阳放右上角', '树大一点', '加一条地平线']
  }
  return ['轮廓更清楚', '加一点细节', '主体放大一点']
}

function createFallbackPlan(text: string): SketchPlan {
  const subject = text.replace(/^(请)?画(一个|一只|一幅|一下)?/, '').trim() || text
  const elements = inferFallbackElements(text, subject)
  return {
    sceneType: inferSceneType(text),
    previewText: buildFallbackPreview(text),
    layoutBrief: buildFallbackLayoutBrief(elements),
    styleBrief: '用极简手绘线条，先画主体轮廓，再补关键细节。',
    elements,
    drawingOrder: elements.map((element) => element.name),
    detailChecklist: elements.flatMap((element) => element.details).slice(0, 6),
    avoid: ['不要只画抽象符号', '不要把元素挤在同一个位置'],
    polishHints: buildFallbackPolishHints(text),
  }
}

function inferFallbackElements(text: string, subject: string): SketchPlan['elements'] {
  const elements: SketchPlan['elements'] = []

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
      position: /左/.test(text) ? '左上角' : '右上角',
      color: /红/.test(text) ? '#ef4444' : '#eab308',
      role: 'supporting',
      details: ['圆形太阳', '短射线'],
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

  return [{
    name: subject,
    position: /下面|下方/.test(text) ? '下方' : '中间',
    color: '#111827',
    role: 'main',
    details: ['清晰轮廓', '关键特征'],
  }]
}

function reviseFallbackPlan(plan: SketchPlan, revision: string): SketchPlan {
  const priorityDetails: string[] = []
  const next: SketchPlan = {
    ...plan,
    elements: plan.elements.map((element) => ({ ...element, details: [...element.details] })),
    detailChecklist: [...plan.detailChecklist],
    avoid: [...plan.avoid],
    polishHints: [...plan.polishHints],
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

  if (/上|高一点/.test(revision)) {
    next.layoutBrief = `${next.layoutBrief}；按修改意见把相关元素往上调整。`
  } else if (/下|低一点/.test(revision)) {
    next.layoutBrief = `${next.layoutBrief}；按修改意见把相关元素往下调整。`
  } else if (/左/.test(revision)) {
    next.layoutBrief = `${next.layoutBrief}；按修改意见把相关元素往左调整。`
  } else if (/右/.test(revision)) {
    next.layoutBrief = `${next.layoutBrief}；按修改意见把相关元素往右调整。`
  }

  next.detailChecklist = mergeUnique([
    ...priorityDetails,
    ...next.elements.flatMap((element) => element.details),
    ...next.detailChecklist,
  ], []).slice(0, 10)
  next.polishHints = mergeUnique(['确认开始画', '再加一点细节', ...next.polishHints], []).slice(0, 5)
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
Draw every listed element as a separate recognizable part. Respect layoutBrief, styleBrief, detailChecklist, avoid, each element's details, position, and drawingOrder. If the plan describes a scene, do not collapse it into one symbol.`
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
  const { text } = req.body

  if (!text || typeof text !== 'string') {
    return res.status(400).json({ ok: false, error: 'Missing text parameter' })
  }

  const client = getOpenAIClient()
  if (!client) {
    return res.json({ ok: true, plan: createFallbackPlan(text), warning: 'LLM not configured; used fallback plan' })
  }

  try {
    const completion = await client.chat.completions.create({
      model: getActiveModel(),
      messages: [
        { role: 'system', content: SKETCH_PLAN_PROMPT },
        { role: 'user', content: text },
      ],
      temperature: 0.3,
      max_tokens: 800,
      // @ts-expect-error Mimo-specific
      extra_body: { thinking: { type: "disabled" } },
    })

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

  const client = getOpenAIClient()
  if (!client) {
    return res.json({ ok: true, plan: reviseFallbackPlan(basePlan, revision), warning: 'LLM not configured; used fallback revision' })
  }

  try {
    const completion = await client.chat.completions.create({
      model: getActiveModel(),
      messages: [
        { role: 'system', content: SKETCH_PLAN_PROMPT },
        {
          role: 'user',
          content: `已有绘图计划：${JSON.stringify(basePlan)}

用户新的语音修改意见：${revision}

请输出修订后的完整 JSON plan。保留原计划中仍然有效的部分，吸收新的修改意见。`,
        },
      ],
      temperature: 0.2,
      max_tokens: 1200,
      // @ts-expect-error Mimo-specific
      extra_body: { thinking: { type: "disabled" } },
    })

    const content = completion.choices[0]?.message?.content || (completion.choices[0]?.message as Record<string, unknown> | undefined)?.reasoning_content as string | undefined
    if (!content) {
      return res.json({ ok: true, plan: reviseFallbackPlan(basePlan, revision), warning: 'No response from LLM; used fallback revision' })
    }

    const revisedPlan = parseSketchPlan(content, revision)
    if (revisedPlan) {
      return res.json({ ok: true, plan: revisedPlan })
    }

    console.warn('[SketchPlanRevise] Invalid JSON, using fallback:', content.slice(0, 200))
    return res.json({ ok: true, plan: reviseFallbackPlan(basePlan, revision), warning: 'Used fallback revision' })
  } catch (error) {
    console.error('[SketchPlanRevise] API error:', error)
    return res.json({ ok: true, plan: reviseFallbackPlan(basePlan, revision), warning: String(error).slice(0, 200) })
  }
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
    return res.json({ ok: false, error: 'LLM not configured' })
  }

  try {
    const completion = await client.chat.completions.create({
      model: getActiveModel(),
      messages: [
        { role: 'system', content: SKETCH_SYSTEM_PROMPT },
        { role: 'user', content: buildSketchUserPrompt(text, typeof zone === 'string' ? zone : null, approvedPlan || null) },
      ],
      temperature: 0.3,
      max_tokens: 4000,
      // @ts-expect-error Mimo-specific
      extra_body: { thinking: { type: "disabled" } },
    })

    const content = completion.choices[0]?.message?.content || (completion.choices[0]?.message as Record<string, unknown> | undefined)?.reasoning_content as string | undefined
    if (!content) {
      return res.json({ ok: false, error: 'No response from LLM' })
    }

    console.log('[Sketch] Generated', content.slice(0, 200))
    return res.json({ ok: true, sketch: content })
  } catch (error) {
    console.error('[Sketch] API error:', error)
    return res.json({ ok: false, error: String(error).slice(0, 200) })
  }
})

/**
 * POST /api/sketch-edit
 * Edit an existing sketch via MiMo with multimodal input (image + text).
 */
app.post('/api/sketch-edit', async (req, res) => {
  const { instruction, currentImage, previousConcept, accumulate } = req.body

  if (!instruction || typeof instruction !== 'string') {
    return res.status(400).json({ ok: false, error: 'Missing instruction parameter' })
  }

  const client = getOpenAIClient()
  if (!client) {
    return res.json({ ok: false, error: 'LLM not configured' })
  }

  const isAccumulate = accumulate === true
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
      temperature: 0.3,
      max_tokens: 4000,
      // @ts-expect-error Mimo-specific
      extra_body: { thinking: { type: "disabled" } },
    })

    const content = completion.choices[0]?.message?.content || (completion.choices[0]?.message as Record<string, unknown> | undefined)?.reasoning_content as string | undefined
    if (!content) {
      return res.json({ ok: false, error: 'No response from LLM' })
    }

    console.log('[SketchEdit] Response', content.slice(0, 200))
    return res.json({ ok: true, sketch: content })
  } catch (error) {
    console.error('[SketchEdit] API error:', error)
    return res.json({ ok: false, error: String(error).slice(0, 200) })
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
