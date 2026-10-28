import { getStroke } from "perfect-freehand"
import type { Board, BoardStroke } from "./board"
import type { Stroke } from "./protocol"

type Vec = [number, number]

export interface View {
  zoom: number
  x: number
  y: number
}

export const FULL_VIEW: View = { zoom: 1, x: 0, y: 0 }

const REFERENCE_HEIGHT = 1080
const LASER_TRAIL_MS = 700
const ELLIPSE_SEGMENTS = 64

export function lineWidth(stroke: Stroke, height: number) {
  const factor = stroke.tool === "highlighter" ? 3 : 1
  return (stroke.size * factor * height) / REFERENCE_HEIGHT
}

export function outline(stroke: Stroke, width: number, height: number): Vec[][] {
  const points = stroke.points.map(([x, y]): Vec => [x * width, y * height])
  const [x1, y1] = points[0]
  const [x2, y2] = points[points.length - 1]

  switch (stroke.tool) {
    case "pen":
    case "highlighter":
    case "laser":
      return [points]
    case "line":
      return [[[x1, y1], [x2, y2]]]
    case "rect":
      return [[[x1, y1], [x2, y1], [x2, y2], [x1, y2], [x1, y1]]]
    case "ellipse": {
      const [cx, cy, rx, ry] = [(x1 + x2) / 2, (y1 + y2) / 2, Math.abs(x2 - x1) / 2, Math.abs(y2 - y1) / 2]
      return [
        Array.from({ length: ELLIPSE_SEGMENTS + 1 }, (_, i): Vec => {
          const angle = (i / ELLIPSE_SEGMENTS) * Math.PI * 2
          return [cx + rx * Math.cos(angle), cy + ry * Math.sin(angle)]
        }),
      ]
    }
    case "arrow": {
      const angle = Math.atan2(y2 - y1, x2 - x1)
      const head = lineWidth(stroke, height) * 4
      const wing = (offset: number): Vec => [x2 - head * Math.cos(angle + offset), y2 - head * Math.sin(angle + offset)]
      return [
        [[x1, y1], [x2, y2]],
        [wing(Math.PI / 6), [x2, y2], wing(-Math.PI / 6)],
      ]
    }
  }
}

function isExpired(stroke: BoardStroke, now: number) {
  return (
    stroke.tool === "laser" &&
    stroke.endedAt !== undefined &&
    now - stroke.times[stroke.times.length - 1] >= LASER_TRAIL_MS
  )
}

function laserTrail(stroke: BoardStroke, now: number) {
  const trail = stroke.points.filter((_, i) => now - stroke.times[i] < LASER_TRAIL_MS)
  return trail.length === 0 && stroke.endedAt === undefined ? stroke.points.slice(-1) : trail
}

function polygonPath(polygon: number[][]) {
  const path = new Path2D()
  const midpoint = (i: number) => {
    const [ax, ay] = polygon[i]
    const [bx, by] = polygon[(i + 1) % polygon.length]
    return [(ax + bx) / 2, (ay + by) / 2] as const
  }

  path.moveTo(...midpoint(polygon.length - 1))
  polygon.forEach(([x, y], i) => path.quadraticCurveTo(x, y, ...midpoint(i)))
  path.closePath()
  return path
}

function drawStroke(ctx: CanvasRenderingContext2D, stroke: BoardStroke, width: number, height: number, now: number) {
  const size = lineWidth(stroke, height)

  ctx.save()
  ctx.globalAlpha = stroke.tool === "highlighter" ? 0.4 : 1
  ctx.fillStyle = stroke.color
  ctx.strokeStyle = stroke.color

  if (stroke.tool === "pen" || stroke.tool === "highlighter" || stroke.tool === "laser") {
    const points = stroke.tool === "laser" ? laserTrail(stroke, now) : stroke.points
    const polygon = getStroke(
      points.map(([x, y, pressure]) => [x * width, y * height, pressure]),
      {
        size,
        thinning: stroke.tool === "pen" ? 0.6 : 0,
        smoothing: 0.5,
        streamline: 0.4,
        simulatePressure: false,
        start: { taper: stroke.tool === "laser" },
        last: stroke.endedAt !== undefined,
      },
    )
    if (stroke.tool === "laser") {
      ctx.shadowColor = stroke.color
      ctx.shadowBlur = size * 2
    }
    ctx.fill(polygonPath(polygon))
  } else {
    ctx.lineWidth = size
    ctx.lineCap = "round"
    ctx.lineJoin = "round"
    for (const line of outline(stroke, width, height)) {
      ctx.beginPath()
      line.forEach(([x, y], i) => (i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)))
      ctx.stroke()
    }
  }

  ctx.restore()
}

export function startRenderLoop(canvas: HTMLCanvasElement, board: Board, getView: () => View = () => FULL_VIEW) {
  const ctx = canvas.getContext("2d")!
  let renderedVersion = -1
  let renderedView = FULL_VIEW
  let frameId = 0

  const frame = (now: number) => {
    const width = Math.round(canvas.clientWidth * devicePixelRatio)
    const height = Math.round(canvas.clientHeight * devicePixelRatio)
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width
      canvas.height = height
      renderedVersion = -1
    }

    for (const stroke of board.strokes.values()) {
      if (isExpired(stroke, now)) board.apply({ type: "stroke:remove", id: stroke.id })
    }

    const view = getView()
    const hasLaser = [...board.strokes.values()].some((stroke) => stroke.tool === "laser")
    if (board.version !== renderedVersion || view !== renderedView || hasLaser) {
      ctx.setTransform(1, 0, 0, 1, 0, 0)
      ctx.clearRect(0, 0, width, height)
      ctx.setTransform(view.zoom, 0, 0, view.zoom, -view.x * width * view.zoom, -view.y * height * view.zoom)
      for (const stroke of board.strokes.values()) drawStroke(ctx, stroke, width, height, now)
      renderedVersion = board.version
      renderedView = view
    }

    frameId = requestAnimationFrame(frame)
  }

  frameId = requestAnimationFrame(frame)
  return () => cancelAnimationFrame(frameId)
}
