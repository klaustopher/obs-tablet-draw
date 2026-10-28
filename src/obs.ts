import OBSWebSocket, { EventSubscription, type OBSRequestTypes } from "obs-websocket-js"
import type { DrawEvent, Envelope, Sender } from "./protocol"

type EventData = OBSRequestTypes["BroadcastCustomEvent"]["eventData"]

const RECONNECT_DELAY_MS = 2000

interface Handlers {
  onEvent: (event: DrawEvent, seq: number) => void
  onIdentified?: () => void
}

export function connectToObs(from: Sender, { onEvent, onIdentified }: Handlers) {
  const params = new URLSearchParams(location.search)
  const host = params.get("host") ?? location.hostname
  const port = params.get("port") ?? "4455"
  const password = params.get("password") || undefined
  const url = `ws://${host}:${port}`

  const obs = new OBSWebSocket()

  // obs-websocket-js types this as `{ eventData }`, but the server emits the broadcast payload unwrapped
  obs.on("CustomEvent", (data) => {
    const envelope = data as unknown as Envelope
    if (envelope.app === "obs-tablet-draw" && envelope.from !== from) onEvent(envelope.event, envelope.seq)
  })
  if (onIdentified) obs.on("Identified", onIdentified)

  const connect = () =>
    obs
      .connect(url, password, {
        eventSubscriptions:
          EventSubscription.General | EventSubscription.Scenes | EventSubscription.Inputs | EventSubscription.SceneItems,
      })
      .catch(() => {})
  obs.on("ConnectionClosed", () => setTimeout(connect, RECONNECT_DELAY_MS))
  connect()

  let seq = 0
  const send = (event: DrawEvent) => {
    const envelope: Envelope = { app: "obs-tablet-draw", from, seq: seq++, event }
    obs.call("BroadcastCustomEvent", { eventData: envelope as unknown as EventData }).catch(() => {})
  }

  return { obs, send, url, hasPassword: password !== undefined }
}
