import { connectToObs } from "../obs"
import { DrawingSession } from "./session"

export const { obs, send } = connectToObs("tablet", {
  onEvent: (event) => {
    if (event.type === "sync:request") session.sync()
  },
  onIdentified: () => session.sync(),
})

export const session = new DrawingSession(send)
