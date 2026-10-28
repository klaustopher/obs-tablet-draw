export type Tool = "pen" | "highlighter" | "laser" | "line" | "arrow" | "rect" | "ellipse"

export type Point = [x: number, y: number, pressure: number]

export interface Stroke {
  id: string
  tool: Tool
  color: string
  size: number
  points: Point[]
}

export type DrawEvent =
  | { type: "stroke:start"; stroke: Stroke }
  | { type: "stroke:points"; id: string; points: Point[] }
  | { type: "stroke:end"; id: string }
  | { type: "stroke:add"; stroke: Stroke }
  | { type: "stroke:remove"; id: string }
  | { type: "clear" }
  | { type: "sync"; strokes: Stroke[] }
  | { type: "sync:request" }

export type Sender = "ipad" | "overlay"

export interface Envelope {
  app: "obs-tablet-draw"
  from: Sender
  seq: number
  event: DrawEvent
}
