import type { FlowchartModel } from '../sketch/flowchartTypes'

type FlowchartLayerProps = {
  model: FlowchartModel | null | undefined
  width: number
  height: number
}

type PixelNode = {
  label: string
  x: number
  y: number
  width: number
  height: number
}

const NODE_HEIGHT = 72
const STROKE = '#1f2937'
const HAND_FONT = "'Kaiti SC', STKaiti, 'Xingkai SC', 'Songti SC', cursive"
const LABEL_CHUNK_SIZE = 5

function splitLabel(label: string): string[] {
  if (label.length <= LABEL_CHUNK_SIZE) return [label]
  const lines: string[] = []
  for (let index = 0; index < label.length; index += LABEL_CHUNK_SIZE) {
    lines.push(label.slice(index, index + LABEL_CHUNK_SIZE))
  }
  return lines
}

function estimateNodeWidth(label: string): number {
  const maxLineLength = Math.max(...splitLabel(label).map((line) => line.length), 1)
  return Math.max(104, Math.min(184, maxLineLength * 20 + 46))
}

function gridXToPixel(gridX: number, canvasWidth: number): number {
  return ((gridX - 0.5) / 50) * canvasWidth
}

function gridYToPixel(gridY: number, canvasHeight: number): number {
  return canvasHeight - ((gridY - 0.5) / 50) * canvasHeight
}

function layoutNodes(model: FlowchartModel, canvasWidth: number, canvasHeight: number): PixelNode[] {
  const nodes = model.nodes.filter((node) => node.label)
  if (nodes.length === 0) return []

  const gridUnitX = canvasWidth / 50
  const gridUnitY = canvasHeight / 50

  return nodes.map((node) => {
    const width = Math.max(estimateNodeWidth(node.label), node.width * gridUnitX)
    const height = Math.max(NODE_HEIGHT, node.height * gridUnitY)
    const cx = gridXToPixel(node.cx, canvasWidth)
    const cy = gridYToPixel(node.cy, canvasHeight)

    return {
      label: node.label,
      x: cx - width / 2,
      y: cy - height / 2,
      width,
      height,
    }
  })
}

