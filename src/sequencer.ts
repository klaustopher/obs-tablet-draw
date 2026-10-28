import type { Board } from "./board"
import type { DrawEvent } from "./protocol"

// obs-websocket dispatches requests and broadcasts on a thread pool, so events can arrive out of order.
// Events are applied strictly by seq; a sync resets the sequence (tablet reload or reconnect).
export class EventSequencer {
  private expectedSeq: number | undefined
  private readonly buffered = new Map<number, DrawEvent>()

  constructor(private readonly board: Board) {}

  receive(event: DrawEvent, seq: number) {
    if (event.type === "sync") {
      this.board.apply(event)
      this.expectedSeq = seq + 1
      for (const bufferedSeq of this.buffered.keys()) if (bufferedSeq <= seq) this.buffered.delete(bufferedSeq)
    } else if (this.expectedSeq === undefined || seq >= this.expectedSeq) {
      this.buffered.set(seq, event)
    }

    while (this.expectedSeq !== undefined && this.buffered.has(this.expectedSeq)) {
      this.board.apply(this.buffered.get(this.expectedSeq)!)
      this.buffered.delete(this.expectedSeq)
      this.expectedSeq++
    }
  }

  reset() {
    this.expectedSeq = undefined
    this.buffered.clear()
  }
}
