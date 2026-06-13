/**
 * Capture the current Canvas element as a base64 PNG data URL.
 * Used for multimodal image input to MiMo.
 */
export function captureCanvas(canvas: HTMLCanvasElement | null): string | null {
  if (!canvas) return null
  return canvas.toDataURL('image/png')
}
