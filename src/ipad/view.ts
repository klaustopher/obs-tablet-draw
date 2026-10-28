import type { View } from "../render"

const MAX_ZOOM = 5

type Vec = [number, number]

export function clampView({ zoom, x, y }: View): View {
  const clampedZoom = Math.min(MAX_ZOOM, Math.max(1, zoom))
  const maxOffset = 1 - 1 / clampedZoom
  return {
    zoom: clampedZoom,
    x: Math.min(maxOffset, Math.max(0, x)),
    y: Math.min(maxOffset, Math.max(0, y)),
  }
}

export function toContent(view: View, [screenX, screenY]: Vec): Vec {
  return [view.x + screenX / view.zoom, view.y + screenY / view.zoom]
}

export function zoomAround(start: View, startScreen: Vec, screen: Vec, zoom: number): View {
  const [contentX, contentY] = toContent(start, startScreen)
  const clampedZoom = Math.min(MAX_ZOOM, Math.max(1, zoom))
  return clampView({ zoom: clampedZoom, x: contentX - screen[0] / clampedZoom, y: contentY - screen[1] / clampedZoom })
}

export function centerOn(view: View, [contentX, contentY]: Vec): View {
  return clampView({ ...view, x: contentX - 0.5 / view.zoom, y: contentY - 0.5 / view.zoom })
}
