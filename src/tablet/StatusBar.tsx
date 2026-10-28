import { Eye, EyeOff, Plus } from "lucide-react"
import { useEffect, useState } from "react"
import type { ConnectionState } from "./connectionState"
import { useConnectionState, useProgramScene, type OverlayVisibility } from "./hooks"

const STALE_AFTER_MS = 3000

const CONNECTION_LABELS: Record<ConnectionState, string> = {
  connected: "Connected",
  connecting: "Connecting…",
  unreachable: "OBS not reachable",
  "password-missing": "Password missing",
  "wrong-password": "Wrong password",
}

interface Props {
  screenshotAt?: number
  hasSource: boolean
  overlay: OverlayVisibility
  onOpenSettings: () => void
}

function useNow() {
  const [now, setNow] = useState(Date.now)
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(interval)
  }, [])
  return now
}

function screenshotLabel(age: number | undefined, hasSource: boolean) {
  if (!hasSource) return "No source"
  if (age === undefined) return "Waiting for image…"
  return `${Math.floor(age / 1000)} s ago`
}

function OverlayStatus({ names, visible, toggle, create }: OverlayVisibility) {
  if (names.length === 0) {
    return (
      <button className="overlay-toggle missing" onClick={create}>
        <Plus size={14} />
        Create overlay
      </button>
    )
  }

  const name = names.length > 1 ? `${names[0]} (+${names.length - 1})` : names[0]
  const Icon = visible ? Eye : EyeOff
  return (
    <button
      className={`overlay-toggle ${visible ? "" : "off"}`}
      aria-label={visible ? "Hide overlay" : "Show overlay"}
      onClick={toggle}
    >
      <Icon size={14} />
      Overlay: {name}
    </button>
  )
}

export function StatusBar({ screenshotAt, hasSource, overlay, onOpenSettings }: Props) {
  const connection = useConnectionState()
  const scene = useProgramScene()
  const now = useNow()

  const age = screenshotAt === undefined ? undefined : Math.max(0, now - screenshotAt)
  const stale = hasSource && (age === undefined || age > STALE_AFTER_MS)

  return (
    <div className="statusbar">
      <button className={`connection ${connection}`} aria-label="Connection settings" onClick={onOpenSettings}>
        {CONNECTION_LABELS[connection]}
      </button>
      {connection === "connected" && <span>Scene: {scene ?? "–"}</span>}
      {connection === "connected" && <OverlayStatus {...overlay} />}
      <span className={stale ? "stale" : ""}>Image: {screenshotLabel(age, hasSource)}</span>
    </div>
  )
}
