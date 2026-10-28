import { useEffect, useRef, type PointerEvent as ReactPointerEvent } from "react"
import { startRenderLoop, type View } from "../render"
import { session } from "./connection"
import { centerOn } from "./view"

interface Props {
  view: View
  image?: string
  onViewChange: (view: View) => void
}

export function Minimap({ view, image, onViewChange }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => startRenderLoop(canvasRef.current!, session.board), [])

  const navigate = (event: ReactPointerEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect()
    onViewChange(centerOn(view, [(event.clientX - rect.left) / rect.width, (event.clientY - rect.top) / rect.height]))
  }

  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId)
    navigate(event)
  }

  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) navigate(event)
  }

  return (
    <div className={`minimap ${view.zoom > 1 ? "visible" : ""}`} onPointerDown={onPointerDown} onPointerMove={onPointerMove}>
      {image && <img src={image} alt="" />}
      <canvas ref={canvasRef} />
      <div
        className="minimap-viewport"
        style={{
          left: `${view.x * 100}%`,
          top: `${view.y * 100}%`,
          width: `${100 / view.zoom}%`,
          height: `${100 / view.zoom}%`,
        }}
      />
    </div>
  )
}
