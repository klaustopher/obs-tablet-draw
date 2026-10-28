import { describe, expect, it } from "vitest"
import { FULL_VIEW } from "../render"
import { centerOn, clampView, toContent, zoomAround } from "./view"

describe("clampView", () => {
  it("limits zoom to 1..5", () => {
    expect(clampView({ zoom: 0.5, x: 0, y: 0 }).zoom).toBe(1)
    expect(clampView({ zoom: 8, x: 0, y: 0 }).zoom).toBe(5)
  })

  it("keeps the visible area inside the content", () => {
    expect(clampView({ zoom: 2, x: -0.3, y: 0.9 })).toEqual({ zoom: 2, x: 0, y: 0.5 })
    expect(clampView({ zoom: 1, x: 0.4, y: 0.4 })).toEqual(FULL_VIEW)
  })
})

describe("zoomAround", () => {
  it("keeps the content under the fingers in place", () => {
    const start = { zoom: 2, x: 0.25, y: 0.25 }
    const fingers: [number, number] = [0.5, 0.5]
    const zoomed = zoomAround(start, fingers, fingers, 4)

    expect(zoomed.zoom).toBe(4)
    expect(toContent(zoomed, fingers)).toEqual(toContent(start, fingers))
  })

  it("pans with the fingers", () => {
    const zoomed = zoomAround({ zoom: 2, x: 0.25, y: 0.25 }, [0.5, 0.5], [0.4, 0.5], 2)

    expect(zoomed.x).toBeCloseTo(0.3)
    expect(zoomed.y).toBeCloseTo(0.25)
  })
})

describe("centerOn", () => {
  it("centers the view on a content point", () => {
    expect(centerOn({ zoom: 4, x: 0, y: 0 }, [0.5, 0.5])).toEqual({ zoom: 4, x: 0.375, y: 0.375 })
  })

  it("stops at the content edges", () => {
    expect(centerOn({ zoom: 2, x: 0, y: 0 }, [1, 0])).toEqual({ zoom: 2, x: 0.5, y: 0 })
  })
})
