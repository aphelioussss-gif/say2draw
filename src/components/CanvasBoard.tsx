import { forwardRef, useEffect, useRef } from 'react'
import { CANVAS_HEIGHT, CANVAS_WIDTH, type Shape } from '../domain/shapes'

type CanvasBoardProps = {
  shapes: Shape[]
}

const DEFAULT_STROKE = '#1f2937'
const DEFAULT_FILL = 'transparent'
const DEFAULT_LINE_WIDTH = 3

function degreesToRadians(degrees: number) {
  return (degrees * Math.PI) / 180
}

function drawShape(ctx: CanvasRenderingContext2D, shape: Shape) {
  ctx.save()
  ctx.lineWidth = shape.lineWidth ?? DEFAULT_LINE_WIDTH
  ctx.strokeStyle = shape.stroke ?? DEFAULT_STROKE
  ctx.fillStyle = shape.fill ?? DEFAULT_FILL
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'

  if (shape.type === 'circle') {
    ctx.beginPath()
    ctx.arc(shape.x, shape.y, shape.radius, 0, Math.PI * 2)
    if (shape.fill) {
      ctx.fill()
    }
    ctx.stroke()
  }

  if (shape.type === 'ellipse') {
    ctx.beginPath()
    ctx.ellipse(shape.x, shape.y, shape.radiusX, shape.radiusY, 0, 0, Math.PI * 2)
    if (shape.fill) {
      ctx.fill()
    }
    ctx.stroke()
  }

  if (shape.type === 'rect') {
    if (shape.fill) {
      ctx.fillRect(shape.x, shape.y, shape.width, shape.height)
    }
    ctx.strokeRect(shape.x, shape.y, shape.width, shape.height)
  }

  if (shape.type === 'line') {
    ctx.beginPath()
    ctx.moveTo(shape.x1, shape.y1)
    ctx.lineTo(shape.x2, shape.y2)
    ctx.stroke()
  }

  if (shape.type === 'polyline') {
    const [firstPoint, ...restPoints] = shape.points
    if (firstPoint) {
      ctx.beginPath()
      ctx.moveTo(firstPoint.x, firstPoint.y)
      restPoints.forEach((point) => {
        ctx.lineTo(point.x, point.y)
      })
      ctx.stroke()
    }
  }

  if (shape.type === 'polygon') {
    const [firstPoint, ...restPoints] = shape.points
    if (firstPoint) {
      ctx.beginPath()
      ctx.moveTo(firstPoint.x, firstPoint.y)
      restPoints.forEach((point) => {
        ctx.lineTo(point.x, point.y)
      })
      ctx.closePath()
      if (shape.fill) {
        ctx.fill()
      }
      ctx.stroke()
    }
  }

  if (shape.type === 'arc') {
    ctx.beginPath()
    ctx.arc(
      shape.x,
      shape.y,
      shape.radius,
      degreesToRadians(shape.startAngle),
      degreesToRadians(shape.endAngle),
    )
    ctx.stroke()
  }

  if (shape.type === 'text') {
    ctx.font = `${shape.fontSize ?? 32}px -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif`
    ctx.textAlign = shape.align ?? 'center'
    ctx.textBaseline = 'middle'
    if (shape.fill) {
      ctx.fillText(shape.text, shape.x, shape.y)
    } else {
      ctx.strokeText(shape.text, shape.x, shape.y)
    }
  }

  ctx.restore()
}

function drawEmptyState(ctx: CanvasRenderingContext2D) {
  ctx.save()
  ctx.fillStyle = '#7d8794'
  ctx.font = "16px -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText('Say: "画一个红色圆形"', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2)
  ctx.restore()
}

export const CanvasBoard = forwardRef<HTMLCanvasElement, CanvasBoardProps>(
  ({ shapes }, ref) => {
  const internalRef = useRef<HTMLCanvasElement>(null)
  const canvasRef = (ref as React.RefObject<HTMLCanvasElement>) || internalRef

  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')

    if (!canvas || !ctx) {
      return
    }

    const pixelRatio = window.devicePixelRatio || 1
    canvas.width = CANVAS_WIDTH * pixelRatio
    canvas.height = CANVAS_HEIGHT * pixelRatio
    canvas.style.width = `${CANVAS_WIDTH}px`
    canvas.style.height = `${CANVAS_HEIGHT}px`

    ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0)
    ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT)
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT)

    if (shapes.length === 0) {
      drawEmptyState(ctx)
      return
    }

    shapes.forEach((shape) => drawShape(ctx, shape))
  }, [shapes])

  return (
    <canvas
      ref={canvasRef}
      className="canvas-board"
      aria-label="Say2Draw canvas board"
      width={CANVAS_WIDTH}
      height={CANVAS_HEIGHT}
    />
  )
})

CanvasBoard.displayName = 'CanvasBoard'
