import { Board } from "./board"
import { connectToObs, DEFAULT_OBS_PORT } from "./obs"
import { startRenderLoop } from "./render"
import { EventSequencer } from "./sequencer"

const board = new Board()
const sequencer = new EventSequencer(board)

const params = new URLSearchParams(location.hash.slice(1))
const target = {
  url: `ws://${location.hostname}:${params.get("port") ?? DEFAULT_OBS_PORT}`,
  password: params.get("password") || undefined,
}

const { send } = connectToObs("overlay", () => target, {
  onEvent: (event, seq) => sequencer.receive(event, seq),
  onIdentified: () => {
    sequencer.reset()
    send({ type: "sync:request" })
  },
})

startRenderLoop(document.querySelector("canvas")!, board)
