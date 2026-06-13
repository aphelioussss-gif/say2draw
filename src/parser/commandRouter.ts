import type { DrawingAction } from '../domain/actions'
import { parseLocalCommand } from './localParser'
import type { LocalParserOptions } from './parserTypes'

/**
 * Unified command router.
 *
 * Only "清空画布" and "撤销" bypass the LLM.
 * Everything else — regardless of phrasing — goes through the sketch pipeline.
 * The LLM is the single source of truth for intent understanding.
 */
export async function routeCommands(
  rawText: string,
  options: LocalParserOptions = {},
): Promise<DrawingAction[]> {
  const createdAt = options.createdAt ?? new Date().toISOString()

  // Only check for clear/undo — zero latency, zero cost, works offline
  const result = parseLocalCommand(rawText, options)
  if (result.ok) {
    if (result.action.type === 'clear_canvas' || result.action.type === 'undo') {
      return [result.action]
    }
  }

  // Everything else: unified sketch pipeline (LLM handles intent understanding)
  return [{
    type: 'generate_sketch',
    rawText,
    parseSource: 'local',
    createdAt,
    message: `Routing to sketch pipeline: ${rawText}`,
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
  const createdAt = options.createdAt ?? new Date().toISOString()

  const result = parseLocalCommand(rawText, options)
  if (result.ok) {
    if (result.action.type === 'clear_canvas' || result.action.type === 'undo') {
      return result.action
    }
  }

  return {
    type: 'generate_sketch',
    rawText,
    parseSource: 'local',
    createdAt,
    message: `Routing to sketch pipeline: ${rawText}`,
  }
}
