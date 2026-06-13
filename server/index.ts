import express from 'express'
import cors from 'cors'
import OpenAI from 'openai'

const app = express()
const port = process.env.PORT || 3001

app.use(cors())
app.use(express.json())

// Runtime overrides (set via /api/config)
let openai: OpenAI | null = null
let runtimeApiKey: string | null = null
let runtimeBaseURL: string | null = null
let runtimeModel: string | null = null

function getBaseURL(): string {
  return runtimeBaseURL || process.env.OPENAI_BASE_URL || 'https://api.deepseek.com'
}

function getActiveModel(): string {
  if (runtimeModel) return runtimeModel
  if (process.env.OPENAI_MODEL) return process.env.OPENAI_MODEL
  const base = getBaseURL()
  if (base.includes('deepseek')) return 'deepseek-v4-flash'
  if (base.includes('mimo')) return 'mimo-chat'
  return 'gpt-4o-mini'
}

function getOpenAIClient(): OpenAI | null {
  const apiKey = runtimeApiKey || process.env.OPENAI_API_KEY
  if (!apiKey) return null
  if (openai) return openai

  openai = new OpenAI({ apiKey, baseURL: getBaseURL() })
  return openai
}

// Inline schema for the system prompt (json_object mode)
const OUTPUT_SCHEMA_TEXT = `{
  "actions"?: [                       // preferred for scenes or objects decomposed into multiple shapes
    {
      "type": "add_shape" | "clear_canvas" | "undo" | "ask_clarification",
      "shape"?: {                     // only for add_shape
        "type": "circle" | "ellipse" | "rect" | "line" | "polyline" | "polygon" | "arc" | "text",
        "x"?: number, "y"?: number,
        "radius"?: number,            // circle only
        "startAngle"?: number, "endAngle"?: number, // arc only, degrees
        "radiusX"?: number, "radiusY"?: number, // ellipse only
        "width"?: number, "height"?: number, // rect only
        "x1"?: number, "y1"?: number, "x2"?: number, "y2"?: number, // line only
        "points"?: [{ "x": number, "y": number }], // polyline 2-10 points, polygon 3-8 points
        "text"?: string, "fontSize"?: number, // text only
        "fill"?: string, "stroke"?: string, "lineWidth"?: number
      },
      "clarification"?: string        // only for ask_clarification
    }
  ],
  "type"?: "add_shape" | "clear_canvas" | "undo" | "ask_clarification", // allowed for simple single action
  "shape"?: {
    "type": "circle" | "ellipse" | "rect" | "line" | "polyline" | "polygon" | "arc" | "text",
    "x": number, "y": number,
    "radius"?: number,                // circle only
    "startAngle"?: number, "endAngle"?: number, // arc only, degrees
    "radiusX"?: number, "radiusY"?: number, // ellipse only
    "width"?: number, "height"?: number, // rect only
    "x1"?: number, "y1"?: number, "x2"?: number, "y2"?: number, // line only
    "points"?: [{ "x": number, "y": number }], // polyline 2-10 points, polygon 3-8 points
    "text"?: string, "fontSize"?: number, // text only
    "fill"?: string, "stroke"?: string, "lineWidth"?: number
  },
  "clarification"?: string           // only for ask_clarification
}`

