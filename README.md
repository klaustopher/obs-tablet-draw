# OBS Tablet Draw

Auf dem iPad (oder Telefon) über den aktuellen OBS-Inhalt zeichnen – mit Apple Pencil, Druckempfindlichkeit, Formen, Laserpointer und Zoom. Die Striche erscheinen live als Overlay im Stream.

```
iPad (Safari)  ──ws──►  obs-websocket  ──CustomEvent──►  Browser Source (Overlay)
      ▲                       │
      └── GetSourceScreenshot ┘   (Hintergrundbild, ~1×/s)
```

- Es gibt kein OBS-Plugin. Alles läuft über den in OBS eingebauten WebSocket-Server (obs-websocket v5, ab OBS 28).
- **`index.html`** ist die Zeichen-App fürs iPad.
- **`overlay.html`** ist die Browser Source in OBS: ein transparentes Canvas, auf dem die Striche erscheinen.
- Ein kleiner Webserver auf dem Rechner, auf dem OBS läuft, liefert beide Seiten aus.

Läuft unter **Windows, macOS und Linux**.

## Voraussetzungen

- OBS ≥ 28 mit **Browser Source**. Bei den offiziellen Builds für Windows und macOS ist sie dabei. Unter Linux fehlt sie in manchen Distributionspaketen; dann das offizielle Flatpak oder ein Paket mit Browser-Unterstützung (CEF) verwenden.
- [Node.js](https://nodejs.org) ≥ 22
- iPad bzw. Telefon und OBS-Rechner im **selben Netz**, ohne Client Isolation (siehe [Fehlerbehebung](#fehlerbehebung))

## Einrichtung

### 1. Installieren und bauen

Unter Windows überspringen – das erledigt `start.bat` in Schritt 3.

```sh
npm install
npm run build
```

### 2. WebSocket-Server in OBS aktivieren

*Werkzeuge → WebSocket-Server-Einstellungen*:
1. *WebSocket-Server aktivieren* anhaken.
2. Port `4455` lassen.
3. Unter *Verbindungsinformationen anzeigen* das Passwort kopieren.

### 3. Server starten

Vor dem Stream starten, danach einfach beenden (Fenster schließen bzw. `Ctrl+C`).

- **Windows:** Doppelklick auf `start.bat`. Beim ersten Mal installiert es die Abhängigkeiten, danach baut es bei jedem Start neu – nach Updates also einfach neu starten.
- **macOS / Linux:** `npm run preview`. Nach Updates vorher `npm run build`.

Die App läuft dann auf Port **4173** auf allen Netzwerk-Interfaces. Beim Start steht im Fenster die fertige URL fürs iPad – `DEIN_PASSWORT` durch das Passwort aus Schritt 2 ersetzen. Beim ersten Start fragt die Firewall eventuell nach – Zugriff im **privaten** Netzwerk erlauben.

### 4. iPad / Telefon

In Safari öffnen:

```
http://<adresse-des-rechners>:4173/?password=DEIN_PASSWORT
```

Als Adresse geht die **IP** des OBS-Rechners, z. B. `192.168.1.20`. Die gibt `npm run preview` beim Start unter *Network* aus. Stabiler ist der **lokale Hostname** `<name>.local`, falls dein System ihn im Netz bekannt macht:

- **macOS:** immer, zu finden unter *Systemeinstellungen → Allgemein → Freigabe → Lokaler Hostname*
- **Linux:** mit laufendem `avahi-daemon`
- **Windows:** nicht zuverlässig, dort im Zweifel die IP verwenden

Über *Teilen → Zum Home-Bildschirm* läuft die App ohne Browserleiste im Vollbild.

Beim ersten Mal in der Statusleiste auf **Overlay anlegen** tippen – die App richtet die Browser Source in OBS selbst ein.

## URL-Parameter

| Parameter  | Standard                    | Bedeutung                     |
| ---------- | --------------------------- | ----------------------------- |
| `password` | –                           | Passwort des OBS-WebSockets   |
| `host`     | Host, von dem die Seite kam | Rechner, auf dem OBS läuft    |
| `port`     | `4455`                      | Port des OBS-WebSockets       |

Die Parameter gelten für beide Seiten (iPad und Overlay).

## Hostnamen freigeben

Vite beantwortet nur Anfragen an `localhost`, IP-Adressen und – durch unsere Konfiguration – `*.local`. Weitere Hostnamen, z. B. ein eigener DNS-Name oder ein Tailscale-Name, gibst du kommagetrennt über `OBS_DRAW_ALLOWED_HOSTS` frei. Das gilt für `npm run dev` und `npm run preview`:

```sh
# macOS / Linux
OBS_DRAW_ALLOWED_HOSTS="studio.lan,.ts.net" npm run preview
```

```bat
:: Windows: dauerhaft setzen, gilt ab dem nächsten Start von start.bat
setx OBS_DRAW_ALLOWED_HOSTS "studio.lan,.ts.net"
```

Ein führender Punkt erlaubt den Namen und alle Subdomains: `.ts.net` deckt also `mein-pc.tailnet-xyz.ts.net` ab.

## Bedienung

### Werkzeuge

| Werkzeug  | Verhalten                                                    | Mit Shift  |
| --------- | ------------------------------------------------------------ | ---------- |
| Stift     | Freihand, druckempfindlich                                   | –          |
| Marker    | Breit, halbtransparent                                       | –          |
| Laser     | Leuchtspur, verblasst nach 700 ms, nicht im Undo             | –          |
| Linie     | Gerade                                                       | 45°-Raster |
| Pfeil     | Linie mit Spitze                                             | 45°-Raster |
| Rechteck  | Umriss                                                       | Quadrat    |
| Ellipse   | Umriss                                                       | Kreis      |
| Radierer  | Löscht ganze Striche                                         | –          |

Dazu kommen 6 Farben plus eine eigene, 4 Strichstärken plus Slider sowie Undo, Redo und *Alles löschen*. Werkzeug, Farbe, Stärke und Quelle merkt sich das Gerät. Auf schmalen Displays (Telefon) klappt die Toolbar zu einzelnen Buttons mit Popover zusammen.

### Eingabe

- **Apple Pencil:** Zeichnet. Sobald der Pencil einmal benutzt wurde, zeichnen Finger nicht mehr (Palm Rejection).
- **Finger:** Zeichnen auf Geräten ohne Pencil. Zwei Finger zoomen und verschieben.
- **Browser am Desktop:** Maus zeichnet. Trackpad-Pinch oder Ctrl/⌘ + Mausrad zoomt, Scrollen verschiebt.
- **Zoom:** bis 500 %. Eingezoomt zeigt eine Minimap unten rechts den Ausschnitt; antippen oder ziehen springt dorthin. Das Badge oben links setzt auf 100 % zurück.
- **Shift:** nur mit Hardware-Tastatur, z. B. Magic Keyboard am iPad.

### Quelle (Hintergrundbild)

Die Auswahl steht in der Toolbar.

- **Programm:** die aktuell gesendete Szene. Sie enthält auch das Overlay, deshalb sieht man nach Undo oder Löschen bis zu 1 s einen „Geist“, und der Marker wirkt doppelt.
- **Szenen / Quellen:** Ohne Rückkopplung geht es so:
  1. Inhalt in eine eigene Szene legen, z. B. „Content“.
  2. Die gesendete Szene besteht aus „Content“ (als verschachtelte Szene) plus dem Overlay.
  3. Auf dem iPad „Content“ wählen.

### Statusleiste

- **Verbindung:** grün = verbunden, gelb = verbinde…, rot = Passwort falsch
- **Szene:** die aktuelle Program-Szene
- **Overlay:** Name der Browser Source. Antippen blendet sie in OBS **in allen Szenen** ein oder aus. Gibt es mehrere, z. B. „OBS Tablet Draw Overlay (+1)“, werden alle gemeinsam geschaltet.
  - **grau:** eingeblendet
  - **blau:** ausgeblendet – die Striche erscheinen auf dem iPad halbtransparent
  - **gelb gestrichelt („Overlay anlegen“):** es gibt noch kein Overlay; antippen legt es in der aktuellen Szene an
  - **Weitere Szenen:** in OBS *Hinzufügen → Browser → Vorhandene hinzufügen → OBS Tablet Draw Overlay*
- **Bild:** Alter des Hintergrundbilds, rot ab 3 s

## Fehlerbehebung

| Symptom | Ursache / Lösung |
| --- | --- |
| iPad lädt die Seite nicht (Timeout), am Rechner geht sie | Firewall blockiert Port 4173, oder das WLAN trennt die Geräte voneinander (Client Isolation, typisch für Gäste- und Büro-WLANs). Rechner und iPad ins selbe normale WLAN bringen, z. B. Hotspot oder Tailscale. Ein HTTPS-Tunnel funktioniert nicht: Eine HTTPS-Seite darf kein `ws://` öffnen. |
| „Blocked request. This host is not allowed“ | Anderer Hostname als `*.local` oder IP. Über `OBS_DRAW_ALLOWED_HOSTS` freigeben (siehe [Hostnamen freigeben](#hostnamen-freigeben)) und den Server neu starten. |
| Statusleiste: „Passwort falsch“ | `?password=` fehlt oder ist falsch, z. B. nach neu generiertem Passwort in OBS. |
| Statusleiste bleibt gelb („Verbinde…“) | WebSocket-Server in OBS nicht aktiviert, oder Port 4455 durch eine Firewall blockiert. |
| Statusleiste zeigt „Overlay anlegen“, obwohl es eins gibt | Es wurde von Hand angelegt und hat keine Markierung. Löschen und über *Overlay anlegen* neu erstellen. |
| Striche kommen in OBS nicht an | Die Browser Source in OBS mit *Aktualisieren* neu laden. Prüfen, dass sie oben liegt und sichtbar ist. Wurde das Passwort in OBS geändert, das Overlay löschen und neu anlegen. |
| Overlay hängt oder zeigt nichts mehr | Es darf nur **ein** Zeichengerät gleichzeitig verbunden sein. Weitere Tabs oder Geräte schließen. |

## Entwicklung

```sh
npm run dev        # Dev-Server mit HMR auf Port 5173 (auch im LAN)
npm run typecheck  # App (tsconfig.json) und vite.config.ts (tsconfig.node.json)
npm run build
```

| Pfad | Inhalt |
| --- | --- |
| `src/protocol.ts` | Events zwischen iPad und Overlay (Koordinaten normiert auf 0..1) |
| `src/board.ts` | Zustand der Zeichnung, wird aus den Events aufgebaut |
| `src/render.ts` | Canvas-Rendering, gemeinsam für iPad und Overlay |
| `src/obs.ts` | Verbindung zu obs-websocket inkl. Reconnect |
| `src/overlay.ts` | Browser Source; ordnet Events nach `seq`, weil obs-websocket Broadcasts nicht in Reihenfolge zustellt |
| `src/ipad/` | Zeichen-App (React) |

## Lizenz

[MIT](LICENSE)
