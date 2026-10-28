import { useState, type FormEvent } from "react"
import { DEFAULT_OBS_PORT } from "../obs"
import { obsUrl, saveSettings } from "./connection"
import type { ConnectionState } from "./connectionState"
import { useConnectionSettings, useConnectionState } from "./hooks"

const CONNECT_INFO = "OBS → Tools → WebSocket Server Settings → Show Connect Info"

const TITLES: Record<ConnectionState, string> = {
  connecting: "Connecting to OBS…",
  connected: "Connected to OBS",
  unreachable: "OBS is not reachable",
  "password-missing": "Password missing",
  "wrong-password": "Wrong password",
}

const HINTS: Partial<Record<ConnectionState, string>> = {
  unreachable:
    "Start OBS and check Enable WebSocket server under Tools → WebSocket Server Settings. The port has to match the one there.",
  "password-missing": `Enter the password from ${CONNECT_INFO}.`,
  "wrong-password": `The password does not match the one under ${CONNECT_INFO}.`,
}

function ConnectionForm({ onSaved }: { onSaved: () => void }) {
  const settings = useConnectionSettings()
  const connected = useConnectionState() === "connected"
  const [password, setPassword] = useState("")
  const [port, setPort] = useState(String(settings.port))

  const submit = (event: FormEvent) => {
    event.preventDefault()
    saveSettings({ port: Number(port) || DEFAULT_OBS_PORT, password: password || settings.password })
    setPassword("")
    onSaved()
  }

  return (
    <form className="connection-form" onSubmit={submit}>
      <label>
        Password
        <input
          type="password"
          value={password}
          placeholder={settings.password ? "Saved – type to replace" : ""}
          onChange={(e) => setPassword(e.target.value)}
        />
      </label>
      <label>
        Port
        <input
          inputMode="numeric"
          pattern="[0-9]*"
          value={port}
          onChange={(e) => setPort(e.target.value)}
        />
      </label>
      <div className="connection-actions">
        {settings.password && (
          <button type="button" className="secondary-button" onClick={() => saveSettings({ ...settings, password: undefined })}>
            Forget password
          </button>
        )}
        <button type="submit" className="primary-button">
          {connected ? "Reconnect" : "Connect"}
        </button>
      </div>
    </form>
  )
}

interface Props {
  open: boolean
  onClose: () => void
}

export function ConnectionNotice({ open, onClose }: Props) {
  const state = useConnectionState()
  const settings = useConnectionSettings()
  if (state === "connected" && !open) return null

  const hint = HINTS[state]
  return (
    <div className="connection-notice">
      <div className={`connection-card ${state}`}>
        <strong>{TITLES[state]}</strong>
        <code>{obsUrl(settings)}</code>
        {hint && <p>{hint}</p>}
        {state !== "connecting" && <ConnectionForm onSaved={onClose} />}
        {state === "connected" && (
          <button className="secondary-button" onClick={onClose}>
            Close
          </button>
        )}
      </div>
    </div>
  )
}