// Parse command endpoint
app.post('/api/parse-command', async (req, res) => {
  const { text } = req.body

  if (!text || typeof text !== 'string') {
    return res.status(400).json({ ok: false, error: 'Missing text parameter' })
  }

  const client = getOpenAIClient()

  if (!client) {
    return res.json({
      ok: false,
      error: 'LLM service not configured. Set OPENAI_API_KEY or use the in-app config panel.',
    })
  }

  const systemPrompt = `You are a drawing command parser. Convert natural language Chinese drawing commands into a JSON object.

Output ONLY a JSON object matching this schema:
${OUTPUT_SCHEMA_TEXT}

Rules:
- Canvas size is 800x500 pixels.
- For add_shape, always provide a "shape" object with at least "type".
- Supported colors (hex): #ef4444 (red), #3b82f6 (blue), #22c55e (green), #eab308 (yellow), #111827 (black).
- Use only these shape types: circle, ellipse, rect, line, polyline, polygon, arc, text.
- polyline and arc are stroke-only shapes.
- Arc angles are in degrees.
- You can map common concepts to shapes: person=circle head+line/polyline body/arms/legs, sun=circle+line rays, tree=rect/polygon trunk+ellipse/circle crown+polyline branches, house=rect+polygon roof, face=circle+circle eyes+arc mouth, mountain=polyline, river=polyline/arc, cloud=multiple arcs/ellipses.
- IMPORTANT: Do not ask the user which primitive shapes to use for common visible objects. People, faces, trees, houses, sun, clouds, mountains, rivers, flowers, cars, cats, and similar drawable objects MUST be decomposed by you.
- Use ask_clarification only when the request is ambiguous, abstract, non-visual, or impossible to represent with the supported primitives.

=== Object Decomposition ===
When the user describes an object or scene, follow these rules:
1. DECOMPOSE complex objects into 3-8 semantic parts from [circle, ellipse, rect, line, polyline, polygon, arc, text].
2. Main body FIRST (largest), details SECOND (smaller).
3. Use POSITION to show relationship: eyes INSIDE face, roof ABOVE wall, rays AROUND center.
4. Vary SIZES: main body bigger, details smaller.
5. If you CANNOT decompose meaningfully after trying semantic parts, use ask_clarification.
6. Never represent a complex object with only one primitive unless the user explicitly asks for that primitive shape.
7. For people, animals, plants, buildings, or natural objects, identify semantic parts first, then map each part to primitives.
8. Use polyline for open connected strokes such as arms, legs, branches, grass, mountains, roads, rivers, lightning, and paths.
9. Use arc for curved strokes such as smiles, moons, cloud outlines, waves, and curved branches.
10. For "小人" or "person", output head, body, two arms, and two legs as separate shapes. Do not ask for clarification.

=== Composition ===
- Do NOT place every object at canvas center (400, 250).
- Use the full canvas: sun at upper-right, ground at bottom, trees at left.
- Overlapping shapes can create depth.
- Leave breathing room around objects.
- Do NOT wrap the JSON in markdown code fences. Output raw JSON only.`

  try {
    const completion = await client.chat.completions.create({
      model: getActiveModel(),
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: text },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.3,
      max_tokens: 800,
    })

    const content = completion.choices[0]?.message?.content
      || (completion.choices[0]?.message as Record<string, unknown> | undefined)?.reasoning_content as string | undefined

    if (!content) {
      return res.json({ ok: false, error: 'No response from LLM' })
    }

    // Strip markdown fences if the model ignores the instruction
    const cleaned = content.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim()

    try {
      const parsed = JSON.parse(cleaned)
      if (Array.isArray(parsed.actions)) {
        return res.json({ ok: true, actions: parsed.actions })
      }
      return res.json({ ok: true, action: parsed })
    } catch {
      return res.json({ ok: false, error: 'Invalid JSON response from LLM', raw: cleaned.slice(0, 200) })
    }
  } catch (error) {
    console.error('LLM API error:', error)
    return res.json({ ok: false, error: 'LLM API error: ' + String(error).slice(0, 200) })
  }
})

// Runtime configuration endpoint - verifies the key works before saving
app.post('/api/config', async (req, res) => {
  const { apiKey, baseURL, model } = req.body

  if (!apiKey || typeof apiKey !== 'string') {
    return res.status(400).json({ ok: false, error: 'Missing apiKey parameter' })
  }

  // Build a temporary client to test
  const testBaseURL = (baseURL && typeof baseURL === 'string')
    ? baseURL
    : (runtimeBaseURL || process.env.OPENAI_BASE_URL || 'https://api.deepseek.com')
  const testModel = (model && typeof model === 'string')
    ? model
    : (process.env.OPENAI_MODEL || 'deepseek-v4-flash')

  const testClient = new OpenAI({ apiKey, baseURL: testBaseURL })

  try {
    const test = await testClient.chat.completions.create({
      model: testModel,
      messages: [{ role: 'user', content: 'hi' }],
      max_tokens: 50,
      temperature: 0,
    })

    const reply = test.choices?.[0]?.message?.content
      || (test.choices?.[0]?.message as Record<string, unknown> | undefined)?.reasoning_content as string | undefined
    if (!reply) {
      return res.json({
        ok: false,
        error: `API 连接成功但返回空响应。模型 "${testModel}" 异常，请检查 Key 和模型名`,
      })
    }
  } catch (error) {
    const msg = String(error).slice(0, 500)
    console.error('Config verify failed:')
    console.error('  Base URL:', testBaseURL)
    console.error('  Model:', testModel)
    console.error('  Error:', msg)

    let userMessage = '网络错误或配置不正确'
    if (msg.includes('401') || msg.includes('403')) userMessage = 'API Key 无效'
    else if (msg.includes('404')) userMessage = `模型 "${testModel}" 不存在`
    else if (msg.includes('ENOTFOUND') || msg.includes('ECONNREFUSED')) userMessage = '无法连接到 API 服务器'
    else if (msg.includes('timeout') || msg.includes('ETIMEDOUT')) userMessage = '连接超时，请检查网络'

    return res.json({ ok: false, error: `验证失败：${userMessage}。${msg.slice(0, 100)}` })
  }

  // Verification passed - save
  runtimeApiKey = apiKey
  if (baseURL && typeof baseURL === 'string') runtimeBaseURL = baseURL
  if (model && typeof model === 'string') runtimeModel = model

  openai = null // reinit client

  res.json({
    ok: true,
    verified: true,
    baseURL: getBaseURL(),
    model: getActiveModel(),
  })
})

// Health check
app.get('/api/health', (req, res) => {
  const client = getOpenAIClient()
  res.json({
    ok: true,
    llmConfigured: !!client,
    baseURL: getBaseURL(),
    model: getActiveModel(),
  })
})

// Start server
app.listen(port, () => {
  console.log(`Server running on port ${port}`)
  console.log(`LLM configured: ${!!getOpenAIClient()}`)
  console.log(`Base URL: ${getBaseURL()}`)
  console.log(`Model: ${getActiveModel()}`)
})
