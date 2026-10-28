import type { ConnectionState } from "./connectionState"
import { url } from "./connection"
import { useConnectionState } from "./hooks"

const CONNECT_INFO = "OBS → Tools → WebSocket Server Settings → Show Connect Info"

const NOTICES: Record<Exclude<ConnectionState, "connected">, { title: string; hint?: string }> = {
  connecting: { title: "Connecting to OBS…" },
  unreachable: {
    title: "OBS is not reachable",
    hint: "Start OBS and check Enable WebSocket server under Tools → WebSocket Server Settings. If you changed the port there, add ?port=… to this page's URL.",
  },
  "password-missing": {
    title: "Password missing",
    hint: `Add ?password=… to this page's URL. You find the password under ${CONNECT_INFO}.`,
  },
  "wrong-password": {
    title: "Wrong password",
    hint: `Compare the password in this page's URL with the one under ${CONNECT_INFO}.`,
  },
}

export function ConnectionNotice() {
  const state = useConnectionState()
  if (state === "connected") return null

  const { title, hint } = NOTICES[state]
  return (
    <div className="connection-notice">
      <div className={`connection-card ${state}`}>
        <strong>{title}</strong>
        <code>{url}</code>
        {hint && <p>{hint}</p>}
      </div>
    </div>
  )
}
