import { Board } from "./board"
import { connectToObs } from "./obs"
import type { DrawEvent } from "./protocol"
import { startRenderLoop } from "./render"

const board = new Board()

// obs-websocket dispatches requests and broadcasts on a thread pool, so events can arrive out of order.
// Events are applied strictly by seq; a sync resets the sequence (iPad reload or reconnect).
let expectedSeq: number | undefined
const buffered = new Map<number, DrawEvent>()

function receive(event: DrawEvent, seq: number) {
  if (event.type === "sync") {
    board.apply(event)
    expectedSeq = seq + 1
    for (const bufferedSeq of buffered.keys()) if (bufferedSeq <= seq) buffered.delete(bufferedSeq)
  } else if (expectedSeq === undefined || seq >= expectedSeq) {
    buffered.set(seq, event)
  }

  while (expectedSeq !== undefined && buffered.has(expectedSeq)) {
    board.apply(buffered.get(expectedSeq)!)
    buffered.delete(expectedSeq)
    expectedSeq++
  }
}

const { send } = connectToObs("overlay", {
  onEvent: receive,
  onIdentified: () => {
    expectedSeq = undefined
    buffered.clear()
    send({ type: "sync:request" })
  },
})

startRenderLoop(document.querySelector("canvas")!, board)
