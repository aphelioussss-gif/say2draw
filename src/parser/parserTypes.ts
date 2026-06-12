import type { DrawingAction, ParseSource } from '../domain/actions'

export type ParseSuccess = {
  ok: true
  action: DrawingAction
}

export type ParseFailure = {
  ok: false
  rawText: string
  parseSource: ParseSource
  message: string
  createdAt: string
}

export type ParseResult = ParseSuccess | ParseFailure

export type LocalParserOptions = {
  createdAt?: string
  createId?: () => string
}

export type LocalParserExample = {
  input: string
  expectedActionType: DrawingAction['type']
}
