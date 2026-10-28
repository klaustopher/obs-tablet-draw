import { connectToObs, DEFAULT_OBS_PORT } from "../obs"
import { DrawingSession } from "./session"
import { readStored, writeStored } from "./storage"

export interface ConnectionSettings {
  port: number
  password?: string
}

const SETTINGS_KEY = "obs-tablet-draw:connection"

const host = new URLSearchParams(location.search).get("host") ?? location.hostname
let settings = readStored<ConnectionSettings>(SETTINGS_KEY, { port: DEFAULT_OBS_PORT })

const settingsListeners = new Set<() => void>()

export const getSettings = () => settings
export const obsUrl = ({ port }: ConnectionSettings) => `ws://${host}:${port}`

export function subscribeToSettings(listener: () => void) {
  settingsListeners.add(listener)
  return () => settingsListeners.delete(listener)
}

export function saveSettings(next: ConnectionSettings) {
  settings = next
  writeStored(SETTINGS_KEY, next)
  settingsListeners.forEach((listener) => listener())
  if (obs.identified) obs.disconnect()
}

export const { obs, send } = connectToObs("tablet", () => ({ url: obsUrl(settings), password: settings.password }), {
  onEvent: (event) => {
    if (event.type === "sync:request") session.sync()
  },
  onIdentified: () => session.sync(),
})

export const session = new DrawingSession(send)
