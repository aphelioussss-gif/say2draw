import type { CommandRecord, DrawingAction } from './actions'
import type { Shape } from './shapes'

export type DrawingState = {
  shapes: Shape[]
  history: CommandRecord[]
  past: Shape[][]
}

export const initialDrawingState: DrawingState = {
  shapes: [],
  history: [],
  past: [],
}

function createRecord(
  action: DrawingAction,
  status: CommandRecord['status'],
  message: string,
): CommandRecord {
  return {
    id: `${action.type}-${action.createdAt}`,
    rawText: action.rawText,
    parseSource: action.parseSource,
    actionType: action.type,
    status,
    message,
    createdAt: action.createdAt,
  }
}

function pushHistory(state: DrawingState, record: CommandRecord): CommandRecord[] {
  return [record, ...state.history].slice(0, 20)
}

export function drawingReducer(
  state: DrawingState,
  action: DrawingAction,
): DrawingState {
  if (action.type === 'add_shape') {
    return {
      shapes: [...state.shapes, action.shape],
      past: [...state.past, state.shapes],
      history: pushHistory(
        state,
        createRecord(action, 'success', `Added ${action.shape.type}.`),
      ),
    }
  }

  if (action.type === 'clear_canvas') {
    if (state.shapes.length === 0) {
      return {
        ...state,
        history: pushHistory(state, createRecord(action, 'ignored', 'Canvas is already empty.')),
      }
    }

    return {
      shapes: [],
      past: [...state.past, state.shapes],
      history: pushHistory(state, createRecord(action, 'success', 'Canvas cleared.')),
    }
  }

  if (action.type === 'undo') {
    const previousShapes = state.past.at(-1)

    if (!previousShapes) {
      return {
        ...state,
        history: pushHistory(state, createRecord(action, 'ignored', 'Nothing to undo.')),
      }
    }

    return {
      shapes: previousShapes,
      past: state.past.slice(0, -1),
      history: pushHistory(state, createRecord(action, 'success', 'Undid the last action.')),
    }
  }

  if (action.type === 'update_shape') {
    const idx = state.shapes.findIndex((s) => s.id === action.shapeId)
    if (idx === -1) {
      return {
        ...state,
        history: pushHistory(state, createRecord(action, 'ignored', 'Shape not found.')),
      }
    }

    const old = state.shapes[idx]
    const patch = action.patch
    const scale = patch.scale ?? 1
    let next = old

    // Scale handling
    if (scale !== 1) {
      if (old.type === 'circle') {
        next = { ...old, radius: Math.round(old.radius * scale) }
      } else if (old.type === 'ellipse') {
        next = { ...old, radiusX: Math.round(old.radiusX * scale), radiusY: Math.round(old.radiusY * scale) }
      } else if (old.type === 'rect') {
        const dw = Math.round(old.width * (scale - 1) / 2)
        const dh = Math.round(old.height * (scale - 1) / 2)
        next = { ...old, width: Math.round(old.width * scale), height: Math.round(old.height * scale), x: old.x - dw, y: old.y - dh }
      } else if (old.type === 'line') {
        const mx = (old.x1 + old.x2) / 2
        const my = (old.y1 + old.y2) / 2
        next = { ...old, x1: Math.round(mx + (old.x1 - mx) * scale), y1: Math.round(my + (old.y1 - my) * scale), x2: Math.round(mx + (old.x2 - mx) * scale), y2: Math.round(my + (old.y2 - my) * scale) }
      } else if (old.type === 'polygon') {
        next = { ...old, points: old.points.map((p) => ({ x: Math.round(p.x * scale), y: Math.round(p.y * scale) })) }
      } else if (old.type === 'text') {
        next = { ...old, fontSize: Math.round((old.fontSize ?? 36) * scale) }
      }
    } else {
      next = { ...old }
    }

    // Apply direct patch properties (union-safe via switch)
    if (next.type === 'circle') {
      if (patch.x !== undefined) next = { ...next, x: patch.x }
      if (patch.y !== undefined) next = { ...next, y: patch.y }
      if (patch.radius !== undefined) next = { ...next, radius: patch.radius }
    } else if (next.type === 'ellipse') {
      if (patch.x !== undefined) next = { ...next, x: patch.x }
      if (patch.y !== undefined) next = { ...next, y: patch.y }
      if (patch.radiusX !== undefined) next = { ...next, radiusX: patch.radiusX }
      if (patch.radiusY !== undefined) next = { ...next, radiusY: patch.radiusY }
    } else if (next.type === 'rect') {
      if (patch.x !== undefined) next = { ...next, x: patch.x }
      if (patch.y !== undefined) next = { ...next, y: patch.y }
      if (patch.width !== undefined) next = { ...next, width: patch.width }
      if (patch.height !== undefined) next = { ...next, height: patch.height }
    } else if (next.type === 'line') {
      if (patch.x1 !== undefined) next = { ...next, x1: patch.x1 }
      if (patch.y1 !== undefined) next = { ...next, y1: patch.y1 }
      if (patch.x2 !== undefined) next = { ...next, x2: patch.x2 }
      if (patch.y2 !== undefined) next = { ...next, y2: patch.y2 }
    } else if (next.type === 'polygon') {
      // polygon points handled via scale only
    } else if (next.type === 'text') {
      if (patch.x !== undefined) next = { ...next, x: patch.x }
      if (patch.y !== undefined) next = { ...next, y: patch.y }
      if (patch.fontSize !== undefined) next = { ...next, fontSize: patch.fontSize }
    }

    // Common properties
    if (patch.fill !== undefined) next = { ...next, fill: patch.fill }
    if (patch.stroke !== undefined) next = { ...next, stroke: patch.stroke }

    const nextShapes = [...state.shapes]
    nextShapes[idx] = next

    return {
      shapes: nextShapes,
      past: [...state.past, state.shapes],
      history: pushHistory(state, createRecord(action, 'success', `Updated ${old.type}.`)),
    }
  }

  if (action.type === 'generate_sketch') {
    return {
      ...state,
      history: pushHistory(state, createRecord(action, 'success', `Generating sketch: ${action.rawText}`)),
    }
  }

  if (action.type === 'parse_error' || action.type === 'ask_clarification') {
    return {
      ...state,
      history: pushHistory(state, createRecord(action, 'ignored', action.message)),
    }
  }

  return state
}
