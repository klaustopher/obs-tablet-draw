import { useState } from "react"
import { FULL_VIEW } from "../render"
import {
  NO_SOURCE,
  PROGRAM_SOURCE,
  screenshotWidth,
  useMediaQuery,
  useObsInfo,
  useOverlayVisibility,
  useScreenshot,
  useStoredState,
  type ObsInfo,
} from "./hooks"
import { Stage } from "./Stage"
import { StatusBar } from "./StatusBar"
import { COLORS, ColorPicker, HistoryControls, SizePicker, SourcePicker, ToolPicker, type Mode } from "./Toolbar"

const COMPACT_TOOLBAR_QUERY = "(max-width: 700px), (max-height: 500px)"

function resolveSource(selected: string | undefined, info: ObsInfo | null) {
  if (!info || selected === NO_SOURCE) return undefined
  const available = [PROGRAM_SOURCE, ...info.scenes, ...info.inputs]
  return selected && available.includes(selected) ? selected : info.inputs[0]
}

export function App() {
  const [mode, setMode] = useStoredState<Mode>("obs-draw:mode", "pen")
  const [color, setColor] = useStoredState("obs-draw:color", COLORS[0])
  const [size, setSize] = useStoredState("obs-draw:size", 6)
  const [selectedSource, selectSource] = useStoredState<string | undefined>("obs-draw:source", undefined)
  const [view, setView] = useState(FULL_VIEW)
  const compact = useMediaQuery(COMPACT_TOOLBAR_QUERY)

  const info = useObsInfo()
  const source = resolveSource(selectedSource, info)
  const screenshot = useScreenshot(source, screenshotWidth(info, view.zoom > 1))
  const overlay = useOverlayVisibility()

  return (
    <div className="app">
      <header className="toolbar">
        <ToolPicker value={mode} onChange={setMode} compact={compact} />
        <ColorPicker value={color} onChange={setColor} compact={compact} />
        <SizePicker value={size} color={color} onChange={setSize} compact={compact} />
        <HistoryControls />
        <SourcePicker source={source} info={info} onSourceChange={selectSource} compact={compact} />
      </header>

      <main className="stage-area">
        <Stage
          aspect={info?.aspect ?? 16 / 9}
          image={source ? screenshot?.image : undefined}
          brush={mode === "eraser" ? undefined : { tool: mode, color, size }}
          dimmed={overlay.names.length > 0 && !overlay.visible}
          view={view}
          onViewChange={setView}
        />
      </main>

      <StatusBar screenshotAt={screenshot?.takenAt} hasSource={source !== undefined} overlay={overlay} />
    </div>
  )
}
