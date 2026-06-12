import type { Shape } from '../domain/shapes'

type DevControlsProps = {
  shapes: Shape[]
}

export function DevControls({ shapes }: DevControlsProps) {
  return (
    <section className="dev-controls" aria-label="Development-only canvas fixtures">
      <p className="label">DEV ONLY</p>
      <p className="content">PR 2 uses fixed test shapes to verify Canvas rendering.</p>
      <ul>
        {shapes.map((shape) => (
          <li key={shape.id}>{shape.type}</li>
        ))}
      </ul>
    </section>
  )
}