function escapeSvgText(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

function fmt(value: number): string {
  return value.toFixed(1)
}

function jitter(seed: number, amount: number): number {
  const x = Math.sin(seed * 12.9898) * 43758.5453
  return (x - Math.floor(x) - 0.5) * amount
}

function roughBoxPath(node: PixelNode, index: number): string {
  const x = node.x
  const y = node.y
  const w = node.width
  const h = node.height
  const r = 13
  const seed = index + 1

  const p = (px: number, py: number, offsetSeed: number) =>
    `${fmt(px + jitter(seed * 17 + offsetSeed, 3.2))} ${fmt(py + jitter(seed * 23 + offsetSeed, 3.2))}`

  return [
    `M ${p(x + r, y + 1, 1)}`,
    `C ${p(x + w * 0.36, y - 1, 2)}, ${p(x + w * 0.67, y + 2, 3)}, ${p(x + w - r, y + 1, 4)}`,
    `Q ${p(x + w + 2, y + 2, 5)}, ${p(x + w - 1, y + r, 6)}`,
    `C ${p(x + w + 1, y + h * 0.38, 7)}, ${p(x + w - 2, y + h * 0.68, 8)}, ${p(x + w - 1, y + h - r, 9)}`,
    `Q ${p(x + w - 1, y + h + 1, 10)}, ${p(x + w - r, y + h - 1, 11)}`,
    `C ${p(x + w * 0.66, y + h + 2, 12)}, ${p(x + w * 0.34, y + h - 2, 13)}, ${p(x + r, y + h + 1, 14)}`,
    `Q ${p(x - 2, y + h - 1, 15)}, ${p(x + 1, y + h - r, 16)}`,
    `C ${p(x - 1, y + h * 0.66, 17)}, ${p(x + 2, y + h * 0.34, 18)}, ${p(x + 1, y + r, 19)}`,
    `Q ${p(x + 1, y + 1, 20)}, ${p(x + r, y + 1, 21)}`,
  ].join(' ')
}

function renderLabel(node: PixelNode): string {
  const lines = splitLabel(node.label)
  const lineHeight = 19
  const startY = node.y + node.height / 2 - ((lines.length - 1) * lineHeight) / 2

  return lines
    .map((line, index) => (
      `<text x="${fmt(node.x + node.width / 2)}" y="${fmt(startY + index * lineHeight)}" text-anchor="middle" dominant-baseline="central" fill="#111827" stroke="none" font-family="${HAND_FONT}" font-size="18" font-weight="700">${escapeSvgText(line)}</text>`
    ))
    .join('\n')
}

function renderArrow(from: PixelNode, to: PixelNode, index: number): string {
  const sameRow = Math.abs(from.y - to.y) < 4
  const seed = index + 11

  if (sameRow) {
    const x1 = from.x + from.width + 7
    const y1 = from.y + from.height / 2 + jitter(seed, 3)
    const x2 = to.x - 11
    const midX = (x1 + x2) / 2
    const curve = jitter(seed + 1, 12)
    const line = `<path d="M ${fmt(x1)} ${fmt(y1)} Q ${fmt(midX)} ${fmt(y1 + curve)}, ${fmt(x2)} ${fmt(y1 + jitter(seed + 2, 4))}"/>`
    const head = `<path d="M ${fmt(x2 - 10)} ${fmt(y1 - 8 + jitter(seed + 3, 2))} L ${fmt(x2 + 1)} ${fmt(y1 + jitter(seed + 4, 2))} L ${fmt(x2 - 10)} ${fmt(y1 + 8 + jitter(seed + 5, 2))}"/>`
    return `${line}\n${head}`
  }

  const x1 = from.x + from.width / 2 + jitter(seed, 5)
  const y1 = from.y + from.height + 7
  const x2 = to.x + to.width / 2 + jitter(seed + 1, 5)
  const y2 = to.y - 11
  const midY = (y1 + y2) / 2
  const line = `<path d="M ${fmt(x1)} ${fmt(y1)} C ${fmt(x1 + jitter(seed + 2, 18))} ${fmt(midY)}, ${fmt(x2 + jitter(seed + 3, 18))} ${fmt(midY)}, ${fmt(x2)} ${fmt(y2)}"/>`
  const head = `<path d="M ${fmt(x2 - 8 + jitter(seed + 4, 2))} ${fmt(y2 - 9)} L ${fmt(x2)} ${fmt(y2 + 2)} L ${fmt(x2 + 8 + jitter(seed + 5, 2))} ${fmt(y2 - 9)}"/>`
  return `${line}\n${head}`
}

export function FlowchartLayer({ model, width, height }: FlowchartLayerProps) {
  if (!model || model.nodes.length === 0) return null

  const nodes = layoutNodes(model, width, height)
  const arrows = nodes.slice(0, -1).map((node, index) => renderArrow(node, nodes[index + 1], index))
  const nodeMarkup = nodes.map((node, index) => (
    `<g>
      <path d="${roughBoxPath(node, index)}"/>
      ${renderLabel(node)}
    </g>`
  ))

  const svg = `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg" class="flowchart-layer" style="overflow:visible">
    <g fill="none" stroke="${STROKE}" stroke-width="3.15" stroke-linecap="round" stroke-linejoin="round" opacity="0.95">
      ${arrows.join('\n')}
    </g>
    <g fill="#ffffff" stroke="${STROKE}" stroke-width="3.15" stroke-linecap="round" stroke-linejoin="round" opacity="0.96">
      ${nodeMarkup.join('\n')}
    </g>
  </svg>`

  return (
    <div
      className="flowchart-overlay"
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width,
        height,
        pointerEvents: 'none',
        zIndex: 11,
      }}
      aria-label="Flowchart layer"
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  )
}
