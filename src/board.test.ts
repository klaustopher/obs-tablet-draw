import { describe, expect, it } from "vitest"
import { Board } from "./board"
import type { Stroke } from "./protocol"

const stroke = (id: string, overrides: Partial<Stroke> = {}): Stroke => ({
  id,
  tool: "pen",
  color: "#fff",
  size: 6,
  points: [[0.1, 0.1, 0.5]],
  ...overrides,
})

describe("Board", () => {
  it("builds a stroke from start, points and end", () => {
    const board = new Board()
    board.apply({ type: "stroke:start", stroke: stroke("a") })
    board.apply({ type: "stroke:points", id: "a", points: [[0.2, 0.2, 0.5], [0.3, 0.3, 0.5]] })
    board.apply({ type: "stroke:end", id: "a" })

    expect(board.completedStrokes()).toEqual([
      stroke("a", { points: [[0.1, 0.1, 0.5], [0.2, 0.2, 0.5], [0.3, 0.3, 0.5]] }),
    ])
  })

  it("does not mutate the points of the incoming stroke", () => {
    const board = new Board()
    const incoming = stroke("a")
    board.apply({ type: "stroke:start", stroke: incoming })
    board.apply({ type: "stroke:points", id: "a", points: [[0.2, 0.2, 0.5]] })

    expect(incoming.points).toHaveLength(1)
  })

  it("ignores points and end for unknown strokes", () => {
    const board = new Board()
    board.apply({ type: "stroke:points", id: "missing", points: [[0.2, 0.2, 0.5]] })
    board.apply({ type: "stroke:end", id: "missing" })

    expect(board.strokes.size).toBe(0)
  })

  it("excludes strokes in progress and laser strokes from completed strokes", () => {
    const board = new Board()
    board.apply({ type: "stroke:start", stroke: stroke("active") })
    board.apply({ type: "stroke:start", stroke: stroke("laser", { tool: "laser" }) })
    board.apply({ type: "stroke:end", id: "laser" })
    board.apply({ type: "stroke:add", stroke: stroke("added") })

    expect(board.completedStrokes().map(({ id }) => id)).toEqual(["added"])
  })

  it("removes, clears and replaces strokes", () => {
    const board = new Board()
    board.apply({ type: "stroke:add", stroke: stroke("a") })
    board.apply({ type: "stroke:add", stroke: stroke("b") })
    board.apply({ type: "stroke:remove", id: "a" })
    expect([...board.strokes.keys()]).toEqual(["b"])

    board.apply({ type: "clear" })
    expect(board.strokes.size).toBe(0)

    board.apply({ type: "sync", strokes: [stroke("c"), stroke("d")] })
    expect(board.completedStrokes().map(({ id }) => id)).toEqual(["c", "d"])
  })

  it("bumps the version for every event except sync requests", () => {
    const board = new Board()
    board.apply({ type: "stroke:add", stroke: stroke("a") })
    board.apply({ type: "clear" })
    board.apply({ type: "sync:request" })

    expect(board.version).toBe(2)
  })
})
