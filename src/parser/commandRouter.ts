import type { DrawingAction } from '../domain/actions'
import { parseLocalCommand } from './localParser'
import type { LocalParserOptions } from './parserTypes'

export function routeCommand(
  rawText: string,
  options: LocalParserOptions = {},
): DrawingAction {
  const result = parseLocalCommand(rawText, options)

  if (result.ok) {
    return result.action
  }

  return {
    type: 'parse_error',
    rawText: result.rawText,
    parseSource: result.parseSource,
    createdAt: result.createdAt,
    message: result.message,
  }
}
