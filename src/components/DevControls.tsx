import type { Shape } from '../domain/shapes'

type DevControlsProps = {
  shapes: Shape[]
  canUndo: boolean
  onAddShape: () => void
  onClearCanvas: () => void
  onUndo: () => void
}

export function DevControls({
  shapes,
  canUndo,
  onAddShape,
  onClearCanvas,
  onUndo,
}: DevControlsProps) {
  return (
    <section className="dev-controls" aria-label="Development-only canvas fixtures">
      <p className="label">DEV ONLY</p>
      <p className="content">PR 3 uses reducer actions to test add, undo, and clear.</p>
      <div className="dev-actions">
        <button type="button" onClick={onAddShape}>
          Add test shape
        </button>
        <button type="button" onClick={onUndo} disabled={!canUndo}>
          Undo
        </button>
        <button type="button" onClick={onClearCanvas}>
          Clear
        </button>
      </div>
      <ul>
        {shapes.map((shape) => (
          <li key={shape.id}>{shape.type}</li>
        ))}
      </ul>
    </section>
  )
}
