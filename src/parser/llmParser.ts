import type { DrawingAction } from '../domain/actions'
import { validateAction, validateBatchActions } from './validateAction'

const LLM_API_ENDPOINT = '/api/parse-command'
const REQUEST_TIMEOUT_MS = 8000

type LLMParserOptions = {
  createdAt?: string
  signal?: AbortSignal
}

type LLMResponse = {
  ok: boolean
  action?: unknown
  actions?: unknown[]
  error?: string
}

async function callLLMProxy(
  rawText: string,
  signal?: AbortSignal,
): Promise<LLMResponse> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)

  // Merge external signal with our timeout signal
  const combinedSignal = signal
    ? AbortSignal.any([signal, controller.signal])
    : controller.signal

  try {
    const response = await fetch(LLM_API_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ text: rawText }),
      signal: combinedSignal,
    })

    clearTimeout(timeoutId)

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error')
      return { ok: false, error: errorText }
    }

    return await response.json()
  } catch (error) {
    clearTimeout(timeoutId)

    if (error instanceof DOMException && error.name === 'AbortError') {
      return { ok: false, error: 'Request timed out or aborted' }
    }
    return { ok: false, error: String(error) }
  }
}

export function isLLMEnabled(): boolean {
  // LLM is always attempted - the server-side will respond with
  // whether it's actually configured. The frontend doesn't know
  // if an API key is set until it tries.
  return true
}

export async function parseWithLLM(
  rawText: string,
  options: LLMParserOptions = {},
): Promise<DrawingAction | null> {
  const { createdAt = new Date().toISOString(), signal } = options

  const response = await callLLMProxy(rawText, signal)

  if (!response.ok) {
    return null
  }

  // Try single action first
  if (response.action) {
    const validated = validateAction(response.action, rawText, createdAt)
    if (validated) {
      return validated
    }
  }

  // Try batch actions
  if (response.actions) {
    const validated = validateBatchActions(response, rawText, createdAt)
    if (validated && validated.length > 0) {
      return validated[0]
    }
  }

  return null
}

export async function parseBatchWithLLM(
  rawText: string,
  options: LLMParserOptions = {},
): Promise<DrawingAction[]> {
  const { createdAt = new Date().toISOString(), signal } = options

  const response = await callLLMProxy(rawText, signal)

  if (!response.ok) {
    return []
  }

  if (response.actions) {
    const validated = validateBatchActions(response, rawText, createdAt)
    if (validated) {
      return validated
    }
  }

  if (response.action) {
    const validated = validateAction(response.action, rawText, createdAt)
    if (validated) {
      return [validated]
    }
  }

  return []
}
