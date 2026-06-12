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

  if (action.type === 'parse_error') {
    return {
      ...state,
      history: pushHistory(state, createRecord(action, 'error', action.message)),
    }
  }

  return state
}
