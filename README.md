# LLSGC — Live Local Servers GUI Controller

[![Release](https://img.shields.io/github/v/release/Taha-Mahmoodi/LLSGC?include_prereleases&label=release)](https://github.com/Taha-Mahmoodi/LLSGC/releases/latest)
[![CI](https://github.com/Taha-Mahmoodi/LLSGC/actions/workflows/ci.yml/badge.svg)](https://github.com/Taha-Mahmoodi/LLSGC/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](./LICENSE)

A desktop control panel for every server running on your machine. See what's listening, how much CPU/memory each process is taking, how long it's been up — and stop, restart, open in browser, or block its port from a single window.

Built with Electron, React, TypeScript, Tailwind. Open source under MIT.

## Download

Three flavours — same control panel in all three. Grab them from **[GitHub Releases](https://github.com/Taha-Mahmoodi/LLSGC/releases/latest)**.

| File | Size | Use this if you want… |
|---|---|---|
| `LLSGC-Setup-X.Y.Z.exe` | ~65 MB | …a normal Windows app: installer, Start-menu shortcut, uninstaller. |
| `LLSGC-X.Y.Z-portable.exe` | ~64 MB | …the same desktop app but no install — runs from anywhere. |
| `LLSGC-X.Y.Z-lite.zip` | **~1 MB** | …a **tiny** download that uses the Node you already have. Same UI, runs in your browser at `http://localhost:47291`. |

The first two are full Electron desktop apps. The lite zip is a Node-based local agent: ~1 MB to download, requires Node 20+ already installed on your machine. Programmers tend to prefer it; everyone else is better off with the desktop installer.

> The installers are **unsigned**. Windows SmartScreen will show a "publisher unknown" warning the first time you run them — click *More info → Run anyway*.

### Running the lite zip

1. Extract the zip anywhere.
2. Double-click `llsgc-server.cmd` (Windows) or run `./llsgc-server.sh` (macOS/Linux).
3. Your default browser opens to `http://localhost:47291`. Same UI as the desktop app.

CLI flags (advanced):
```
--port <n>       listen on a different port (default 47291)
--host <ip>      bind address (default 127.0.0.1)
--no-open        do not auto-open the browser
--no-auto-start  skip auto-starting saved launchers
```

If you'd rather have the web build as a separate npm package or a single-binary `.exe` with Node embedded, see the sibling repo **[LLSGC-server](https://github.com/Taha-Mahmoodi/LLSGC-server)**.

## Features

**Server discovery**
- Auto-detects every TCP/UDP port your machine is listening on (uses `netstat -ano` on Windows, `lsof`/`ss` on Linux/macOS).
- Resolves each port back to its owning process — name, PID, command line, executable path.
- Real-time CPU %, memory, and uptime per process.

**Server control**
- One-click stop (graceful → force fallback) for any listening process.
- Open in browser, copy URL, reveal executable in file explorer.
- Live sparkline of CPU history per server.

**Launchers — saved server commands**
- Save any command as a launcher: name, command, args, working directory, environment variables, optional URL.
- Start, stop, restart with one click. Auto-start on app launch.
- Live stdout/stderr capture with a tailing log viewer.

**Firewall (Windows)**
- List existing Windows Firewall rules with filtering.
- Block a port with a single dialog (TCP/UDP/Any, inbound/outbound/both).
- Toggle rules on/off; remove blocked ports cleanly.
- Managed rules are tagged `LLSGC:` so the app never touches your existing rules.

**System overview**
- Live CPU / memory dashboard with sparklines.
- Top processes by CPU.
- Quick navigation to any subsystem.

**UX**
- Custom frameless titlebar.
- Dark / light / system theme.
- Configurable refresh rate (800 ms – 60 s).
- Toast notifications for every action.

## Stack

- **Shell:** Electron 33
- **UI:** React 18 + TypeScript + Vite
- **Styling:** Tailwind CSS 3, Framer Motion, Radix UI primitives, Lucide icons
- **State:** Zustand
- **System:** `pidusage`, `netstat`, `tasklist`, `Get-CimInstance Win32_Process`, `netsh advfirewall`

## Project structure

```
electron/
├── main.ts              Electron main entry — window, lifecycle
├── preload.ts           contextBridge API for the renderer
├── ipc.ts               IPC channel registration + tick loop
└── services/
    ├── port-scanner.ts      netstat / lsof / ss parsing
    ├── process-info.ts      CPU/memory + name/command resolution
    ├── process-killer.ts    taskkill / SIGTERM-then-SIGKILL
    ├── firewall.ts          netsh advfirewall wrapper
    ├── custom-manager.ts    spawn, log capture, lifecycle for launchers
    ├── system-stats.ts      OS-level CPU/memory polling
    └── store.ts             JSON-on-disk settings + launchers persistence

shared/
├── types.ts             Cross-process TypeScript types
└── channels.ts          IPC channel name constants

src/
├── main.tsx             React entry
├── App.tsx              Layout shell + global event wiring
├── index.css            Tailwind + theme variables
├── lib/
│   ├── api.ts               Typed wrapper around window.llsgc
│   ├── store.ts             Zustand global store
│   └── utils.ts             cn(), formatters
├── components/
│   ├── layout/              TitleBar, Sidebar, PageHeader
│   ├── ui/                  Button, Input, Switch, Dialog, Select, Tooltip, Toast
│   ├── ServerRow.tsx
│   ├── ServerDetailDrawer.tsx
│   ├── StatTile.tsx
│   ├── Sparkline.tsx
│   ├── AddCustomDialog.tsx
│   ├── BlockPortDialog.tsx
│   ├── ConfirmDialog.tsx
│   ├── EmptyState.tsx
│   └── StatusDot.tsx
├── pages/
│   ├── Dashboard.tsx
│   ├── Servers.tsx
│   ├── Custom.tsx
│   ├── Firewall.tsx
│   ├── Logs.tsx
│   └── Settings.tsx
└── types/window.d.ts        Ambient typing for window.llsgc
```

## Getting started

Requires Node 20+ and npm 10+.

```bash
git clone https://github.com/Taha-Mahmoodi/LLSGC.git
cd LLSGC
npm install
npm run dev
```

`npm run dev` starts Vite, builds the Electron main + preload, and opens the app window.

## Build a desktop installer

```bash
# Windows installer + portable exe
npm run package:win

# macOS dmg
npm run package -- --mac

# Linux AppImage + deb
npm run package -- --linux
```

Output goes to `release/`.

## Releases

Windows installers are built and published automatically by GitHub Actions:

- **CI** ([`.github/workflows/ci.yml`](./.github/workflows/ci.yml)) — typecheck + build on every push to `main` and every PR.
- **Release** ([`.github/workflows/release.yml`](./.github/workflows/release.yml)) — builds the Windows `.exe` on `windows-latest`, uploads it as an artifact, and (when triggered by a tag) publishes a GitHub Release with `generate_release_notes`.

To cut a new release:

```bash
# Bump version
npm version 0.2.0 --no-git-tag-version
git commit -am "chore: bump to 0.2.0"
git push

# Tag and push — this triggers the release workflow
git tag v0.2.0
git push origin v0.2.0
```

The workflow extracts the version from the tag, syncs `package.json`, builds the NSIS installer + portable exe, and publishes them to the [Releases](https://github.com/Taha-Mahmoodi/LLSGC/releases) page within ~5 minutes.

You can also trigger a build manually from the **Actions → Release Windows → Run workflow** menu — useful for a development build (uploaded as a workflow artifact, not a release) or for re-publishing without a new tag.

## Permissions

- **Reading ports:** no elevation needed on any platform.
- **Killing processes:** requires that the process is owned by your user. Run as Administrator to stop processes owned by other users.
- **Firewall:** `netsh advfirewall firewall add/delete rule` requires Administrator on Windows. If you see "elevation required" in the toast, right-click LLSGC and choose *Run as Administrator*.

## Cross-platform notes

- **Windows:** full feature set (port scan, kill, firewall, launchers).
- **macOS / Linux:** port scan, process info, kill, and launchers work. Firewall is Windows-only for now (PRs for `iptables`/`pf` welcome).

## Roadmap

- Built-in chart of historical resource usage per launcher.
- System tray with quick start/stop for launchers.
- Auto-detect "this looks like a `package.json`" and offer a one-click launcher.
- macOS `pf` and Linux `iptables`/`ufw` firewall integration.
- Per-launcher health checks (HTTP probe).

## Contributing

Issues and pull requests are welcome. The repo is small enough that a single afternoon is plenty to add a feature — start by `npm run dev`, find the page or service you want to change, and the IPC types in `shared/` will guide the rest.

## License

MIT — see [LICENSE](./LICENSE).
