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

## 30-Second Quick Start

1. **Prerequisites**: Make sure you have **Node.js >= 22** and the official **Google Antigravity 2.0** Desktop App installed (zero external dependencies—no `npm install` needed).
2. **Download**: Clone this repository or download & extract the ZIP (e.g., to `D:\Github_Ku\antigravity-2.0-zh-cn`).
3. **Create Shortcut**: Double-click **`创建桌面快捷方式.bat`** to place an **`Antigravity 2.0 中文版`** shortcut with the official icon on your Desktop.
4. **Launch**: **Fully quit** any running vanilla Antigravity instance (including its system tray icon), then double-click **`Antigravity 2.0 中文版`** on your Desktop.

> **Scope**: Built **exclusively for the Antigravity 2.0 standalone desktop app** (Electron). For the VS Code-based Antigravity IDE, install a standard VS Code Chinese Language Pack extension instead.

---

## Key Features

- **Zero Invasion & Lossless**: Never modifies `Antigravity.exe`, `app.asar`, or any official app files. Code signatures stay intact, official updates never break your setup, and stopping the launcher restores vanilla Antigravity immediately.
- **Community-Verified Full Dictionary**: Incorporates the MIT-licensed community dictionary (see [Third-Party Notices & Acknowledgements](#third-party-notices--acknowledgements)) for **5,180+ exact UI entries and 460+ regex rules**, with one-click upstream syncing via **`同步社区词库.bat`** (`npm run sync-dict`).
- **Automatic Non-TUN Proxy Support**: Automatically detects environment variables, Windows System Proxy, and common local proxy ports, injecting proxy settings while bypassing `localhost` so project conversation lists load reliably without TUN mode.
- **In-App Floating `中 / EN` Pill**: A compact, draggable corner button inside Antigravity 2.0—**left-click** to toggle Chinese/English live without restarting; **right-click** to toggle "Keep Technical Labels in English" (`Turbo`, `Auto`, `Request Review`, `High`, etc. stay in English while descriptions are translated).
- **Surgical Content Isolation**: Precisely skips Lexical editors, focused inputs, user prompts, AI response/thinking prose, sidebar conversation titles, project cards, code/diff viewers, and terminals.
- **Local Web Console (`http://127.0.0.1:19222`)**: Manage custom dictionary overrides (empty value `""` forces keeping the original English text) and scan live windows for newly added untranslated UI strings.

---

## Requirements

| Requirement | Specification | Check |
| :--- | :--- | :--- |
| OS | Windows 10 / 11 | — |
| Target App | Official Google Antigravity 2.0 Desktop App | — |
| Runtime | Node.js >= 22.0.0 (native `WebSocket` & `fetch`) | Run `node -v` |

---

## Detailed Usage Guide

### 1. Get the Project

```powershell
git clone https://github.com/QCYTSN/antigravity-2.0-zh-cn.git
cd antigravity-2.0-zh-cn
```

Or click **Code -> Download ZIP** on GitHub and extract locally. No `npm install` is needed.

### 2. Run First-Time Environment Check (Recommended)

```powershell
npm run check
```

This checks your Node.js version, auto-detected `Antigravity.exe` path, local proxy detection, dictionary count, and process status. If Antigravity is installed in a non-standard directory, set `exePath` in [config.json](./config.json) (escape backslashes as `\\`):

```json
{
  "exePath": "C:\\Users\\YourName\\AppData\\Local\\Programs\\Antigravity\\Antigravity.exe"
}
```

### 3. Daily Launch

- **Recommended (Windowless)**: Run **`创建桌面快捷方式.bat`** once. Whenever starting Antigravity, make sure no vanilla instance is running, then double-click **`Antigravity 2.0 中文版`** on your Desktop.
- **With Live Console Logs**: Double-click **`启动中文版.bat`** or run `npm start`.

### 4. Everyday Controls & Customization

| Goal | How To |
| :--- | :--- |
| Live toggle Chinese / English | Left-click the bottom-right **`中` / `EN`** floating button (lossless, no restart) |
| Keep technical preset names in English | Right-click the floating button, or toggle it in the Web Console |
| Open the local Web Console | Double-click **`打开管理面板.bat`** or visit `http://127.0.0.1:19222` |
| Override or force-keep specific strings | Edit [dict/user-custom.json](./dict/user-custom.json) or use the Web Console (highest priority; empty value `""` forces keeping original English) |
| Sync latest upstream community dictionary | Double-click **`同步社区词库.bat`** or run `npm run sync-dict` (never overwrites your custom entries) |
| Capture newly added English strings | Click "Scan Current UI" in the Web Console, or run **`导出未翻译词条.bat`** (`npm run scan`) |

### 5. Optional Companion: Default Chinese AI Replies

To also instruct the AI agent to reply, plan, and author artifacts in Simplified Chinese by default, copy `optional-agent-plugin/zh-cn-assistant/` into:

```text
%USERPROFILE%\.gemini\config\plugins\zh-cn-assistant
```

You can then toggle it natively under **Customizations -> Plugins**.

---

## Precautions & FAQ

<details open>
<summary><strong>1. Fully Quit Vanilla Antigravity Before Launching (Including System Tray)</strong></summary>

Electron enforces a Single Instance Lock. If vanilla Antigravity is already running (even minimized to the tray), launching a second process forwards focus to the existing instance and cannot open the local CDP port. Right-click the Antigravity tray icon to exit completely, then launch via the Chinese shortcut.

</details>

<details>
<summary><strong>2. Why Are Native OS Title/Tray Menus Still in English?</strong></summary>

This is an intentional trade-off of the zero-invasion architecture: CDP operates strictly in the Chromium renderer (covering 95%+ of daily UI—sidebar, chat, settings, modals, plugins, Swarm, and auxiliary panes) without unpacking or modifying `app.asar`, keeping official updates completely safe.

</details>

<details>
<summary><strong>3. Localhost Port Security</strong></summary>

Both the CDP endpoint (`127.0.0.1:9229`) and the Web Console (`127.0.0.1:19222`) bind strictly to loopback `127.0.0.1` and are never exposed externally. Change `cdpPort` or `webConsolePort` in [config.json](./config.json) if you hit a local port conflict.

</details>

<details>
<summary><strong>4. Non-TUN Proxy Handling</strong></summary>

`"proxyMode": "auto"` detects proxy settings in order (environment variables → Windows System Proxy → common local proxy ports) and injects proxy flags while bypassing `localhost,127.0.0.1,::1`, preventing blank project conversation lists under non-TUN proxies. Set `"proxyMode": "none"` to disable or specify an explicit URL such as `"http://127.0.0.1:7897"`.

</details>

<details>
<summary><strong>5. Windowless Launcher (.vbs) & Clean Uninstall</strong></summary>

- [scripts/launcher-hidden.vbs](./scripts/launcher-hidden.vbs) is an 8-line plain-text wrapper to avoid flashing a terminal window. If your antivirus flags `.vbs`, use **`启动中文版.bat`** or `npm start` directly.
- **Zero-Residue Uninstall**: Exit Antigravity and delete the Desktop shortcut plus this folder. No official Antigravity files were ever altered.

</details>

---

## Scripts & Configuration Reference

<details>
<summary>Click to expand full script list and <code>config.json</code> reference</summary>

### Scripts & Commands

| Script / Command | Description |
| :--- | :--- |
| `创建桌面快捷方式.bat` | Creates the windowless Desktop shortcut with official icon |
| `启动中文版.bat` / `npm start` | Launches Antigravity 2.0 with live localization logs |
| `打开管理面板.bat` | Opens `http://127.0.0.1:19222` in your default browser |
| `同步社区词库.bat` / `npm run sync-dict` | Syncs latest MIT upstream dictionaries into `dict/upstream/` |
| `导出未翻译词条.bat` / `npm run scan` | Scans running windows and exports `untranslated-report.json` |
| `热附着汉化.bat` / `npm run attach` | Attaches to an already-debuggable Antigravity instance |
| `npm run check` | Runs environment & proxy diagnostics |
| `npm run validate` | Validates all dictionary JSON files and regex syntax |
| `npm test` | Runs built-in Node.js unit tests |

### `config.json` Options

| Key | Default | Description |
| :--- | :--- | :--- |
| `exePath` | `""` | Custom absolute path to `Antigravity.exe`; leave empty for auto-detection |
| `proxyMode` | `"auto"` | `"auto"` (detect proxy) / `"none"` (disabled) / explicit URL like `"http://127.0.0.1:7897"` |
| `cdpPort` | `9229` | Local CDP port (`127.0.0.1` only) |
| `webConsoleEnabled` | `true` | Enable the local Web Console |
| `webConsolePort` | `19222` | Local Web Console port |
| `enabledOnStart` | `true` | Start with Chinese enabled |
| `keepEnglishTechLabels` | `false` | Keep technical labels (`Turbo`, `Auto`, `Default`, `Request Review`, `High`, `Medium`, `Low`) in English |
| `showFloatingToggle` | `true` | Show the draggable `中 / EN` floating button |
| `watchDictionaries` | `true` | Watch `dict/` for live hot-reload |
| `ignoreSelectors` | See file | CSS selectors excluded from translation |

</details>

---

## Third-Party Notices & Acknowledgements

To keep licensing and attribution completely transparent, below is the exact breakdown of third-party assets, community design inspirations, and original components in this repository:

### 1. Directly Incorporated Third-Party MIT Dictionaries

The 3 dictionary files under `dict/upstream/` are synchronized directly from the MIT-licensed project **[yiheng8023/antigravity-chinese](https://github.com/yiheng8023/antigravity-chinese)** (`Copyright (c) 2026 Antigravity Chinese Localization Contributors`):

- `dict/upstream/zh-CN.json`
- `dict/upstream/swarm.json`
- `dict/upstream/official-plugin-descriptions.json`

The full upstream MIT license and copyright notice are preserved in [THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md). Huge thanks to the upstream maintainers and contributors for continuously curating high-quality Antigravity 2.x translations!

### 2. Design Inspirations & Acknowledgements

- **[qqxpee/antigravity2-cn](https://github.com/qqxpee/antigravity2-cn)**: Inspired our surgical Antigravity 2.0 DOM content-isolation boundaries (Lexical editor, user prompt & AI prose `data-testid` selectors), dynamic `attachShadow` hooking, and short-word lowercase collision guards. *(No source code or dictionary files were copied from this repository.)*
- **[yuexps/Antigravity-Hans](https://github.com/yuexps/Antigravity-Hans)**: Inspired the in-app draggable `中 / EN` toggle pill, the "Keep Technical Labels in English" preset, and attribute-mutation subtree re-scanning. *(No source code or dictionary files were copied from this repository.)*

### 3. Original Components in This Repository

All source code under `src/`, `scripts/`, and `test/` is written from scratch with zero external dependencies (Node.js 22+), including the lossless CDP multi-target manager, automatic non-TUN proxy detector & injector, 3-tier hot-reloading dictionary loader, LRU-cached renderer translation engine, local Web Management Console, untranslated UI scanner, one-click upstream dictionary syncer, and automated test suite.

---

## License

Original code in this repository is licensed under the [MIT License](./LICENSE). Third-party dictionary files remain subject to their respective license terms (see [THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md)).
