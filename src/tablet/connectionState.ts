const AUTHENTICATION_FAILED_CLOSE_CODE = 4009

export type ConnectionState = "connecting" | "connected" | "unreachable" | "password-missing" | "wrong-password"

export function stateAfterClose(opened: boolean, code: number, hasPassword: boolean): ConnectionState {
  if (!opened) return "unreachable"
  if (code === AUTHENTICATION_FAILED_CLOSE_CODE) return hasPassword ? "wrong-password" : "password-missing"
  return "connecting"
}
