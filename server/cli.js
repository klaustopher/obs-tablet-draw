#!/usr/bin/env node
import { networkInterfaces } from "node:os"
import { fileURLToPath } from "node:url"
import { styleText } from "node:util"
import { createAppServer, listen } from "./server.js"

const PREFERRED_PORT = 3729
const PORT_ATTEMPTS = 10
const ROOT = fileURLToPath(new URL("../dist", import.meta.url))

const server = createAppServer(ROOT)

try {
  const port = await listen(server, PREFERRED_PORT, PORT_ATTEMPTS)
  const addresses = Object.values(networkInterfaces())
    .flat()
    .filter((address) => address?.family === "IPv4" && !address.internal)
    .map((address) => address?.address)

  console.log()
  if (port !== PREFERRED_PORT) console.log(styleText("yellow", `  Port ${PREFERRED_PORT} is in use, using ${port} instead.\n`))
  addresses.forEach((address, i) => {
    const label = styleText("bold", (i === 0 ? "Tablet / phone:" : "").padEnd(18))
    console.log(`  ${label}${styleText("cyan", `http://${address}:${port}/?password=OBS_WEBSOCKET_PASSWORD`)}`)
  })
  if (addresses.length === 0) console.log("  Not reachable from other devices – no network connection found.")
  console.log("\n  Press Ctrl+C to stop.\n")
} catch (error) {
  console.error(styleText("red", `  ${/** @type {Error} */ (error).message}`))
  process.exitCode = 1
}
