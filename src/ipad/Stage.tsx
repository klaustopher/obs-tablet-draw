import { useEffect, useRef, type PointerEvent as ReactPointerEvent } from "react"
import type { Point } from "../protocol"
import { FULL_VIEW, startRenderLoop, type View } from "../render"
import { session } from "./connection"
import { Minimap } from "./Minimap"
import type { Brush } from "./session"
import { clampView, toContent, zoomAround } from "./view"

const ERASER_RADIUS = 12
const SNAP_ANGLE = Math.PI / 4
const WHEEL_ZOOM_SPEED = 0.01
const MAX_WHEEL_DELTA = 25
const WHEEL_LINE_HEIGHT = 16

type Vec = [number, number]

interface SafariGestureEvent extends UIEvent {
  scale: number
  clientX: number
  clientY: number
}

interface Gesture {
  startView: View
  startCenter: Vec
  startDistance: number
}

interface Props {
  aspect: number
  image?: string
  brush?: Brush
  dimmed: boolean
  view: View
  onViewChange: (view: View) => void
}

export function Stage({ aspect, image, brush, dimmed, view, onViewChange }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const viewRef = useRef(view)
  const erasing = useRef(false)
  const startPoint = useRef<Point>(undefined)
  const activePointer = useRef<{ id: number; touch: boolean }>(undefined)
  const penDetected = useRef(false)
  const touches = useRef(new Map<number, Vec>())
  const gesture = useRef<Gesture>(undefined)

  useEffect(() => {
    viewRef.current = view
  }, [view])

  useEffect(() => startRenderLoop(canvasRef.current!, session.board, () => viewRef.current), [])

  const toScreen = ([clientX, clientY]: Vec): Vec => {
    const rect = canvasRef.current!.getBoundingClientRect()
    return [(clientX - rect.left) / rect.width, (clientY - rect.top) / rect.height]
  }

  useEffect(() => {
    const canvas = canvasRef.current!
    let safariGesture: { startView: View; startPoint: Vec } | undefined

    const applyView = (next: View) => {
      viewRef.current = next
      onViewChange(next)
    }

    const onWheel = (event: WheelEvent) => {
      event.preventDefault()
      if (safariGesture) return
      const view = viewRef.current
      const lineScale = event.deltaMode === WheelEvent.DOM_DELTA_LINE ? WHEEL_LINE_HEIGHT : 1

      if (event.ctrlKey || event.metaKey) {
        const delta = Math.max(-MAX_WHEEL_DELTA, Math.min(MAX_WHEEL_DELTA, event.deltaY * lineScale))
        const point = toScreen([event.clientX, event.clientY])
        applyView(zoomAround(view, point, point, view.zoom * Math.exp(-delta * WHEEL_ZOOM_SPEED)))
      } else {
        const rect = canvas.getBoundingClientRect()
        applyView(
          clampView({
            ...view,
            x: view.x + (event.deltaX * lineScale) / rect.width / view.zoom,
            y: view.y + (event.deltaY * lineScale) / rect.height / view.zoom,
          }),
        )
      }
    }

    // Safari on macOS reports trackpad pinches as non-standard GestureEvents instead of ctrl+wheel.
    // iOS Safari fires them for touch pinches too, which the pointer handlers already cover.
    const onGestureStart = (event: Event) => {
      if (touches.current.size > 0) return
      event.preventDefault()
      const { clientX, clientY } = event as SafariGestureEvent
      safariGesture = { startView: viewRef.current, startPoint: toScreen([clientX, clientY]) }
    }

    const onGestureChange = (event: Event) => {
      if (!safariGesture) return
      event.preventDefault()
      const { scale, clientX, clientY } = event as SafariGestureEvent
      const { startView, startPoint } = safariGesture
      applyView(zoomAround(startView, startPoint, toScreen([clientX, clientY]), startView.zoom * scale))
    }

    const onGestureEnd = () => {
      safariGesture = undefined
    }

    canvas.addEventListener("wheel", onWheel, { passive: false })
    canvas.addEventListener("gesturestart", onGestureStart)
    canvas.addEventListener("gesturechange", onGestureChange)
    canvas.addEventListener("gestureend", onGestureEnd)
    return () => {
      canvas.removeEventListener("wheel", onWheel)
      canvas.removeEventListener("gesturestart", onGestureStart)
      canvas.removeEventListener("gesturechange", onGestureChange)
      canvas.removeEventListener("gestureend", onGestureEnd)
    }
  }, [onViewChange])

  const toPoint = (event: PointerEvent): Point => {
    const [x, y] = toContent(view, toScreen([event.clientX, event.clientY]))
    return [x, y, event.pointerType === "pen" ? event.pressure : 0.5]
  }

  const pinch = () => {
    const [a, b] = [...touches.current.values()]
    return {
      center: toScreen([(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]),
      distance: Math.max(1, Math.hypot(a[0] - b[0], a[1] - b[1])),
    }
  }

  const constrainToSquare = ([x, y, pressure]: Point): Point => {
    const rect = canvasRef.current!.getBoundingClientRect()
    const [startX, startY] = startPoint.current!
    const dx = (x - startX) * rect.width
    const dy = (y - startY) * rect.height
    const side = Math.max(Math.abs(dx), Math.abs(dy))
    return [startX + ((dx < 0 ? -1 : 1) * side) / rect.width, startY + ((dy < 0 ? -1 : 1) * side) / rect.height, pressure]
  }

  const snapToAngle = ([x, y, pressure]: Point): Point => {
    const rect = canvasRef.current!.getBoundingClientRect()
    const [startX, startY] = startPoint.current!
    const dx = (x - startX) * rect.width
    const dy = (y - startY) * rect.height
    const angle = Math.round(Math.atan2(dy, dx) / SNAP_ANGLE) * SNAP_ANGLE
    const length = Math.hypot(dx, dy)
    return [startX + (Math.cos(angle) * length) / rect.width, startY + (Math.sin(angle) * length) / rect.height, pressure]
  }

  const shiftConstraint = () => {
    if (brush?.tool === "rect" || brush?.tool === "ellipse") return constrainToSquare
    if (brush?.tool === "line" || brush?.tool === "arrow") return snapToAngle
  }

  const eraseAt = (event: PointerEvent) => {
    const rect = canvasRef.current!.getBoundingClientRect()
    session.erase(toPoint(event), ERASER_RADIUS, rect.width * view.zoom, rect.height * view.zoom)
  }

  const startGesture = () => {
    if (activePointer.current && !activePointer.current.touch) return
    if (activePointer.current) {
      session.cancel()
      erasing.current = false
      activePointer.current = undefined
    }
    const { center, distance } = pinch()
    gesture.current = { startView: view, startCenter: center, startDistance: distance }
  }

  const onPointerDown = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    const touch = event.pointerType === "touch"
    if (event.pointerType === "pen") penDetected.current = true

    if (touch) {
      touches.current.set(event.pointerId, [event.clientX, event.clientY])
      event.currentTarget.setPointerCapture(event.pointerId)
      if (touches.current.size === 2) startGesture()
      if (touches.current.size >= 2 || penDetected.current) return
    }

    if (activePointer.current) return
    activePointer.current = { id: event.pointerId, touch }
    event.currentTarget.setPointerCapture(event.pointerId)
    if (brush) {
      startPoint.current = toPoint(event.nativeEvent)
      session.begin(brush, startPoint.current)
    } else {
      erasing.current = true
      eraseAt(event.nativeEvent)
    }
  }

  const onPointerMove = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    if (touches.current.has(event.pointerId)) {
      touches.current.set(event.pointerId, [event.clientX, event.clientY])
      if (gesture.current && touches.current.size >= 2) {
        const { startView, startCenter, startDistance } = gesture.current
        const { center, distance } = pinch()
        onViewChange(zoomAround(startView, startCenter, center, (startView.zoom * distance) / startDistance))
      }
    }

    if (event.pointerId !== activePointer.current?.id) return
    const coalesced = event.nativeEvent.getCoalescedEvents?.() ?? []
    const events = coalesced.length > 0 ? coalesced : [event.nativeEvent]
    if (erasing.current) {
      events.forEach(eraseAt)
    } else if (session.drawing) {
      const points = events.map(toPoint)
      const constrain = event.shiftKey ? shiftConstraint() : undefined
      session.extend(constrain ? points.map(constrain) : points)
    }
  }

  const onPointerUp = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    if (touches.current.delete(event.pointerId) && touches.current.size < 2) gesture.current = undefined

    if (event.pointerId !== activePointer.current?.id) return
    activePointer.current = undefined
    erasing.current = false
    session.end()
  }

  return (
    <div className="stage" style={{ ["--aspect" as string]: aspect }}>
      {image && (
        <img
          src={image}
          alt=""
          style={{ transform: `scale(${view.zoom}) translate(${-view.x * 100}%, ${-view.y * 100}%)` }}
        />
      )}
      <canvas
        ref={canvasRef}
        className={dimmed ? "dimmed" : ""}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      />
      {view.zoom > 1 && (
        <button className="zoom-badge" aria-label="Zoom zurücksetzen" onClick={() => onViewChange(FULL_VIEW)}>
          {Math.round(view.zoom * 100)} %
        </button>
      )}
      <Minimap view={view} image={image} onViewChange={onViewChange} />
    </div>
  )
}
