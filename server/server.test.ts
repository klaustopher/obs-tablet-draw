import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises"
import type { Server } from "node:http"
import type { AddressInfo } from "node:net"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { createAppServer, listen } from "./server.js"

let outside: string
let root: string
let base: string
const servers: Server[] = []

function start() {
  const server = createAppServer(root)
  servers.push(server)
  return server
}

beforeAll(async () => {
  outside = await mkdtemp(join(tmpdir(), "obs-tablet-draw-"))
  root = join(outside, "dist")
  await mkdir(join(root, "assets"), { recursive: true })
  await writeFile(join(root, "index.html"), "<h1>app</h1>")
  await writeFile(join(root, "overlay.html"), "<canvas></canvas>")
  await writeFile(join(root, "assets", "index-abc.js"), "console.log(1)")
  await writeFile(join(root, "assets", "index-abc.css"), "body{}")
  await writeFile(join(root, "notes.md"), "# hidden")
  await writeFile(join(outside, "secret.html"), "secret")

  await listen(start(), 0, 1)
  base = `http://localhost:${(servers[0].address() as AddressInfo).port}`
})

afterAll(async () => {
  servers.forEach((server) => server.close())
  await rm(outside, { recursive: true })
})

describe("createAppServer", () => {
  it("serves index.html at the root without caching", async () => {
    const response = await fetch(`${base}/?password=secret`)

    expect(response.status).toBe(200)
    expect(response.headers.get("content-type")).toBe("text/html; charset=utf-8")
    expect(response.headers.get("cache-control")).toBe("no-cache")
    expect(await response.text()).toBe("<h1>app</h1>")
  })

  it("serves the overlay page", async () => {
    const response = await fetch(`${base}/overlay.html`)

    expect(await response.text()).toBe("<canvas></canvas>")
  })

  it("serves hashed assets with long-term caching", async () => {
    const script = await fetch(`${base}/assets/index-abc.js`)
    const style = await fetch(`${base}/assets/index-abc.css`)

    expect(script.headers.get("content-type")).toBe("text/javascript; charset=utf-8")
    expect(script.headers.get("cache-control")).toBe("public, max-age=31536000, immutable")
    expect(style.headers.get("content-type")).toBe("text/css; charset=utf-8")
  })

  it("answers 404 for missing files and unknown file types", async () => {
    expect((await fetch(`${base}/missing.html`)).status).toBe(404)
    expect((await fetch(`${base}/notes.md`)).status).toBe(404)
    expect((await fetch(`${base}/assets`)).status).toBe(404)
  })

  it("does not serve files outside the root", async () => {
    expect((await fetch(`${base}/..%2Fsecret.html`)).status).toBe(404)
    expect((await fetch(`${base}/%E0%A4%A`)).status).toBe(404)
  })
})

describe("listen", () => {
  it("falls back to the next port when the preferred one is taken", async () => {
    const taken = (servers[0].address() as AddressInfo).port

    expect(await listen(start(), taken, 2)).toBe(taken + 1)
  })

  it("gives up after the given number of attempts", async () => {
    const taken = (servers[0].address() as AddressInfo).port

    await expect(listen(start(), taken, 1)).rejects.toThrow(`Ports ${taken}–${taken} are all in use.`)
  })
})
