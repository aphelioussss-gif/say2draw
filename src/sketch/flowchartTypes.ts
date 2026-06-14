export type FlowchartNode = {
  label: string
  cx: number
  cy: number
  width: number
  height: number
}

export type FlowchartModel = {
  nodes: FlowchartNode[]
  totalWidth: number
  centerY: number
}
