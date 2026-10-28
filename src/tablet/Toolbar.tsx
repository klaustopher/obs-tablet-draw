import {
  ChevronDown,
  Circle,
  Eraser,
  Highlighter,
  Laser,
  MonitorPlay,
  MoveUpRight,
  Pen,
  Redo2,
  Slash,
  SlidersHorizontal,
  Square,
  Trash,
  Undo2,
  type LucideIcon,
} from "lucide-react"
import { useState, type ReactNode } from "react"
import { createPortal } from "react-dom"
import type { Tool } from "../protocol"
import { session } from "./connection"
import { NO_SOURCE, PROGRAM_SOURCE, useConnectionState, type ObsInfo } from "./hooks"

export type Mode = Tool | "eraser"

const MODES: { mode: Mode; label: string; icon: LucideIcon }[] = [
  { mode: "pen", label: "Pen", icon: Pen },
  { mode: "highlighter", label: "Highlighter", icon: Highlighter },
  { mode: "laser", label: "Laser", icon: Laser },
  { mode: "line", label: "Line", icon: Slash },
  { mode: "arrow", label: "Arrow", icon: MoveUpRight },
  { mode: "rect", label: "Rectangle", icon: Square },
  { mode: "ellipse", label: "Ellipse", icon: Circle },
  { mode: "eraser", label: "Eraser", icon: Eraser },
]

export const COLORS = ["#ff3b30", "#ffcc00", "#34c759", "#0a84ff", "#ffffff", "#000000"]

const SIZE_PRESETS = [3, 6, 12, 20]
const MIN_SIZE = 1
const MAX_SIZE = 40
const MAX_PREVIEW_DOT = 24
const POPOVER_HALF_WIDTH = 140
const ICON_SIZE = 20

interface PickerProps<T> {
  value: T
  onChange: (value: T) => void
  compact: boolean
}

interface PopoverProps {
  anchor: DOMRect
  onClose: () => void
  className?: string
  children: ReactNode
}

