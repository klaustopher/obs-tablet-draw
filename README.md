# OBS Tablet Draw

Draw on top of the current OBS output from a tablet (or phone) – with a stylus such as the Apple Pencil, pressure sensitivity, shapes, a laser pointer and zoom. Strokes appear live as an overlay in the stream.

```
Tablet (browser)  ──ws──►  obs-websocket  ──CustomEvent──►  Browser Source (overlay)
         ▲                       │
         └── GetSourceScreenshot ┘   (background image, ~1×/s)
```

- There is no OBS plugin. Everything runs through the WebSocket server built into OBS (obs-websocket v5, OBS 28 and later).
- **`index.html`** is the drawing app for the tablet.
- **`overlay.html`** is the Browser Source in OBS: a transparent canvas on which the strokes appear.
- A small web server on the machine running OBS serves both pages.

Runs on **Windows, macOS and Linux**.

## Requirements

- OBS ≥ 28 with **Browser Source**. The official builds for Windows and macOS include it. Some Linux distribution packages lack it; use the official Flatpak or a package with browser support (CEF) instead.
- [Node.js](https://nodejs.org) ≥ 22.12
- Tablet or phone and the OBS machine on the **same network**, without client isolation (see [Troubleshooting](#troubleshooting))

## Setup

### 1. Enable the WebSocket server in OBS

*Tools → WebSocket Server Settings*:
1. Check *Enable WebSocket server*.
2. Keep port `4455`.
3. Copy the password from *Show Connect Info*.

### 2. Start the server

On the machine running OBS, open a terminal (on Windows: PowerShell or Command Prompt) and run:

```sh
npx obs-tablet-draw@latest
```

Start it before the stream and simply quit it afterwards (close the window or press `Ctrl+C`). `@latest` makes sure you always get the newest release.

The app then runs on port **3729** (*DRAW* on a phone keypad) on all network interfaces. If that port is taken, it picks the next free one; overlays that already exist in OBS are updated automatically as soon as the tablet connects. On startup the window shows the complete URL for the tablet – replace `OBS_WEBSOCKET_PASSWORD` with the password from step 1. On the first start the firewall may ask – allow access on **private** networks.

### 3. Tablet / phone

Open in the browser:

```
http://<address-of-the-machine>:3729/?password=OBS_WEBSOCKET_PASSWORD
```

The address can be the **IP** of the OBS machine, e.g. `192.168.1.20`; the server prints it on startup. The **local hostname** `<name>.local` is more stable, if your system announces it on the network:

- **macOS:** always, found under *System Settings → General → Sharing → Local hostname*
- **Linux:** with a running `avahi-daemon`
- **Windows:** not reliable, use the IP if in doubt

Added to the home screen (Safari: *Share → Add to Home Screen*), the app runs full screen without the browser bar.

The first time, tap **Create overlay** in the status bar – the app sets up the Browser Source in OBS by itself.

## URL parameters

| Parameter  | Default                         | Meaning                       |
| ---------- | ------------------------------- | ----------------------------- |
| `password` | –                               | Password of the OBS WebSocket |
| `host`     | Host the page was loaded from   | Machine running OBS           |
| `port`     | `4455`                          | Port of the OBS WebSocket     |

The parameters apply to both pages (tablet and overlay).

## Usage

### Tools

| Tool        | Behavior                                                     | With Shift  |
| ----------- | ------------------------------------------------------------ | ----------- |
| Pen         | Freehand, pressure-sensitive                                 | –           |
| Highlighter | Wide, semi-transparent                                       | –           |
| Laser       | Glowing trail, fades after 700 ms, not part of undo          | –           |
| Line        | Straight                                                     | 45° steps   |
| Arrow       | Line with arrowhead                                          | 45° steps   |
| Rectangle   | Outline                                                      | Square      |
| Ellipse     | Outline                                                      | Circle      |
| Eraser      | Removes whole strokes                                        | –           |

On top of that there are 6 colors plus a custom one, 4 stroke widths plus a slider, and undo, redo and *Clear everything*. The device remembers tool, color, width and source. On narrow displays (phones) the toolbar collapses into single buttons with popovers.

### Input

- **Stylus (e.g. Apple Pencil):** Draws. Once the stylus has been used, fingers no longer draw (palm rejection).
- **Finger:** Draws on devices without a stylus. Two fingers zoom and pan.
- **Desktop browser:** The mouse draws. Trackpad pinch or Ctrl/⌘ + mouse wheel zooms, scrolling pans.
- **Zoom:** up to 500%. When zoomed in, a minimap in the bottom right shows the visible area; tap or drag it to jump there. The badge in the top left resets to 100%.
- **Shift:** only with a hardware keyboard, e.g. a keyboard attached to the tablet.

### Source (background image)

The picker is in the toolbar.

- **Program:** the scene currently on air. It also contains the overlay, so after undo or clear you see a "ghost" for up to 1 s, and the highlighter looks doubled.
- **Scenes / sources:** To avoid the feedback loop:
  1. Put the content into its own scene, e.g. "Content".
  2. The scene on air consists of "Content" (as a nested scene) plus the overlay.
  3. Select "Content" on the tablet.

### Status bar

- **Connection:** green = connected, yellow = connecting…, red = wrong password
- **Scene:** the current program scene
- **Overlay:** name of the Browser Source. Tapping it shows or hides it in OBS **in all scenes**. If there are several, e.g. "OBS Tablet Draw Overlay (+1)", they are toggled together.
  - **gray:** visible
  - **blue:** hidden – the strokes appear semi-transparent on the tablet
  - **yellow dashed ("Create overlay"):** there is no overlay yet; tapping it creates one in the current scene
  - **Other scenes:** in OBS *Add → Browser → Add Existing → OBS Tablet Draw Overlay*
- **Image:** age of the background image, red after 3 s

## Troubleshooting

| Symptom | Cause / solution |
| --- | --- |
| Tablet does not load the page (timeout), but it works on the machine | The firewall blocks port 3729, or the Wi-Fi isolates devices from each other (client isolation, typical for guest and office networks). Put the machine and the tablet on the same regular network, e.g. a hotspot or Tailscale. An HTTPS tunnel does not work: an HTTPS page must not open `ws://`. |
| Saved link or home screen app no longer loads | Port 3729 was taken, so the server picked another one. Use the URL printed at startup, or quit whatever uses port 3729 and restart the server. |
| Status bar: "Wrong password" | `?password=` is missing or wrong, e.g. after regenerating the password in OBS. |
| Status bar stays yellow ("Connecting…") | WebSocket server not enabled in OBS, or port 4455 blocked by a firewall. |
| Status bar shows "Create overlay" although one exists | It was created by hand and has no marker. Delete it and recreate it via *Create overlay*. |
| Strokes do not arrive in OBS | Reload the Browser Source in OBS with *Refresh cache of current page* in its properties. Check that it is on top and visible. If the password in OBS was changed, open the tablet page once with the new password – it updates the overlay. |
| Overlay hangs or shows nothing | Only **one** drawing device may be connected at a time. Close other tabs or devices. |

## Development

```sh
npm install
npm run dev        # Dev server with HMR on port 5173 (also on the LAN)
npm run typecheck  # App (tsconfig.json) and server + vite.config.ts (tsconfig.node.json)
npm test           # Vitest, also runs in GitHub Actions on push and PR
npm run build
npm start          # Serves dist/ exactly like `npx obs-tablet-draw`
```

| Path | Contents |
| --- | --- |
| `src/protocol.ts` | Events between tablet and overlay |
| `src/board.ts` | Drawing state, built from the events |
| `src/render.ts` | Canvas rendering, shared by tablet and overlay |
| `src/obs.ts` | Connection to obs-websocket including reconnect |
| `src/overlay.ts` | Browser Source |
| `src/sequencer.ts` | Orders events by `seq`, because obs-websocket does not deliver broadcasts in order |
| `src/tablet/` | Drawing app (React) |
| `server/` | Static server behind `npx obs-tablet-draw` |

## License

[MIT](LICENSE)
