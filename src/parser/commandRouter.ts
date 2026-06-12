import type { DrawingAction } from '../domain/actions'
import { parseLocalCommand } from './localParser'
import { isLLMEnabled, parseBatchWithLLM } from './llmParser'
import type { LocalParserOptions } from './parserTypes'

export async function routeCommands(
  rawText: string,
  options: LocalParserOptions = {},
): Promise<DrawingAction[]> {
  const createdAt = options.createdAt ?? new Date().toISOString()

  // Try local parser first
  const result = parseLocalCommand(rawText, options)
  if (result.ok) {
    return [result.action]
  }

  // Try LLM batch
  if (isLLMEnabled()) {
    const batch = await parseBatchWithLLM(rawText, { createdAt })

    // Filter out ask_clarification from batch - only keep actionable items
    const actionable = batch.filter((a) => a.type !== 'parse_error')
    if (actionable.length > 0) {
      return actionable
    }

    // If LLM returned only ask_clarification, use that
    if (batch.length > 0) {
      return batch
    }
  }

  // Fallback
  return [{
    type: 'parse_error',
    rawText: result.rawText,
    parseSource: 'local',
    createdAt: result.createdAt,
    message: '我不太确定你的意思，能再说详细一点吗？',
  }]
}

export async function routeCommand(
  rawText: string,
  options: LocalParserOptions = {},
): Promise<DrawingAction> {
  const actions = await routeCommands(rawText, options)
  return actions[0]
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
