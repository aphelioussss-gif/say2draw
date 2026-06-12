import type { DrawingAction } from '../domain/actions'
import { validateAction, validateBatchActions } from './validateAction'

const LLM_API_ENDPOINT = '/api/parse-command'

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
  try {
    const response = await fetch(LLM_API_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ text: rawText }),
      signal,
    })

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error')
      return { ok: false, error: errorText }
    }

    return await response.json()
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      return { ok: false, error: 'Request aborted' }
    }
    return { ok: false, error: String(error) }
  }
}

export function isLLMEnabled(): boolean {
  // LLM is enabled if the API endpoint is available
  // The actual API key check happens on the server side
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
