import { Eye, EyeOff, Plus } from "lucide-react"
import { useEffect, useState } from "react"
import { useConnectionState, useProgramScene, type ConnectionState, type OverlayVisibility } from "./hooks"

const STALE_AFTER_MS = 3000

const CONNECTION_LABELS: Record<ConnectionState, string> = {
  connected: "Verbunden",
  connecting: "Verbinde…",
  "auth-failed": "Passwort falsch",
}

interface Props {
  screenshotAt?: number
  hasSource: boolean
  overlay: OverlayVisibility
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
  if (!hasSource) return "Keine Quelle"
  if (age === undefined) return "Warte auf Bild…"
  return `vor ${Math.floor(age / 1000)} s`
}

function OverlayStatus({ names, visible, toggle, create }: OverlayVisibility) {
  if (names.length === 0) {
    return (
      <button className="overlay-toggle missing" onClick={create}>
        <Plus size={14} />
        Overlay anlegen
      </button>
    )
  }

  const name = names.length > 1 ? `${names[0]} (+${names.length - 1})` : names[0]
  const Icon = visible ? Eye : EyeOff
  return (
    <button
      className={`overlay-toggle ${visible ? "" : "off"}`}
      aria-label={visible ? "Overlay ausblenden" : "Overlay einblenden"}
      onClick={toggle}
    >
      <Icon size={14} />
      Overlay: {name}
    </button>
  )
}

export function StatusBar({ screenshotAt, hasSource, overlay }: Props) {
  const connection = useConnectionState()
  const scene = useProgramScene()
  const now = useNow()

  const age = screenshotAt === undefined ? undefined : Math.max(0, now - screenshotAt)
  const stale = hasSource && (age === undefined || age > STALE_AFTER_MS)

  return (
    <div className="statusbar">
      <span className={`connection ${connection}`}>{CONNECTION_LABELS[connection]}</span>
      {connection === "connected" && <span>Szene: {scene ?? "–"}</span>}
      {connection === "connected" && <OverlayStatus {...overlay} />}
      <span className={stale ? "stale" : ""}>Bild: {screenshotLabel(age, hasSource)}</span>
    </div>
  )
}
