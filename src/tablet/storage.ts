export function readStored<T>(key: string, initial: T): T {
  try {
    const stored = localStorage.getItem(key)
    return stored === null ? initial : (JSON.parse(stored) as T)
  } catch {
    return initial
  }
}

export function writeStored<T>(key: string, value: T) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // storage unavailable (private browsing); the value just won't persist
  }
}
