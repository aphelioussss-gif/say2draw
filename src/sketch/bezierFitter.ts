/**
 * Cubic Bézier curve fitting via least squares.
 *
 * Ported from SketchAgent utils.py.
 * Given sampled points and t_values, solves for Bézier control points
 * that minimize the squared error between the curve and sampled points.
 */

import type { BezierSegment, ControlPoint } from './types'

/**
 * Evaluate a cubic Bézier curve at parameter t.
 */
function cubicBezier(P: ControlPoint[], t: number): ControlPoint {
  const mt = 1 - t
  const mt2 = mt * mt
  const mt3 = mt2 * mt
  const t2 = t * t
  const t3 = t2 * t

  return [
    mt3 * P[0][0] + 3 * mt2 * t * P[1][0] + 3 * mt * t2 * P[2][0] + t3 * P[3][0],
    mt3 * P[0][1] + 3 * mt2 * t * P[1][1] + 3 * mt * t2 * P[2][1] + t3 * P[3][1],
  ]
}

/**
 * Solve least squares Ax = b for a small matrix using normal equations.
 * Returns x where ||Ax - b||² is minimized.
 */
function solveLeastSquares(A: number[][], b: number[][]): number[][] {
  const m = A.length    // number of equations
  const n = A[0].length // number of unknowns
  const p = b[0].length // dimension of output (2 for 2D points)

  // Compute A^T A (n × n) and A^T b (n × p)
  const AtA: number[][] = Array.from({ length: n }, () => new Array(n).fill(0))
  const Atb: number[][] = Array.from({ length: n }, () => new Array(p).fill(0))

  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      let sum = 0
      for (let k = 0; k < m; k++) {
        sum += A[k][i] * A[k][j]
      }
      AtA[i][j] = sum
    }
    for (let c = 0; c < p; c++) {
      let sum = 0
      for (let k = 0; k < m; k++) {
        sum += A[k][i] * b[k][c]
      }
      Atb[i][c] = sum
    }
  }

  // Gaussian elimination with partial pivoting
  const aug: number[][] = AtA.map((row, i) => [...row, ...Atb[i]])

  for (let col = 0; col < n; col++) {
    // Find pivot
    let maxRow = col
    let maxVal = Math.abs(aug[col][col])
    for (let row = col + 1; row < n; row++) {
      const val = Math.abs(aug[row][col])
      if (val > maxVal) {
        maxVal = val
        maxRow = row
      }
    }

    if (maxVal < 1e-12) continue // singular, skip

    ;[aug[col], aug[maxRow]] = [aug[maxRow], aug[col]]

    // Eliminate below
    for (let row = col + 1; row < n; row++) {
      const factor = aug[row][col] / aug[col][col]
      for (let j = col; j < n + p; j++) {
        aug[row][j] -= factor * aug[col][j]
      }
    }
  }

  // Back substitution
  const x: number[][] = Array.from({ length: n }, () => new Array(p).fill(0))
  for (let i = n - 1; i >= 0; i--) {
    if (Math.abs(aug[i][i]) < 1e-12) continue
    for (let c = 0; c < p; c++) {
      let sum = aug[i][n + c]
      for (let j = i + 1; j < n; j++) {
        sum -= aug[i][j] * x[j][c]
      }
      x[i][c] = sum / aug[i][i]
    }
  }

  return x
}

/**
 * Build the Bézier basis matrix for cubic curves at given t values.
 */
function buildCubicBasisMatrix(tValues: number[]): number[][] {
  return tValues.map((t) => {
    const mt = 1 - t
    return [mt * mt * mt, 3 * mt * mt * t, 3 * mt * t * t, t * t * t]
  })
}

/**
 * Build the quadratic Bézier basis matrix at given t values.
 */
function buildQuadraticBasisMatrix(tValues: number[]): number[][] {
  return tValues.map((t) => {
    const mt = 1 - t
    return [mt * mt, 2 * mt * t, t * t]
  })
}

/**
 * Fit a single Bézier segment to sampled points.
 */
function fitSingleSegment(
  sampledPoints: ControlPoint[],
  tValues: number[],
): ControlPoint[] {
  const n = sampledPoints.length

  if (n === 1) {
    // Dot — return the point plus a tiny offset neighbor
    return [sampledPoints[0], [sampledPoints[0][0] + 0.0001, sampledPoints[0][1]]]
  }

  if (n === 2) {
    // Linear — two control points are the endpoints
    return [sampledPoints[0], sampledPoints[1]]
  }

  if (n === 3) {
    // Quadratic Bézier
    const A = buildQuadraticBasisMatrix(tValues)
    const b = sampledPoints.map((p) => [p[0], p[1]])
    const P = solveLeastSquares(A, b)
    return P.map((row) => [row[0], row[1]] as ControlPoint)
  }

  // Cubic Bézier (n >= 4)
  const A = buildCubicBasisMatrix(tValues)
  const b = sampledPoints.map((p) => [p[0], p[1]])
  const P = solveLeastSquares(A, b)
  return P.map((row) => [row[0], row[1]] as ControlPoint)
}

/**
 * Compute mean squared error between sampled points and fitted curve.
 */
function computeFittingError(
  sampledPoints: ControlPoint[],
  tValues: number[],
  controlPoints: ControlPoint[],
): number {
  if (controlPoints.length < 4) return 0

  let totalError = 0
  for (let i = 0; i < sampledPoints.length; i++) {
    const curvePoint = cubicBezier(controlPoints, tValues[i])
    const dx = curvePoint[0] - sampledPoints[i][0]
    const dy = curvePoint[1] - sampledPoints[i][1]
    totalError += Math.sqrt(dx * dx + dy * dy)
  }
  return totalError / sampledPoints.length
}

/**
 * Recursively fit Bézier curves to sampled points.
 * For long sequences with high fitting error, splits the curve in half.
 */
export function fitBezierCurve(
  sampledPoints: ControlPoint[],
  tValues: number[],
): BezierSegment[] {
  const n = sampledPoints.length

  if (n <= 4) {
    return [fitSingleSegment(sampledPoints, tValues)]
  }

  const controlPoints = fitSingleSegment(sampledPoints, tValues)

  // For cubic fits (n >= 4), check error and possibly split
  if (controlPoints.length === 4) {
    const error = computeFittingError(sampledPoints, tValues, controlPoints)

    if (error > 5 && n >= 7) {
      // Split at midpoint and fit recursively
      const mid = Math.floor(n / 2)
      const leftPoints = sampledPoints.slice(0, mid + 1)
      const leftT = normalizeTValues(tValues.slice(0, mid + 1))
      const rightPoints = sampledPoints.slice(mid)
      const rightT = normalizeTValues(tValues.slice(mid))

      return [
        ...fitBezierCurve(leftPoints, leftT),
        ...fitBezierCurve(rightPoints, rightT),
      ]
    }
  }

  return [controlPoints]
}

/**
 * Normalize t values to [0, 1] range.
 */
function normalizeTValues(tValues: number[]): number[] {
  if (tValues.length === 0) return []
  const min = tValues[0]
  const max = tValues[tValues.length - 1]
  const range = max - min
  if (range === 0) return tValues.map(() => 0.5)
  return tValues.map((t) => (t - min) / range)
}
