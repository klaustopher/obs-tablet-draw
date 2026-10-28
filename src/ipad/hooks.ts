import { useEffect, useState } from "react"
import { obs, session } from "./connection"

const SCREENSHOT_INTERVAL_MS = 1000
const PREVIEW_SCREENSHOT_WIDTH = 1600
const MAX_SCREENSHOT_WIDTH = 4096
const OBS_SOURCE_VIDEO = 1 << 0

const AUTHENTICATION_FAILED_CLOSE_CODE = 4009
const OVERLAY_MARKER = "obs_draw_overlay"
const OVERLAY_INPUT_NAME = "OBS Draw Overlay"

export const PROGRAM_SOURCE = "obs-draw:program"
export const NO_SOURCE = ""

export type ConnectionState = "connected" | "connecting" | "auth-failed"

export interface ObsInfo {
  inputs: string[]
  scenes: string[]
  aspect: number
  baseWidth: number
}

export function screenshotWidth(info: ObsInfo | null, zoomed: boolean) {
  return zoomed && info ? Math.min(info.baseWidth, MAX_SCREENSHOT_WIDTH) : PREVIEW_SCREENSHOT_WIDTH
}

export function useMediaQuery(query: string) {
  const [matches, setMatches] = useState(() => matchMedia(query).matches)

  useEffect(() => {
    const list = matchMedia(query)
    const update = () => setMatches(list.matches)
    list.addEventListener("change", update)
    update()
    return () => list.removeEventListener("change", update)
  }, [query])

  return matches
}

export function useStoredState<T>(key: string, initial: T) {
  const [value, setValue] = useState<T>(() => {
    try {
      const stored = localStorage.getItem(key)
      return stored === null ? initial : (JSON.parse(stored) as T)
    } catch {
      return initial
    }
  })

  const update = (next: T) => {
    setValue(next)
    try {
      localStorage.setItem(key, JSON.stringify(next))
    } catch {
      // storage unavailable (private browsing); the value just won't persist
    }
  }

  return [value, update] as const
}

export function useConnectionState() {
  const [state, setState] = useState<ConnectionState>(obs.identified ? "connected" : "connecting")

  useEffect(() => {
    const identified = () => setState("connected")
    const closed = ({ code }: { code: number }) =>
      setState(code === AUTHENTICATION_FAILED_CLOSE_CODE ? "auth-failed" : "connecting")

    obs.on("Identified", identified)
    obs.on("ConnectionClosed", closed)
    return () => {
      obs.off("Identified", identified)
      obs.off("ConnectionClosed", closed)
    }
  }, [])

  return state
}

export function useProgramScene() {
  const [scene, setScene] = useState<string>()

  useEffect(() => {
    const load = async () => setScene((await obs.call("GetCurrentProgramScene")).currentProgramSceneName)
    const changed = ({ sceneName }: { sceneName: string }) => setScene(sceneName)

    obs.on("Identified", load)
    obs.on("CurrentProgramSceneChanged", changed)
    if (obs.identified) load()
    return () => {
      obs.off("Identified", load)
      obs.off("CurrentProgramSceneChanged", changed)
    }
  }, [])

  return scene
}

async function findOverlayInputs() {
  const { inputs } = await obs.call("GetInputList", { inputKind: "browser_source" })
  const names = await Promise.all(
    inputs.map(async (input) => {
      const inputName = String(input.inputName)
      const { inputSettings } = await obs.call("GetInputSettings", { inputName })
      return inputSettings[OVERLAY_MARKER] === true ? inputName : undefined
    }),
  )
  return names.filter((name) => name !== undefined)
}

async function overlayItemsOf(sceneName: string, overlayNames: string[]) {
  const { sceneItems } = await obs.call("GetSceneItemList", { sceneName })
  return sceneItems.filter((item) => overlayNames.includes(String(item.sourceName)))
}

function overlayUrl() {
  const url = new URL("overlay.html", location.href)
  url.hostname = "localhost"
  url.search = location.search
  url.searchParams.delete("host")
  return url.toString()
}

