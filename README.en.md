<div align="center">

# Antigravity 2.0 Lossless Chinese (zh-CN) Localization Engine

**A zero-invasion, zero-dependency dynamic Simplified Chinese localization suite built exclusively for the Google Antigravity 2.0 Desktop App**

[简体中文](./README.md) | **English**

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](./LICENSE)
[![Node.js >= 22](https://img.shields.io/badge/Node.js-%3E%3D22-339933.svg)](https://nodejs.org/)
[![Platform: Windows](https://img.shields.io/badge/Platform-Windows%2010%2F11-0078D6.svg)](#requirements)
[![Zero Dependencies](https://img.shields.io/badge/Dependencies-Zero-brightgreen.svg)](#key-features)

</div>

---

## Overview

`antigravity-2.0-zh-cn` is an external, non-destructive Chinese UI localization launcher for the **Google Antigravity 2.0 Desktop App**.

Unlike traditional Electron patches that unpack and overwrite `app.asar`, this project **never modifies any file in the official installation directory** and does not require installing a separate localized build. It connects to the Electron renderer over the standard local-only **Chrome DevTools Protocol (`127.0.0.1`)**, translates UI strings dynamically in memory, and provides a built-in local Web Console for **live Chinese/English toggling**, **dictionary hot-reloading**, and **one-click untranslated string discovery**.

> **Scope**: This project targets the **Antigravity 2.0 standalone desktop app** only. It is not intended for Antigravity IDE (for the VS Code-based IDE, install a standard VS Code Chinese Language Pack extension).

---

## Key Features

- **Zero Invasion & Lossless**: Never touches `Antigravity.exe`, `app.asar`, or official application files. Code signatures remain intact, official auto-updates never break your installation, and closing the launcher immediately restores the vanilla app.
- **Zero External Dependencies**: Built purely on Node.js 22+ native `fetch` and `WebSocket` APIs—no `npm install` required.
- **React-Safe & User Content Protection**:
  - Mutates only `Text.nodeValue` and safe UI attributes (`placeholder`, `title`, `aria-label`, `data-tooltip`) without replacing DOM nodes or `innerHTML`, keeping React reconciliation completely safe.
  - Automatically skips `<code>`, `<pre>`, code editors (Monaco / CodeMirror), terminals, editable input values, Markdown bodies, URLs, file paths, and code-like snippets so user code and chat content are never mangled.
- **Local Web Management Console (`http://127.0.0.1:19222`)**:
  - Monitor attached Antigravity 2.0 renderer targets and live translated node counts.
  - **One-click live toggle** between Simplified Chinese and original English with no restart required.
  - **Fast Adaptation to App Updates**: Scan the active UI for newly added untranslated English controls, type translations inline, and persist them directly into [dict/user-custom.json](./dict/user-custom.json) with instant hot-push.
- **Modular Dictionaries & Hot Reload**: Ships with 750+ curated UI entries and 66 anchored regex templates (with case-insensitive fallback, whitespace normalization, trailing punctuation preservation, same-origin `iframe`, and Shadow DOM coverage). Editing any `dict/*.json` file updates running windows immediately.
- **Automatic Non-TUN Proxy Support**: Automatically detects environment variables, Windows System Proxy, and common local proxy ports, injecting proxy env vars and `--proxy-server` (while bypassing `localhost`) into Antigravity 2.0 so workspace conversations load reliably even without TUN mode.
- **Windowless Desktop Shortcut**: One-click generator creates a Windows desktop shortcut with Antigravity's official icon and silent background startup.

---

## Requirements

- **OS**: Windows 10 / 11
- **Target App**: Official **Google Antigravity 2.0** Desktop App installed
- **Runtime**: **Node.js >= 22.0.0** (for built-in `WebSocket` and `fetch`)

Verify your Node.js version in PowerShell:

```powershell
node -v
# Expected: v22.x.x or newer (e.g., v24.15.0)
```

---

## Usage Guide

### Step 1: Clone or Download

Option A (recommended):

```powershell
git clone https://github.com/QCYTSN/antigravity-2.0-zh-cn.git
cd antigravity-2.0-zh-cn
```

Option B: Click **Code -> Download ZIP** on GitHub and extract to a local directory (e.g., `D:\Github_Ku\antigravity-2.0-zh-cn`).

> No `npm install` is needed—the project has zero external packages.

### Step 2: Run Environment Self-Check (Recommended on First Run)

```powershell
npm run check
```

This verifies:
1. Node.js version and native `WebSocket` availability;
2. Auto-detection of your local `Antigravity.exe` path;
3. Dictionary integrity and entry counts;
4. Whether an Antigravity process or CDP port is currently active.

If `Antigravity.exe` is installed in a custom location and cannot be auto-detected, set `"exePath"` in [config.json](./config.json) (use escaped backslashes `\\` in JSON):

```json
{
  "exePath": "C:\\Users\\YourName\\AppData\\Local\\Programs\\Antigravity\\Antigravity.exe"
}
```

### Step 3: Create the Desktop Shortcut (Recommended)

Double-click **`创建桌面快捷方式.bat`** in the project root.

This creates a silent-launch shortcut named **`Antigravity 2.0 中文版`** on your Desktop using the official Antigravity application icon.

### Step 4: Launch Antigravity 2.0 in Chinese

1. **Fully quit any running Antigravity 2.0 instance first** (check the Windows system tray in the bottom-right corner and exit completely).
2. Double-click the Desktop shortcut **`Antigravity 2.0 中文版`** (or double-click **`启动中文版.bat`** if you prefer seeing live console logs).
3. Antigravity 2.0 will launch and translate automatically. When you exit Antigravity 2.0, the localization engine shuts down cleanly with no lingering background processes.

### Step 5: Open the Local Management Console & Adapt New Releases

While the localized session is running, double-click **`打开管理面板.bat`** or open:

```text
http://127.0.0.1:19222
```

From the console you can:
- **Toggle Chinese / English live** without restarting Antigravity;
- **Scan untranslated UI controls**: navigate to any new view or dialog in Antigravity 2.0, click **"扫描当前界面"** in the console, fill in the Chinese translation, and click **"录入"** to apply immediately and save to [dict/user-custom.json](./dict/user-custom.json);
- **Search, add, override, or delete** custom entries at any time.

---

## Optional Companion: Default Chinese AI Responses

The CDP engine localizes the **Antigravity 2.0 UI**. If you also want the AI agent itself to default to Simplified Chinese in replies, plans, and artifacts, this repository includes a standard native Antigravity plugin template at `optional-agent-plugin/zh-cn-assistant/`.

Copy the entire `zh-cn-assistant` folder to:

```text
%USERPROFILE%\.gemini\config\plugins\zh-cn-assistant
```

You can then enable or disable it natively under **Customizations -> Plugins**.

---

## Scripts & CLI Reference

| Script / Command | Description |
| :--- | :--- |
| `创建桌面快捷方式.bat` | Creates the windowless `Antigravity 2.0 中文版` Desktop shortcut with the official icon |
| `启动中文版.bat` / `npm start` | Launches Antigravity 2.0 with live console logs (best for troubleshooting) |
| `打开管理面板.bat` | Opens `http://127.0.0.1:19222` in your default browser |
| `导出未翻译词条.bat` / `npm run scan` | Scans all running Antigravity 2.0 windows for untranslated English UI strings and exports `untranslated-report.json` |
| `热附着汉化.bat` / `npm run attach` | Attaches only the localization engine to an already-debuggable Antigravity instance |
| `npm run check` | Runs diagnostics (Node version, executable path, dictionaries, CDP & process status) |
| `npm run validate` | Validates JSON syntax, duplicate keys, and regex patterns across `dict/` |
| `npm test` | Runs the built-in Node.js unit test suite |

---

## Configuration (`config.json`)

| Key | Default | Description |
| :--- | :--- | :--- |
| `exePath` | `""` | Custom absolute path to `Antigravity.exe`; leave empty for automatic detection |
| `proxyMode` | `"auto"` | Proxy handling: `"auto"` detects env / Windows System Proxy / common local ports; `"none"` disables proxy injection; or pass an explicit URL like `"http://127.0.0.1:7897"` |
| `cdpPort` | `9229` | Local CDP debugging port (bound strictly to `127.0.0.1`) |
| `cdpHost` | `"127.0.0.1"` | Localhost loopback address — **do not change to `0.0.0.0`** |
| `webConsoleEnabled` | `true` | Enable or disable the local Web Console |
| `webConsolePort` | `19222` | Port for the local Web Console (change if conflicted) |
| `autoOpenConsole` | `false` | Automatically open the Web Console in browser on launch when set to `true` |
| `enabledOnStart` | `true` | Whether Chinese localization starts enabled |
| `watchDictionaries` | `true` | Watch `dict/` and hot-push edits automatically |
| `pollIntervalMs` | `1500` | Polling interval (ms) for newly opened renderer windows/panels |
| `maxTextLength` | `220` | Maximum text length eligible for translation (protects long body paragraphs) |
| `extraLaunchArgs` | `[]` | Additional CLI flags forwarded to `Antigravity.exe` |
| `ignoreSelectors` | See file | CSS selectors whose subtrees are never translated |

---

## Precautions & FAQ

### 1. Fully Quit Vanilla Antigravity Before Launching (Most Common Issue)
Electron enforces a **Single Instance Lock**. If Antigravity 2.0 is already running without `--remote-debugging-port` (even minimized to the system tray), launching a second process simply forwards focus to the existing instance and exits—so CDP will not open.

- **Fix**: Right-click the Antigravity tray icon to exit completely, then launch via the Chinese shortcut.
- **Verify**: Run `npm run check` and confirm the process status shows not running before launching.

### 2. Why Are Native OS Title/Tray Menus Still in English?
This is an intentional trade-off of the **non-destructive architecture**. CDP operates inside the Chromium renderer layer (covering 95%+ of daily UI: sidebar, chat canvas, settings, dialogs, customizations, artifacts, and auxiliary panes) without patching `app.asar`. In return, official updates never break your setup and zero binary tampering is required.

### 3. Security & Port Conflicts
- Both the CDP endpoint (`127.0.0.1:9229`) and Web Console (`127.0.0.1:19222`) bind strictly to **localhost (`127.0.0.1`)** and are never exposed to LAN or the internet.
- If either port is already in use on your machine, edit `cdpPort` or `webConsolePort` in [config.json](./config.json).

### 4. Antivirus Prompts on `launcher-hidden.vbs`
The desktop shortcut invokes [scripts/launcher-hidden.vbs](./scripts/launcher-hidden.vbs), an 8-line plain-text wrapper that runs `node src/index.mjs launch --gui-alert` without flashing a terminal window. If your antivirus flags `.vbs` scripts, you can inspect and allow it, or simply use **`启动中文版.bat`** / `npm start` instead.

### 5. What If User Code or Chat Content Gets Accidentally Translated?
The engine only translates exact dictionary hits and strictly anchored regex templates while skipping standard code/editor/chat containers. If a future UI update changes DOM classes and causes an unintended match:
- Add the container's CSS selector to `ignoreSelectors` in [config.json](./config.json), or
- Remove/adjust the entry in `dict/` (changes hot-reload immediately).

### 6. Clean Uninstall
Because no official Antigravity files are ever altered:
1. Close Antigravity 2.0;
2. Delete the `Antigravity 2.0 中文版` desktop shortcut and this project folder (plus `%USERPROFILE%\.gemini\config\plugins\zh-cn-assistant` if you installed the optional companion plugin);
3. Launch the official Antigravity app as usual—zero residue left behind.

---

## Project Structure

```text
antigravity-2.0-zh-cn/
├── config.json                  # Local configuration
├── config.example.json          # Default configuration template
├── dict/                        # Modular dictionaries (hot-reloaded on save)
│   ├── common.json              # Common buttons, dialogs, menus, status labels
│   ├── sidebar.json             # Left sidebar, projects, conversation history
│   ├── chat.json                # Chat canvas, tool calls, artifacts, auxiliary panes
│   ├── settings.json            # Global/project settings, permissions, sandbox policies
│   ├── customizations.json      # Skills, Rules, Plugins, Hooks, MCP, Automations
│   ├── patterns.json            # Anchored regex templates for dynamic counts/timestamps
│   └── user-custom.json         # Highest-priority user overrides
├── src/                         # Core engine (zero dependencies)
├── scripts/                     # Shortcut generator, hidden launcher, dictionary validator
├── optional-agent-plugin/       # Optional native plugin for Chinese AI responses
└── test/                        # Node.js built-in unit tests
```

---

## Contributing

Pull requests for updated Antigravity 2.0 UI strings and selector refinements are welcome! Before opening a PR, please verify:

```powershell
npm run validate
npm test
```

## License

Released under the [MIT License](./LICENSE).
