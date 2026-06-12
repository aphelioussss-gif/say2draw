import type { DrawingAction } from '../domain/actions'
import { parseLocalCommand } from './localParser'
import { isLLMEnabled, parseWithLLM } from './llmParser'
import type { LocalParserOptions } from './parserTypes'

export async function routeCommand(
  rawText: string,
  options: LocalParserOptions = {},
): Promise<DrawingAction> {
  const result = parseLocalCommand(rawText, options)

  if (result.ok) {
    return result.action
  }

  // If LLM is enabled, try LLM fallback
  if (isLLMEnabled()) {
    const llmAction = await parseWithLLM(rawText, {
      createdAt: options.createdAt,
    })

    if (llmAction) {
      return llmAction
    }
  }

  // Fallback to ask_clarification (LLM either not enabled or failed)
  return {
    type: 'parse_error',
    rawText: result.rawText,
    parseSource: 'local',
    createdAt: result.createdAt,
    message: '我不太确定你的意思，能再说详细一点吗？',
  }
}

export function routeCommandSync(
  rawText: string,
  options: LocalParserOptions = {},
): DrawingAction {
  const result = parseLocalCommand(rawText, options)

  if (result.ok) {
    return result.action
  }

  // Fallback to ask_clarification (sync version)
  return {
    type: 'parse_error',
    rawText: result.rawText,
    parseSource: 'local',
    createdAt: result.createdAt,
    message: result.message,
  }
}