export function useOverlayVisibility() {
  const [names, setNames] = useState<string[]>([])
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    let overlayNames: string[] = []

    const refresh = async () => {
      if (overlayNames.length === 0) return
      const { currentProgramSceneName } = await obs.call("GetCurrentProgramScene")
      const items = await overlayItemsOf(currentProgramSceneName, overlayNames)
      setVisible(items.some((item) => item.sceneItemEnabled))
    }
    const load = async () => {
      overlayNames = await findOverlayInputs()
      setNames(overlayNames)
      await refresh()
    }

    const loadEvents = ["Identified", "InputCreated", "InputRemoved", "InputNameChanged"] as const
    const refreshEvents = [
      "SceneItemCreated",
      "SceneItemRemoved",
      "SceneItemEnableStateChanged",
      "CurrentProgramSceneChanged",
    ] as const

    loadEvents.forEach((event) => obs.on(event, load))
    refreshEvents.forEach((event) => obs.on(event, refresh))
    if (obs.identified) load()
    return () => {
      loadEvents.forEach((event) => obs.off(event, load))
      refreshEvents.forEach((event) => obs.off(event, refresh))
    }
  }, [])

  const toggle = async () => {
    const { scenes } = await obs.call("GetSceneList")
    await Promise.all(
      scenes.map(async (scene) => {
        const sceneName = String(scene.sceneName)
        const items = await overlayItemsOf(sceneName, names)
        await Promise.all(
          items.map((item) =>
            obs.call("SetSceneItemEnabled", {
              sceneName,
              sceneItemId: Number(item.sceneItemId),
              sceneItemEnabled: !visible,
            }),
          ),
        )
      }),
    )
  }

  const create = async () => {
    const [{ currentProgramSceneName }, video] = await Promise.all([
      obs.call("GetCurrentProgramScene"),
      obs.call("GetVideoSettings"),
    ])
    await obs.call("CreateInput", {
      sceneName: currentProgramSceneName,
      inputName: OVERLAY_INPUT_NAME,
      inputKind: "browser_source",
      inputSettings: {
        url: overlayUrl(),
        width: video.baseWidth,
        height: video.baseHeight,
        [OVERLAY_MARKER]: true,
      },
      sceneItemEnabled: true,
    })
  }

  return { names, visible, toggle, create }
}

export type OverlayVisibility = ReturnType<typeof useOverlayVisibility>

export function useObsInfo() {
  const [info, setInfo] = useState<ObsInfo | null>(null)

  useEffect(() => {
    const load = async () => {
      const [{ inputs }, { scenes }, video] = await Promise.all([
        obs.call("GetInputList"),
        obs.call("GetSceneList"),
        obs.call("GetVideoSettings"),
      ])
      setInfo({
        inputs: inputs
          .filter((input) => Number(input.inputKindCaps) & OBS_SOURCE_VIDEO)
          .map((input) => String(input.inputName)),
        scenes: scenes.map((scene) => String(scene.sceneName)),
        aspect: video.baseWidth / video.baseHeight,
        baseWidth: video.baseWidth,
      })
    }
    const reset = () => setInfo(null)

    obs.on("Identified", load)
    obs.on("ConnectionClosed", reset)
    if (obs.identified) load()
    return () => {
      obs.off("Identified", load)
      obs.off("ConnectionClosed", reset)
    }
  }, [])

  return info
}

export function useScreenshot(sourceName: string | undefined, width: number) {
  const [screenshot, setScreenshot] = useState<{ image: string; takenAt: number }>()

  useEffect(() => {
    if (!sourceName) return
    let inFlight = false

    const interval = setInterval(async () => {
      if (inFlight || session.drawing) return
      inFlight = true
      try {
        const name =
          sourceName === PROGRAM_SOURCE
            ? (await obs.call("GetCurrentProgramScene")).currentProgramSceneName
            : sourceName
        const { imageData } = await obs.call("GetSourceScreenshot", {
          sourceName: name,
          imageFormat: "jpg",
          imageWidth: width,
          imageCompressionQuality: 70,
        })
        setScreenshot({ image: imageData, takenAt: Date.now() })
      } catch {
        // OBS disconnected or source has no video; keep the last frame
      } finally {
        inFlight = false
      }
    }, SCREENSHOT_INTERVAL_MS)

    return () => clearInterval(interval)
  }, [sourceName, width])

  return screenshot
}
