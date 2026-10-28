import { beforeEach, describe, expect, it, vi } from "vitest"
import type { DrawEvent, Point } from "../protocol"
import { type Brush, DrawingSession } from "./session"

const PEN: Brush = { tool: "pen", color: "#fff", size: 6 }
const LASER: Brush = { ...PEN, tool: "laser" }
const WIDTH = 1920
const HEIGHT = 1080

let frames: FrameRequestCallback[]

beforeEach(() => {
  frames = []
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => frames.push(callback))
  return () => vi.unstubAllGlobals()
})

function setup() {
  const sent: DrawEvent[] = []
  const session = new DrawingSession((event) => sent.push(event))
  const types = () => sent.map(({ type }) => type)
  return { session, sent, types }
}

function draw(session: DrawingSession, brush: Brush, [first, ...rest]: Point[]) {
  session.begin(brush, first)
  session.extend(rest)
  session.end()
  return [...session.board.strokes.keys()].at(-1)!
}

describe("DrawingSession", () => {
  it("batches points until the next animation frame", () => {
    const { session, sent, types } = setup()
    session.begin(PEN, [0.1, 0.1, 0.5])
    session.extend([[0.2, 0.2, 0.5]])
    session.extend([[0.3, 0.3, 0.5]])
    expect(types()).toEqual(["stroke:start"])
    expect(frames).toHaveLength(1)

    frames[0](0)
    expect(sent[1]).toMatchObject({ type: "stroke:points", points: [[0.2, 0.2, 0.5], [0.3, 0.3, 0.5]] })
  })

  it("flushes pending points before ending a stroke", () => {
    const { session, types } = setup()
    draw(session, PEN, [[0.1, 0.1, 0.5], [0.2, 0.2, 0.5]])

    expect(types()).toEqual(["stroke:start", "stroke:points", "stroke:end"])
    expect(session.drawing).toBe(false)
  })

  it("removes a cancelled stroke without recording it", () => {
    const { session, types } = setup()
    session.begin(PEN, [0.1, 0.1, 0.5])
    session.extend([[0.2, 0.2, 0.5]])
    session.cancel()
    frames[0](0)
    session.undo()

    expect(types()).toEqual(["stroke:start", "stroke:remove"])
    expect(session.board.strokes.size).toBe(0)
  })

  it("undoes and redoes a stroke", () => {
    const { session, sent } = setup()
    const id = draw(session, PEN, [[0.1, 0.1, 0.5], [0.2, 0.2, 0.5]])

    session.undo()
    expect(sent.at(-1)).toEqual({ type: "stroke:remove", id })
    expect(session.board.strokes.size).toBe(0)

    session.redo()
    expect(sent.at(-1)).toMatchObject({ type: "stroke:add", stroke: { id } })
    expect(session.board.completedStrokes().map((stroke) => stroke.id)).toEqual([id])
  })

  it("keeps laser strokes out of the history", () => {
    const { session, types } = setup()
    draw(session, LASER, [[0.1, 0.1, 0.5], [0.2, 0.2, 0.5]])
    const sentBeforeUndo = types().length
    session.undo()

    expect(types()).toHaveLength(sentBeforeUndo)
  })

  it("discards the redo history when a new stroke is drawn", () => {
    const { session, types } = setup()
    draw(session, PEN, [[0.1, 0.1, 0.5], [0.2, 0.2, 0.5]])
    session.undo()
    draw(session, PEN, [[0.5, 0.5, 0.5], [0.6, 0.6, 0.5]])
    const sentBeforeRedo = types().length
    session.redo()

    expect(types()).toHaveLength(sentBeforeRedo)
  })

  it("erases strokes near the pointer and restores them on undo", () => {
    const { session, sent } = setup()
    const hit = draw(session, PEN, [[0.1, 0.1, 0.5], [0.3, 0.1, 0.5]])
    const missed = draw(session, PEN, [[0.1, 0.8, 0.5], [0.3, 0.8, 0.5]])

    session.erase([0.2, 0.105, 0.5], 4, WIDTH, HEIGHT)
    expect(sent.at(-1)).toEqual({ type: "stroke:remove", id: hit })
    expect([...session.board.strokes.keys()]).toEqual([missed])

    session.undo()
    expect(sent.at(-1)).toMatchObject({ type: "stroke:add", stroke: { id: hit } })
  })

  it("clears all strokes and restores them on undo", () => {
    const { session, sent } = setup()
    const first = draw(session, PEN, [[0.1, 0.1, 0.5], [0.2, 0.2, 0.5]])
    const second = draw(session, PEN, [[0.5, 0.5, 0.5], [0.6, 0.6, 0.5]])

    session.clear()
    expect(sent.at(-1)).toEqual({ type: "clear" })

    session.undo()
    expect(sent.at(-1)).toMatchObject({ type: "sync", strokes: [{ id: first }, { id: second }] })

    session.redo()
    expect(sent.at(-1)).toEqual({ type: "clear" })
  })

  it("sends nothing when clearing an empty board", () => {
    const { session, sent } = setup()
    session.clear()

    expect(sent).toEqual([])
  })

  it("syncs completed strokes only", () => {
    const { session, sent } = setup()
    const done = draw(session, PEN, [[0.1, 0.1, 0.5], [0.2, 0.2, 0.5]])
    session.begin(PEN, [0.5, 0.5, 0.5])
    session.sync()

    expect(sent.at(-1)).toMatchObject({ type: "sync", strokes: [{ id: done }] })
  })
})