function Popover({ anchor, onClose, className = "", children }: PopoverProps) {
  const left = Math.min(Math.max(anchor.left + anchor.width / 2, POPOVER_HALF_WIDTH), innerWidth - POPOVER_HALF_WIDTH)

  return createPortal(
    <div className="popover-backdrop" onPointerDown={onClose}>
      <div
        className={`popover ${className}`}
        style={{ top: anchor.bottom + 10, left }}
        onPointerDown={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>,
    document.body,
  )
}

interface CompactGroupProps {
  label: string
  preview: ReactNode
  popoverClassName?: string
  children: (close: () => void) => ReactNode
}

function CompactGroup({ label, preview, popoverClassName, children }: CompactGroupProps) {
  const [anchor, setAnchor] = useState<DOMRect>()
  const close = () => setAnchor(undefined)

  return (
    <div className="group">
      <button
        className={`tool compact ${anchor ? "active" : ""}`}
        aria-label={label}
        onClick={(e) => setAnchor(e.currentTarget.getBoundingClientRect())}
      >
        {preview}
        <ChevronDown size={12} />
      </button>
      {anchor && (
        <Popover anchor={anchor} onClose={close} className={popoverClassName}>
          {children(close)}
        </Popover>
      )}
    </div>
  )
}

export function ToolPicker({ value, onChange, compact }: PickerProps<Mode>) {
  const buttons = (onPick: (mode: Mode) => void) =>
    MODES.map(({ mode, label, icon: Icon }) => (
      <button key={mode} className={`tool ${value === mode ? "active" : ""}`} aria-label={label} onClick={() => onPick(mode)}>
        <Icon size={ICON_SIZE} />
      </button>
    ))

  if (!compact) return <div className="group">{buttons(onChange)}</div>

  const { label, icon: Current } = MODES.find(({ mode }) => mode === value)!
  return (
    <CompactGroup label={`Tool: ${label}`} preview={<Current size={ICON_SIZE} />} popoverClassName="tool-grid">
      {(close) =>
        buttons((mode) => {
          onChange(mode)
          close()
        })
      }
    </CompactGroup>
  )
}

export function ColorPicker({ value, onChange, compact }: PickerProps<string>) {
  const swatches = (
    <>
      {COLORS.map((color) => (
        <button
          key={color}
          className={`swatch ${value === color ? "active" : ""}`}
          style={{ background: color }}
          aria-label={color}
          onClick={() => onChange(color)}
        />
      ))}
      <input
        type="color"
        className={`swatch ${COLORS.includes(value) ? "" : "active"}`}
        value={value}
        aria-label="Custom color"
        onChange={(e) => onChange(e.target.value)}
      />
    </>
  )

  if (!compact) return <div className="group">{swatches}</div>

  return (
    <CompactGroup
      label="Color"
      preview={<span className="color-preview" style={{ background: value }} />}
      popoverClassName="swatch-row"
    >
      {() => swatches}
    </CompactGroup>
  )
}

function SizeDot({ size, color }: { size: number; color: string }) {
  return <span className="size-dot" style={{ width: size, height: size, background: color }} />
}

function SizeSlider({ value, color, onChange }: Omit<PickerProps<number>, "compact"> & { color: string }) {
  return (
    <div className="size-slider">
      <span className="size-preview">
        <SizeDot size={value} color={color} />
      </span>
      <input type="range" min={MIN_SIZE} max={MAX_SIZE} value={value} onChange={(e) => onChange(Number(e.target.value))} />
      <span className="size-value">{value}</span>
    </div>
  )
}

export function SizePicker({ value, color, onChange, compact }: PickerProps<number> & { color: string }) {
  const [sliderAnchor, setSliderAnchor] = useState<DOMRect>()

  const presets = SIZE_PRESETS.map((size) => (
    <button
      key={size}
      className={`tool ${value === size ? "active" : ""}`}
      aria-label={`Stroke width ${size}`}
      onClick={() => onChange(size)}
    >
      <SizeDot size={size + 4} color={color} />
    </button>
  ))
  const slider = <SizeSlider value={value} color={color} onChange={onChange} />

  if (compact) {
    return (
      <CompactGroup
        label="Stroke width"
        preview={<SizeDot size={Math.min(value + 4, MAX_PREVIEW_DOT)} color={color} />}
        popoverClassName="size-popover stacked"
      >
        {() => (
          <>
            <div className="popover-row">{presets}</div>
            {slider}
          </>
        )}
      </CompactGroup>
    )
  }

  return (
    <div className="group">
      {presets}
      <button
        className={`tool ${SIZE_PRESETS.includes(value) ? "" : "active"}`}
        aria-label="Adjust stroke width"
        onClick={(e) => setSliderAnchor(e.currentTarget.getBoundingClientRect())}
      >
        <SlidersHorizontal size={ICON_SIZE} />
      </button>

      {sliderAnchor && (
        <Popover anchor={sliderAnchor} onClose={() => setSliderAnchor(undefined)} className="size-popover">
          {slider}
        </Popover>
      )}
    </div>
  )
}

export function HistoryControls() {
  const [clearAnchor, setClearAnchor] = useState<DOMRect>()
  const disconnected = useConnectionState() !== "connected"

  const clear = () => {
    session.clear()
    setClearAnchor(undefined)
  }

  return (
    <div className="group">
      <button className="tool" aria-label="Undo" disabled={disconnected} onClick={() => session.undo()}>
        <Undo2 size={ICON_SIZE} />
      </button>
      <button className="tool" aria-label="Redo" disabled={disconnected} onClick={() => session.redo()}>
        <Redo2 size={ICON_SIZE} />
      </button>
      <button
        className={`tool ${clearAnchor ? "active" : ""}`}
        aria-label="Clear everything"
        disabled={disconnected}
        onClick={(e) => setClearAnchor(e.currentTarget.getBoundingClientRect())}
      >
        <Trash size={ICON_SIZE} />
      </button>

      {clearAnchor && (
        <Popover anchor={clearAnchor} onClose={() => setClearAnchor(undefined)}>
          <span>Clear everything?</span>
          <button className="danger-button" disabled={disconnected} onClick={clear}>
            Clear
          </button>
        </Popover>
      )}
    </div>
  )
}

interface SourcePickerProps {
  source?: string
  info: ObsInfo | null
  onSourceChange: (source: string) => void
  compact: boolean
}

export function SourcePicker({ source, info, onSourceChange, compact }: SourcePickerProps) {
  return (
    <div className="group">
      <label className={`select ${compact ? "compact" : ""}`} aria-label="Source">
        <MonitorPlay size={ICON_SIZE} />
        <select value={source ?? NO_SOURCE} onChange={(e) => onSourceChange(e.target.value)} disabled={!info}>
          <option value={NO_SOURCE}>No source</option>
          <option value={PROGRAM_SOURCE}>Program</option>
          <optgroup label="Scenes">
            {info?.scenes.map((name) => (
              <option key={name}>{name}</option>
            ))}
          </optgroup>
          <optgroup label="Sources">
            {info?.inputs.map((name) => (
              <option key={name}>{name}</option>
            ))}
          </optgroup>
        </select>
      </label>
    </div>
  )
}
