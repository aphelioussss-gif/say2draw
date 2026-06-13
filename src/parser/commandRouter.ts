import type { DrawingAction } from '../domain/actions'
import { parseLocalCommand } from './localParser'
import { isLLMEnabled, parseBatchWithLLM } from './llmParser'
import { isDrawingIntent } from './sketchIntent'
import type { LocalParserOptions } from './parserTypes'

export async function routeCommands(
  rawText: string,
  options: LocalParserOptions = {},
): Promise<DrawingAction[]> {
  const createdAt = options.createdAt ?? new Date().toISOString()

  // 1. Try local parser
  const result = parseLocalCommand(rawText, options)
  if (result.ok) {
    // Control commands (clear, undo) pass through directly
    if (result.action.type === 'clear_canvas' || result.action.type === 'undo') {
      return [result.action]
    }
    // Drawing intents go through unified sketch pipeline
    if (isDrawingIntent(rawText)) {
      return [{
        type: 'generate_sketch',
        rawText,
        parseSource: 'local',
        createdAt,
        message: `Drawing "${rawText}" via sketch pipeline`,
      }]
    }
    return [result.action]
  }

  // 2. Drawing intent without local match → sketch pipeline
  if (isDrawingIntent(rawText)) {
    return [{
      type: 'generate_sketch',
      rawText,
      parseSource: 'local',
      createdAt,
      message: `Generating sketch for: ${rawText}`,
    }]
  }

  // 3. Try LLM batch for non-drawing intents
  if (isLLMEnabled()) {
    const batch = await parseBatchWithLLM(rawText, { createdAt })

    const actionable = batch.filter((a) => a.type !== 'parse_error')
    if (actionable.length > 0) {
      return actionable
    }

    if (batch.length > 0) {
      return batch
    }
  }

  // 4. Fallback
  return [{
    type: 'parse_error',
    rawText: result.rawText,
    parseSource: 'local',
    createdAt: result.createdAt,
    message: result.message || '我不太确定你的意思，能再说详细一点吗？',
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
    // Drawing intents go through sketch pipeline
    if (isDrawingIntent(rawText) &&
        result.action.type !== 'clear_canvas' &&
        result.action.type !== 'undo') {
      return {
        type: 'generate_sketch',
        rawText,
        parseSource: 'local',
        createdAt: result.action.createdAt,
        message: `Drawing "${rawText}" via sketch pipeline`,
      }
    }
    return result.action
  }

  if (isDrawingIntent(rawText)) {
    return {
      type: 'generate_sketch',
      rawText,
      parseSource: 'local',
      createdAt: result.createdAt,
      message: `Generating sketch for: ${rawText}`,
    }
  }

  return {
    type: 'parse_error',
    rawText: result.rawText,
    parseSource: 'local',
    createdAt: result.createdAt,
    message: result.message,
  }
}
