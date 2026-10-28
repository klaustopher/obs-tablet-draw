import { Board } from "../board"
import type { DrawEvent, Point, Stroke, Tool } from "../protocol"
import { lineWidth, outline } from "../render"

type HistoryEntry = { kind: "add"; stroke: Stroke } | { kind: "remove"; stroke: Stroke } | { kind: "clear"; strokes: Stroke[] }

export interface Brush {
  tool: Tool
  color: string
  size: number
}

// crypto.randomUUID() is unavailable because the iPad page is served over plain HTTP (no secure context)
const newId = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`

function distanceToSegment([px, py]: number[], [ax, ay]: number[], [bx, by]: number[]) {
  const [dx, dy] = [bx - ax, by - ay]
  const lengthSquared = dx * dx + dy * dy
  const t = lengthSquared === 0 ? 0 : Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lengthSquared))
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy))
}

export class DrawingSession {
  readonly board = new Board()
  private undoStack: HistoryEntry[] = []
  private redoStack: HistoryEntry[] = []
  private activeId?: string
  private pendingPoints: Point[] = []
  private flushScheduled = false

  constructor(private readonly send: (event: DrawEvent) => void) {}

  get drawing() {
    return this.activeId !== undefined
  }

  begin(brush: Brush, point: Point) {
    const stroke: Stroke = { id: newId(), ...brush, points: [point] }
    this.activeId = stroke.id
    this.emit({ type: "stroke:start", stroke })
  }

  extend(points: Point[]) {
    if (!this.activeId) return
    this.board.apply({ type: "stroke:points", id: this.activeId, points })
    this.pendingPoints.push(...points)
    if (this.flushScheduled) return
    this.flushScheduled = true
    requestAnimationFrame(() => this.flush())
  }

  end() {
    if (!this.activeId) return
    this.flush()
    this.emit({ type: "stroke:end", id: this.activeId })
    const stroke = this.board.strokes.get(this.activeId)!
    if (stroke.tool !== "laser") this.record({ kind: "add", stroke })
    this.activeId = undefined
  }

  cancel() {
    if (!this.activeId) return
    this.pendingPoints = []
    this.emit({ type: "stroke:remove", id: this.activeId })
    this.activeId = undefined
  }

  erase([x, y]: Point, radius: number, width: number, height: number) {
    const pointer = [x * width, y * height]
    for (const stroke of this.board.completedStrokes()) {
      const tolerance = radius + lineWidth(stroke, height) / 2
      const hit = outline(stroke, width, height).some((line) =>
        line.some((point, i) => distanceToSegment(pointer, point, line[Math.max(0, i - 1)]) <= tolerance),
      )
      if (!hit) continue
      this.emit({ type: "stroke:remove", id: stroke.id })
      this.record({ kind: "remove", stroke })
    }
  }

  clear() {
    const strokes = this.board.completedStrokes()
    if (strokes.length === 0) return
    this.emit({ type: "clear" })
    this.record({ kind: "clear", strokes })
  }

  undo() {
    const entry = this.undoStack.pop()
    if (!entry) return
    if (entry.kind === "add") this.emit({ type: "stroke:remove", id: entry.stroke.id })
    if (entry.kind === "remove") this.emit({ type: "stroke:add", stroke: entry.stroke })
    if (entry.kind === "clear") this.emit({ type: "sync", strokes: entry.strokes })
    this.redoStack.push(entry)
  }

  redo() {
    const entry = this.redoStack.pop()
    if (!entry) return
    if (entry.kind === "add") this.emit({ type: "stroke:add", stroke: entry.stroke })
    if (entry.kind === "remove") this.emit({ type: "stroke:remove", id: entry.stroke.id })
    if (entry.kind === "clear") this.emit({ type: "clear" })
    this.undoStack.push(entry)
  }

  sync() {
    this.send({ type: "sync", strokes: this.board.completedStrokes() })
  }

  private flush() {
    this.flushScheduled = false
    if (!this.activeId || this.pendingPoints.length === 0) return
    this.send({ type: "stroke:points", id: this.activeId, points: this.pendingPoints })
    this.pendingPoints = []
  }

  private record(entry: HistoryEntry) {
    this.undoStack.push(entry)
    this.redoStack = []
  }

  private emit(event: DrawEvent) {
    this.board.apply(event)
    this.send(event)
  }
}
