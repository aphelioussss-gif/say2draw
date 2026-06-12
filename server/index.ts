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
  return runtimeBaseURL || process.env.OPENAI_BASE_URL || 'https://api.deepseek.com/v1'
}

function getActiveModel(): string {
  if (runtimeModel) return runtimeModel
  if (process.env.OPENAI_MODEL) return process.env.OPENAI_MODEL
  // Auto-detect default per provider
  const base = getBaseURL()
  if (base.includes('deepseek')) return 'deepseek-chat'
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
  "type": "add_shape" | "clear_canvas" | "undo" | "ask_clarification",
  "shape": {                          // only for add_shape
    "type": "circle" | "rect" | "line" | "text",
    "x": number, "y": number,
    "radius"?: number,                // circle only
    "width"?: number, "height"?: number, // rect only
    "x1"?: number, "y1"?: number, "x2"?: number, "y2"?: number, // line only
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
- If the command is ambiguous, use "type": "ask_clarification" with a Chinese clarification message.
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
      max_tokens: 500,
    })

    const content = completion.choices[0]?.message?.content

    if (!content) {
      return res.json({ ok: false, error: 'No response from LLM' })
    }

    // Strip markdown fences if the model ignores the instruction
    const cleaned = content.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim()

    try {
      const parsed = JSON.parse(cleaned)
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
    : (process.env.OPENAI_MODEL || 'deepseek-chat')

  const testClient = new OpenAI({ apiKey, baseURL: testBaseURL })

  try {
    const test = await testClient.chat.completions.create({
      model: testModel,
      messages: [{ role: 'user', content: 'hi' }],
      max_tokens: 5,
      temperature: 0,
    })

    const reply = test.choices?.[0]?.message?.content
    if (!reply) {
      return res.json({
        ok: false,
        error: `API 连接成功但返回空响应。模型 "${testModel}" 可能不支持，请检查模型名（如 deepseek-chat、deepseek-v4-flash 等）`,
      })
    }
  } catch (error) {
    const msg = String(error).slice(0, 300)
    console.error('Config verify failed:', msg)
    return res.json({
      ok: false,
      error: `验证失败：${msg.includes('401') ? 'API Key 无效' : msg.includes('404') ? '模型名或 Base URL 不正确' : '网络错误或配置不正确'}`,
    })
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
