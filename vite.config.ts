import { styleText } from "node:util"
import { defineConfig, type Plugin, type PreviewServer, type ViteDevServer } from "vite"
import react from "@vitejs/plugin-react"

const PASSWORD_PLACEHOLDER = "?password=YOUR_PASSWORD"

const allowedHosts = [
  ".local",
  ...(process.env.OBS_DRAW_ALLOWED_HOSTS ?? "")
    .split(",")
    .map((host) => host.trim())
    .filter(Boolean),
]

function printAppUrls(server: ViteDevServer | PreviewServer) {
  const printUrls = server.printUrls
  server.printUrls = () => {
    printUrls()
    const network = server.resolvedUrls?.network ?? []
    const label = (text: string) => styleText("bold", text.padEnd(18))
    const url = (base: string) => styleText("cyan", `${base}${PASSWORD_PLACEHOLDER}`)

    console.log()
    network.forEach((base, i) => console.log(`  ${label(i === 0 ? "Tablet / phone:" : "")}${url(base)}`))
    if (network.length === 0) console.log(`  ${label("Tablet / phone:")}not reachable, start the server with --host`)
    console.log()
  }
}

function appUrls(): Plugin {
  return {
    name: "obs-tablet-draw:app-urls",
    configureServer: printAppUrls,
    configurePreviewServer: printAppUrls,
  }
}

export default defineConfig({
  plugins: [react(), appUrls()],
  server: {
    allowedHosts,
  },
  preview: {
    port: 4173,
    strictPort: true,
    allowedHosts,
  },
  build: {
    rollupOptions: {
      input: ["index.html", "overlay.html"],
    },
  },
})
