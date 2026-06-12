import type { Shape } from './shapes'

export type ParseSource = 'dev' | 'local' | 'llm' | 'unknown'
export type CommandStatus = 'success' | 'ignored' | 'error'

type CommandMeta = {
  rawText: string
  parseSource: ParseSource
  createdAt: string
}

export type DrawingAction =
  | (CommandMeta & {
      type: 'add_shape'
      shape: Shape
    })
  | (CommandMeta & {
      type: 'clear_canvas'
    })
  | (CommandMeta & {
      type: 'undo'
    })

export type CommandRecord = {
  id: string
  rawText: string
  parseSource: ParseSource
  actionType: DrawingAction['type']
  status: CommandStatus
  message: string
  createdAt: string
}
