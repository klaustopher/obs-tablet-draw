import { Board } from "./board"
import { connectToObs } from "./obs"
import { startRenderLoop } from "./render"
import { EventSequencer } from "./sequencer"

const board = new Board()
const sequencer = new EventSequencer(board)

const { send } = connectToObs("overlay", {
  onEvent: (event, seq) => sequencer.receive(event, seq),
  onIdentified: () => {
    sequencer.reset()
    send({ type: "sync:request" })
  },
})

startRenderLoop(document.querySelector("canvas")!, board)
