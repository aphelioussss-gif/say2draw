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

const SKETCH_SYSTEM_PROMPT = `You are an expert sketch artist who draws with pen strokes. Your sketches should look hand-drawn, with natural line variation — never mechanically perfect.

You draw on a numbered grid. The grid has numbers 1 to ${GRID_RES} along the bottom (x axis) and numbers 1 to ${GRID_RES} along the left edge (y axis). Each cell is uniquely identified by x and y numbers (e.g., the bottom-left cell is 'x1y1', the top-right is 'x${GRID_RES}y${GRID_RES}').

=== How to specify strokes ===
A sketch is a sequence of strokes. For each stroke, you specify:
- <points>: a list of cell coordinates the stroke passes through
- <t_values>: timing values 0.0 to 1.0 that define the progression of the curve

=== Stroke primitives ===

Curve (smooth, 4+ points):
Points = ['x8y6', 'x6y7', 'x6y10', 'x8y11']
t_values = [0.00, 0.30, 0.80, 1.00]

Large circle (9 points approximately evenly spaced):
Points = ['x25y44', 'x32y41', 'x35y35', 'x31y29', 'x25y27', 'x19y29', 'x15y35', 'x18y41', 'x25y44']
t_values = [0.00, 0.125, 0.25, 0.375, 0.50, 0.625, 0.75, 0.875, 1.00]

Small circle (use fewer points but still approximate):
Points = ['x30y40', 'x33y37', 'x33y33', 'x30y30', 'x27y33', 'x27y37', 'x30y40']
t_values = [0.00, 0.17, 0.33, 0.50, 0.67, 0.83, 1.00]

Corner (sharp angle — repeat the corner point with adjacent t_values):
Points = ['x13y27', 'x18y37', 'x18y37', 'x24y27']
t_values = [0.00, 0.55, 0.50, 1.00]

Rectangle (4 corners, each repeated):
Points = ['x13y27', 'x24y27', 'x24y27', 'x24y11', 'x24y11', 'x13y11', 'x13y11', 'x13y27']
t_values = [0.00, 0.30, 0.25, 0.50, 0.50, 0.75, 0.75, 1.00]

Triangle (3 corners):
Points = ['x10y29', 'x15y33', 'x15y33', 'x9y35']
t_values = [0.00, 0.55, 0.50, 1.00]
Then close with a line: Points = ['x9y35', 'x10y29'], t_values = [0.00, 1.00]

Straight line:
Points = ['x18y31', 'x35y14']
t_values = [0.00, 1.00]

Single dot:
Points = ['x25y25']
t_values = [0.00]

=== Hand-drawn quality ===
- Add small offsets (±0.3 to ±0.5 grid units) to coordinates for a natural hand-drawn feel
- Circles should NOT be perfectly round — use 7-12 points with slight irregularity
- Rectangles should have slightly uneven edges — corners should not be exactly 90 degrees
- Lines should have a subtle wobble — add 1-2 intermediate points offset by ±0.3 grid units
- Text/characters should be drawn as short connected strokes imitating handwriting
- Long strokes should be split into multiple shorter segments

=== Composition ===
- 9 canvas zones (grid coords x/y = 1→50):
  center (x20-30,y20-30)  top (x20-30,y32-42)  bottom (x20-30,y8-18)
  left (x6-16,y20-30)  right (x34-44,y20-30)
  topLeft (x6-16,y32-42)  topRight (x34-44,y32-42)
  bottomLeft (x6-16,y8-18)  bottomRight (x34-44,y8-18)
- Place the main object in the zone requested by the user. Default to center if no zone specified.
- For one requested object, keep the whole object inside x8..x42 and y8..y42.
- Center the main object near x25y25. Do not let ears, whiskers, tails, rays, or limbs touch the canvas edge.
- Use compact proportions: one main body/head, then small attached details.
- Do not make decorative lines longer than the main body unless the object clearly requires it.
- Use 6-14 strokes for a simple object. Avoid messy over-sketching.
- For animals, draw recognizable anatomy: head/body first, ears/legs/tail second, face details last.
- Larger/more important elements first, details second
- Leave breathing room between elements

=== Output format ===
Output ONLY in XML format. NO markdown code fences.

<thinking>Briefly describe your drawing strategy: what parts to draw, the order, and their placement on the grid.</thinking>
<strokes>
  <s1>
    <points>'x...y...', 'x...y...', ...</points>
    <t_values>0.00, 0.30, ...</t_values>
    <id>short descriptive label</id>
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

function buildSketchUserPrompt(concept: string, zone?: string | null): string {
  const zoneHint = zone
    ? `\n\nSpatial placement hint: the user wants this sketch placed in the "${zone}" zone of the canvas. Use grid coordinates appropriate for this zone.`
    : ''
  return `You need to produce a hand-drawn sketch of: ${concept}${zoneHint}

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

// ============================================================
// API Endpoints
// ============================================================

/**
 * POST /api/sketch
 * Generate a hand-drawn sketch from text description via MiMo.
 */
app.post('/api/sketch', async (req, res) => {
  const { text, zone } = req.body

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
        { role: 'user', content: buildSketchUserPrompt(text, typeof zone === 'string' ? zone : null) },
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
  const { instruction, currentImage, previousConcept } = req.body

  if (!instruction || typeof instruction !== 'string') {
    return res.status(400).json({ ok: false, error: 'Missing instruction parameter' })
  }

  const client = getOpenAIClient()
  if (!client) {
    return res.json({ ok: false, error: 'LLM not configured' })
  }

  const userContent: OpenAI.Chat.Completions.ChatCompletionContentPart[] = [
    {
      type: 'text',
      text: `Current sketch concept: ${previousConcept || 'unknown'}\nEdit instruction: ${instruction}\n\nOutput the COMPLETE updated strokes. Keep all unrelated strokes unchanged, only modify what the instruction asks for.`,
    },
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
        { role: 'system', content: SKETCH_EDIT_SYSTEM_PROMPT },
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
