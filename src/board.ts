import type { DrawEvent, Stroke } from "./protocol"

export interface BoardStroke extends Stroke {
  times: number[]
  endedAt?: number
}

export class Board {
  strokes = new Map<string, BoardStroke>()
  version = 0

  apply(event: DrawEvent) {
    switch (event.type) {
      case "stroke:start": {
        const now = performance.now()
        this.strokes.set(event.stroke.id, {
          ...event.stroke,
          points: [...event.stroke.points],
          times: event.stroke.points.map(() => now),
        })
        break
      }
      case "stroke:points": {
        const stroke = this.strokes.get(event.id)
        if (!stroke) break
        const now = performance.now()
        stroke.points.push(...event.points)
        stroke.times.push(...event.points.map(() => now))
        break
      }
      case "stroke:end": {
        const stroke = this.strokes.get(event.id)
        if (stroke) stroke.endedAt = performance.now()
        break
      }
      case "stroke:add":
        this.strokes.set(event.stroke.id, { ...event.stroke, times: [], endedAt: performance.now() })
        break
      case "stroke:remove":
        this.strokes.delete(event.id)
        break
      case "clear":
        this.strokes.clear()
        break
      case "sync":
        this.strokes = new Map(
          event.strokes.map((stroke) => [stroke.id, { ...stroke, times: [], endedAt: performance.now() }]),
        )
        break
      case "sync:request":
        return
    }
    this.version++
  }

  completedStrokes(): Stroke[] {
    return [...this.strokes.values()]
      .filter((stroke) => stroke.endedAt !== undefined && stroke.tool !== "laser")
      .map(({ endedAt: _, times: __, ...stroke }) => stroke)
  }
}
