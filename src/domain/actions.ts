import type { Shape } from './shapes'

export type ParseSource = 'dev' | 'local' | 'llm' | 'unknown'
export type CommandStatus = 'success' | 'ignored' | 'error'

type CommandMeta = {
  rawText: string
  parseSource: ParseSource
  createdAt: string
}

export type ShapePatch = {
  x?: number
  y?: number
  width?: number
  height?: number
  radius?: number
  radiusX?: number
  radiusY?: number
  x1?: number
  y1?: number
  x2?: number
  y2?: number
  fontSize?: number
  fill?: string
  stroke?: string
  scale?: number
}

export type DrawingAction =
  | (CommandMeta & {
      type: 'add_shape'
      shape: Shape
      zone?: string | null
    })
  | (CommandMeta & {
      type: 'clear_canvas'
    })
  | (CommandMeta & {
      type: 'undo'
    })
  | (CommandMeta & {
      type: 'update_shape'
      shapeId: string
      patch: ShapePatch
    })
  | (CommandMeta & {
      type: 'generate_sketch'
      message: string
    })
  | (CommandMeta & {
      type: 'parse_error'
      message: string
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

export type ActiveSketch = {
  objectName: string
  shapeIds: string[]
  initialShapes: import('./shapes').Shape[]
  round: number
}
