import express from 'express'
import cors from 'cors'
import OpenAI from 'openai'
import { DRAWING_ACTION_SCHEMA } from '../src/parser/actionSchema'

const app = express()
const port = process.env.PORT || 3001

// Middleware
app.use(cors())
app.use(express.json())

// OpenAI client - only initialize if API key is available
let openai: OpenAI | null = null
let runtimeApiKey: string | null = null
let runtimeModel: string | null = null

function getOpenAIClient(): OpenAI | null {
  const apiKey = runtimeApiKey || process.env.OPENAI_API_KEY
  if (!apiKey) {
    return null
  }

  if (openai) {
    return openai
  }

  openai = new OpenAI({ apiKey })
  return openai
}

function getActiveModel(): string {
  return runtimeModel || process.env.OPENAI_MODEL || 'gpt-4o-mini'
}

// Parse command endpoint
app.post('/api/parse-command', async (req, res) => {
  const { text } = req.body

  if (!text || typeof text !== 'string') {
    return res.status(400).json({ ok: false, error: 'Missing text parameter' })
  }

  const client = getOpenAIClient()

  if (!client) {
    return res.status(503).json({
      ok: false,
      error: 'LLM service not configured. Set OPENAI_API_KEY environment variable.',
    })
  }

  try {
    const completion = await client.chat.completions.create({
      model: getActiveModel(),
      messages: [
        {
          role: 'system',
          content: `You are a drawing command parser. Convert natural language drawing commands into structured drawing actions.

Supported actions:
- add_shape: Add a shape (circle, rect, line, text)
- clear_canvas: Clear the canvas
- undo: Undo the last action
- ask_clarification: Ask for clarification if the command is ambiguous

For add_shape, provide shape details:
- circle: x, y, radius, fill, stroke, lineWidth
- rect: x, y, width, height, fill, stroke, lineWidth
- line: x1, y1, x2, y2, stroke, lineWidth
- text: x, y, text, fontSize, fill

Canvas size: 800x500 pixels.
Default colors: #ef4444 (red), #3b82f6 (blue), #22c55e (green), #eab308 (yellow), #111827 (black).

If the command is ambiguous or unclear, use ask_clarification.`,
        },
        {
          role: 'user',
          content: text,
        },
      ],
      response_format: {
        type: 'json_schema',
        json_schema: DRAWING_ACTION_SCHEMA,
      },
      temperature: 0.3,
      max_tokens: 500,
    })

    const content = completion.choices[0]?.message?.content

    if (!content) {
      return res.json({ ok: false, error: 'No response from LLM' })
    }

    try {
      const parsed = JSON.parse(content)
      return res.json({ ok: true, action: parsed })
    } catch {
      return res.json({ ok: false, error: 'Invalid JSON response from LLM' })
    }
  } catch (error) {
    console.error('LLM API error:', error)
    return res.status(500).json({ ok: false, error: 'LLM API error' })
  }
})

// Runtime configuration endpoint
app.post('/api/config', (req, res) => {
  const { apiKey, model } = req.body

  if (!apiKey || typeof apiKey !== 'string') {
    return res.status(400).json({ ok: false, error: 'Missing apiKey parameter' })
  }

  runtimeApiKey = apiKey
  if (model && typeof model === 'string') {
    runtimeModel = model
  }

  // Reset client so it reinitializes with the new key
  openai = null

  res.json({
    ok: true,
    model: getActiveModel(),
  })
})

// Health check
app.get('/api/health', (req, res) => {
  const client = getOpenAIClient()
  res.json({
    ok: true,
    llmConfigured: !!client,
    model: getActiveModel(),
  })
})

// Start server
app.listen(port, () => {
  console.log(`Server running on port ${port}`)
  console.log(`LLM configured: ${!!getOpenAIClient()}`)
})
