import OBSWebSocket, { EventSubscription, type OBSRequestTypes } from "obs-websocket-js"
import type { DrawEvent, Envelope, Sender } from "./protocol"

type EventData = OBSRequestTypes["BroadcastCustomEvent"]["eventData"]

const RECONNECT_DELAY_MS = 2000

export const DEFAULT_OBS_PORT = 4455

export interface ObsTarget {
  url: string
  password?: string
}

interface Handlers {
  onEvent: (event: DrawEvent, seq: number) => void
  onIdentified?: () => void
}

export function connectToObs(from: Sender, target: () => ObsTarget, { onEvent, onIdentified }: Handlers) {
  const obs = new OBSWebSocket()

  // obs-websocket-js types this as `{ eventData }`, but the server emits the broadcast payload unwrapped
  obs.on("CustomEvent", (data) => {
    const envelope = data as unknown as Envelope
    if (envelope.app === "obs-tablet-draw" && envelope.from !== from) onEvent(envelope.event, envelope.seq)
  })
  if (onIdentified) obs.on("Identified", onIdentified)

  const connect = () => {
    const { url, password } = target()
    obs
      .connect(url, password, {
        eventSubscriptions:
          EventSubscription.General | EventSubscription.Scenes | EventSubscription.Inputs | EventSubscription.SceneItems,
      })
      .catch(() => {})
  }
  obs.on("ConnectionClosed", () => setTimeout(connect, RECONNECT_DELAY_MS))
  connect()

  let seq = 0
  const send = (event: DrawEvent) => {
    const envelope: Envelope = { app: "obs-tablet-draw", from, seq: seq++, event }
    obs.call("BroadcastCustomEvent", { eventData: envelope as unknown as EventData }).catch(() => {})
  }

  return { obs, send }
}
