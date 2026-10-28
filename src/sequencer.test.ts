import { describe, expect, it } from "vitest"
import { Board } from "./board"
import type { DrawEvent, Stroke } from "./protocol"
import { EventSequencer } from "./sequencer"

const stroke = (id: string): Stroke => ({ id, tool: "pen", color: "#fff", size: 6, points: [[0.1, 0.1, 0.5]] })
const add = (id: string): DrawEvent => ({ type: "stroke:add", stroke: stroke(id) })
const sync = (...ids: string[]): DrawEvent => ({ type: "sync", strokes: ids.map(stroke) })

function setup() {
  const board = new Board()
  const sequencer = new EventSequencer(board)
  const ids = () => [...board.strokes.keys()]
  return { sequencer, ids }
}

describe("EventSequencer", () => {
  it("holds back events until the first sync", () => {
    const { sequencer, ids } = setup()
    sequencer.receive(add("a"), 1)
    expect(ids()).toEqual([])

    sequencer.receive(sync(), 0)
    expect(ids()).toEqual(["a"])
  })

  it("applies events in seq order when they arrive out of order", () => {
    const { sequencer, ids } = setup()
    sequencer.receive(sync(), 0)
    sequencer.receive(add("c"), 3)
    sequencer.receive(add("b"), 2)
    expect(ids()).toEqual([])

    sequencer.receive(add("a"), 1)
    expect(ids()).toEqual(["a", "b", "c"])
  })

  it("drops events older than the expected seq", () => {
    const { sequencer, ids } = setup()
    sequencer.receive(sync(), 0)
    sequencer.receive(add("a"), 1)
    sequencer.receive(add("late"), 1)
    sequencer.receive(add("b"), 2)

    expect(ids()).toEqual(["a", "b"])
  })

  it("restarts the sequence on a sync and discards events it supersedes", () => {
    const { sequencer, ids } = setup()
    sequencer.receive(sync(), 0)
    sequencer.receive(add("stale"), 3)
    sequencer.receive(add("pending"), 8)
    sequencer.receive(sync("x"), 5)
    expect(ids()).toEqual(["x"])

    sequencer.receive(add("y"), 6)
    sequencer.receive(add("z"), 7)
    expect(ids()).toEqual(["x", "y", "z", "pending"])
  })

  it("accepts a sync with a lower seq after the tablet reloads", () => {
    const { sequencer, ids } = setup()
    sequencer.receive(sync(), 0)
    sequencer.receive(add("a"), 1)
    sequencer.receive(sync("fresh"), 0)
    sequencer.receive(add("b"), 1)

    expect(ids()).toEqual(["fresh", "b"])
  })

  it("forgets the sequence and buffered events on reset", () => {
    const { sequencer, ids } = setup()
    sequencer.receive(sync(), 0)
    sequencer.receive(add("buffered"), 2)
    sequencer.reset()

    sequencer.receive(add("a"), 1)
    sequencer.receive(sync(), 0)
    expect(ids()).toEqual(["a"])
  })
})
