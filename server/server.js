import { readFile } from "node:fs/promises"
import { createServer } from "node:http"
import { extname, join, resolve, sep } from "node:path"

const CONTENT_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
}

/** @param {string} root */
export function createAppServer(root) {
  const assets = join(root, "assets") + sep

  return createServer(async (request, response) => {
    const file = resolveFile(root, request.url ?? "/")
    const type = file && CONTENT_TYPES[/** @type {keyof typeof CONTENT_TYPES} */ (extname(file))]
    if (!file || !type) return response.writeHead(404).end()

    try {
      const body = await readFile(file)
      response.writeHead(200, {
        "content-type": type,
        "cache-control": file.startsWith(assets) ? "public, max-age=31536000, immutable" : "no-cache",
      })
      response.end(body)
    } catch {
      response.writeHead(404).end()
    }
  })
}

/**
 * @param {string} root
 * @param {string} url
 */
function resolveFile(root, url) {
  try {
    const { pathname } = new URL(url, "http://localhost")
    const file = resolve(root, `.${decodeURIComponent(pathname === "/" ? "/index.html" : pathname)}`)
    return file.startsWith(root + sep) ? file : undefined
  } catch {
    return undefined
  }
}

/**
 * Listens on `port`, or on the next free one if it is taken.
 * @param {import("node:http").Server} server
 * @param {number} port
 * @param {number} attempts
 */
export async function listen(server, port, attempts) {
  for (let candidate = port; candidate < port + attempts; candidate++) {
    try {
      await new Promise((resolve, reject) => {
        server.once("error", reject)
        server.listen(candidate, () => {
          server.off("error", reject)
          resolve(undefined)
        })
      })
      return candidate
    } catch (error) {
      if (/** @type {NodeJS.ErrnoException} */ (error).code !== "EADDRINUSE") throw error
    }
  }
  throw new Error(`Ports ${port}–${port + attempts - 1} are all in use.`)
}
