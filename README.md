<div align="center">

# Antigravity 2.0 无损中文汉化引擎

**专为 Google Antigravity 2.0 桌面端打造的零侵入、零依赖动态中文汉化套件**

**简体中文** | [English](./README.en.md)

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](./LICENSE)
[![Node.js >= 22](https://img.shields.io/badge/Node.js-%3E%3D22-339933.svg)](https://nodejs.org/)
[![Platform: Windows](https://img.shields.io/badge/Platform-Windows%2010%2F11-0078D6.svg)](#环境要求)
[![Zero Dependencies](https://img.shields.io/badge/Dependencies-Zero-brightgreen.svg)](#核心特性)

</div>

---

## 30 秒快速上手

1. **准备环境**：确认已安装 **Node.js >= 22** 与官方 **Antigravity 2.0** 桌面端（无需 `npm install`，零第三方依赖）。
2. **获取项目**：克隆仓库或下载 ZIP 解压到任意目录（例如 `D:\Github_Ku\antigravity-2.0-zh-cn`）。
3. **创建快捷方式**：双击 **`创建桌面快捷方式.bat`**（桌面会出现带官方图标的 **`Antigravity 2.0 中文版`**）。
4. **启动使用**：**彻底退出**当前运行的原版 Antigravity（含右下角托盘图标），然后双击桌面 **`Antigravity 2.0 中文版`** 即可。

> **适用范围**：本项目**仅针对 Google Antigravity 2.0 独立桌面端**（Electron），不适用于旧版 Antigravity IDE（VS Code 版直接安装官方中文语言包扩展即可）。

---

## 核心特性

- **零侵入 / 无损安全**：绝不修改 `Antigravity.exe`、`app.asar` 或任何官方文件；不破坏签名；官方自动升级不损坏汉化；停止启动器即 100% 恢复原版。
- **全量社区校对词库**：集成 MIT 社区校对词库（详见 [第三方开源声明与致谢](#第三方开源声明与致谢)），合并后共 **5,180+ 条精确词条与 460+ 条正则规则**，支持双击 **`同步社区词库.bat`** 一键更新词库。
- **自动兼容免 TUN 代理**：自动探测环境变量、Windows 系统代理及常见本地代理端口，向 Antigravity 2.0 注入代理并放行 `localhost`，避免免 TUN 环境下各 Project 会话列表加载为空。
- **界面内悬浮「中 / EN」切换球**：窗口右下角提供可拖拽半透明按钮——**左键**瞬切中/英文，**右键**一键切换“技术档位保留英文”（如 `Turbo` / `Auto` / `Request Review` / `High` 保持英文，说明文字全翻中文）。
- **精准防误伤隔离**：针对 Antigravity 2.0 真实 DOM 精准跳过 Lexical 输入框、焦点输入区、用户消息、AI 回复/思考正文、侧栏对话标题、项目卡片、代码/Diff 查看器与终端。
- **本地 Web 管理控制台（`http://127.0.0.1:19222`）**：可视化管理自定义词库、支持译文留空 `""` 强制保留英文，并可一键扫描新版本未翻译 UI 词条。

---

## 环境要求

| 项目 | 要求 | 检查方式 |
| :--- | :--- | :--- |
| 操作系统 | Windows 10 / 11 | — |
| 目标客户端 | 官方 Google Antigravity 2.0 桌面端 | — |
| 运行时 | Node.js >= 22.0.0（内置原生 `WebSocket` 与 `fetch`） | 终端执行 `node -v` |

---

## 详细使用指南

### 1. 下载项目

```powershell
git clone https://github.com/QCYTSN/antigravity-2.0-zh-cn.git
cd antigravity-2.0-zh-cn
```

也可直接点击 GitHub 页面右上角 **Code -> Download ZIP** 解压使用。本项目零外部依赖，**不需要执行 `npm install`**。

### 2. 首次环境自检（推荐）

```powershell
npm run check
```

自检会自动确认 Node.js 版本、本机 `Antigravity.exe` 路径、本地代理状态、词库条数及进程状态。如果软件装在非常规目录导致未自动找到，在 [config.json](./config.json) 中填入 `exePath` 即可（注意 JSON 反斜杠需双写 `\\`）：

```json
{
  "exePath": "C:\\Users\\你的用户名\\AppData\\Local\\Programs\\Antigravity\\Antigravity.exe"
}
```

### 3. 日常启动方式

- **推荐（无黑窗）**：先运行一次 **`创建桌面快捷方式.bat`**，之后每次先确保原版已完全退出，直接双击桌面 **`Antigravity 2.0 中文版`**。
- **调试/查看日志**：直接双击 **`启动中文版.bat`** 或终端运行 `npm start`。

### 4. 快捷操作与词库管理

| 操作需求 | 使用方式 |
| :--- | :--- |
| 临时切回英文对照 | 左键点击窗口右下角悬浮球 **`中` / `EN`**（实时无损切换，无需重启） |
| 技术档位保留英文 | 右键点击右下角悬浮球，或在管理面板勾选“技术档位保留英文” |
| 打开本地管理面板 | 双击 **`打开管理面板.bat`** 或浏览器访问 `http://127.0.0.1:19222` |
| 个人定制某条译文 | 在管理面板添加或编辑 [dict/user-custom.json](./dict/user-custom.json)（优先级最高；译文留空 `""` 表示强制保留英文原文） |
| 同步社区最新词库 | Antigravity 更新后，双击 **`同步社区词库.bat`**（或运行 `npm run sync-dict`），不会覆盖你的个人自定义词库 |
| 抓取新版本漏翻词条 | 在管理面板点“扫描当前界面”，或双击 **`导出未翻译词条.bat`**（`npm run scan`）导出报告 |

### 5. 可选配套：让 AI 默认用中文回复

本项目还附带了一个标准的 Antigravity 原生规则插件模板 `optional-agent-plugin/zh-cn-assistant/`。如果你希望 AI 智能体的对话回复、任务规划和文档产物也默认使用简体中文，将该文件夹复制到：

```text
%USERPROFILE%\.gemini\config\plugins\zh-cn-assistant
```

随后即可在 Antigravity 的 **Customizations -> Plugins** 中原生开关。

---

## 注意事项与常见问题

<details open>
<summary><strong>1. 启动前必须彻底退出原版 Antigravity（含系统托盘）</strong></summary>

Electron 启用了单实例锁（Single Instance Lock）。如果原版 Antigravity 已在后台运行（哪怕只是缩在右下角托盘里），启动器无法为其开启本地 CDP 调试端口。请先右键托盘图标彻底退出，再双击中文版快捷方式启动。

</details>

<details>
<summary><strong>2. 为什么软件顶部原生菜单栏 / 托盘右键菜单仍为英文？</strong></summary>

这是零侵入无损架构的有意取舍：CDP 仅作用于 Chromium 渲染层（覆盖侧边栏、对话区、设置页、弹窗、插件市场、Swarm 与辅助面板等 95%+ 的高频交互区），不解包修改官方 `app.asar`，从而保证官方自动更新永不损坏、无文件校验报错。

</details>

<details>
<summary><strong>3. 本地端口与安全性说明</strong></summary>

CDP 端口（默认 `9229`）和 Web 管理面板端口（默认 `19222`）均严格绑定在 **`127.0.0.1` 本机回环地址**，外部网络无法访问。如本机有端口冲突，直接在 [config.json](./config.json) 中修改 `cdpPort` 或 `webConsolePort` 即可。

</details>

<details>
<summary><strong>4. 免 TUN 代理说明（为什么不会出现项目列表为空）</strong></summary>

`config.json` 中默认 `"proxyMode": "auto"`，启动时会自动按「环境变量 → Windows 系统代理 → 常见本地代理端口」顺序探测并注入代理，同时强制放行 `localhost,127.0.0.1,::1`。如果你使用 TUN 模式或直连网络且不想自动检测，可将其改为 `"none"`；也可填入固定地址如 `"http://127.0.0.1:7897"`。

</details>

<details>
<summary><strong>5. 关于桌面快捷方式（.vbs）与完全卸载</strong></summary>

- 桌面快捷方式调用的 [scripts/launcher-hidden.vbs](./scripts/launcher-hidden.vbs) 仅 8 行纯文本代码，用于避免启动时闪烁黑框；若安全软件误报，可直接改用 **`启动中文版.bat`** 或 `npm start`。
- **零残留卸载**：因为从未改动官方安装目录，退出 Antigravity 后直接删除桌面快捷方式和本项目文件夹即可完全还原。

</details>

---

## 常用脚本与配置参考

<details>
<summary>点击展开完整脚本列表与 <code>config.json</code> 配置表</summary>

### 脚本与命令

| 脚本 / 命令 | 作用 |
| :--- | :--- |
| `创建桌面快捷方式.bat` | 生成无黑窗、带官方图标的桌面快捷方式 |
| `启动中文版.bat` / `npm start` | 启动 Antigravity 2.0 并实时打印汉化日志 |
| `打开管理面板.bat` | 打开本地 Web 管理面板 `http://127.0.0.1:19222` |
| `同步社区词库.bat` / `npm run sync-dict` | 拉取上游 MIT 社区最新校对词库到 `dict/upstream/` |
| `导出未翻译词条.bat` / `npm run scan` | 扫描当前运行窗口未翻译 UI 词条并导出 `untranslated-report.json` |
| `热附着汉化.bat` / `npm run attach` | 单独挂载到已开启本地调试端口的 Antigravity 实例 |
| `npm run check` | 环境与代理自检 |
| `npm run validate` | 校验所有词库 JSON 与正则合法性 |
| `npm test` | 运行内置自动化单元测试 |

### `config.json` 主要配置项

| 字段 | 默认值 | 说明 |
| :--- | :--- | :--- |
| `exePath` | `""` | 自定义 `Antigravity.exe` 绝对路径，留空自动探测 |
| `proxyMode` | `"auto"` | `"auto"` 自动继承代理 / `"none"` 关闭 / 或填写如 `"http://127.0.0.1:7897"` |
| `cdpPort` | `9229` | 本机 CDP 调试端口（仅 `127.0.0.1`） |
| `webConsoleEnabled` | `true` | 是否开启本地 Web 管理面板 |
| `webConsolePort` | `19222` | 本地 Web 管理面板端口 |
| `enabledOnStart` | `true` | 启动时默认开启中文 |
| `keepEnglishTechLabels` | `false` | `true` 时保留 `Turbo`/`Auto`/`Default`/`Request Review`/`High`/`Medium`/`Low` 等英文档位 |
| `showFloatingToggle` | `true` | 是否显示右下角悬浮「中 / EN」切换球 |
| `watchDictionaries` | `true` | 是否监听 `dict/` 变更并实时热推送 |
| `ignoreSelectors` | 见文件 | 跳过翻译的 CSS 保护选择器列表 |

</details>

---

## 第三方开源声明与致谢

本项目高度重视开源合规与社区版权归属，以下明确区分**直接引入的第三方词库**、**思路借鉴**与**本项目独立实现部分**：

### 1. 直接引入的第三方 MIT 词库数据

本项目 `dict/upstream/` 目录下的以下 3 个词库文件直接同步自 MIT 开源项目 **[yiheng8023/antigravity-chinese](https://github.com/yiheng8023/antigravity-chinese)**（版权归属 `Copyright (c) 2026 Antigravity Chinese Localization Contributors`）：

- `dict/upstream/zh-CN.json`
- `dict/upstream/swarm.json`
- `dict/upstream/official-plugin-descriptions.json`

完整上游 MIT 许可协议原文与版权声明见 [THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md)。感谢上游维护者与贡献者为 Antigravity 2.x 社区持续校对的高质量词库！

### 2. 设计思路借鉴与致谢

- **[qqxpee/antigravity2-cn](https://github.com/qqxpee/antigravity2-cn)**：借鉴了其对 Antigravity 2.0 真实 DOM 边界（Lexical 编辑器、用户消息与 AI 正文 `data-testid` 隔离）、动态 `attachShadow` 拦截及高频短词保护的工程思路。*（本项目未复制其任何源码或词库文件。）*
- **[yuexps/Antigravity-Hans](https://github.com/yuexps/Antigravity-Hans)**：借鉴了界面内可拖拽「中 / EN」悬浮切换按钮、“技术档位保留英文”偏好预设以及属性变更重扫的交互设计思路。*（本项目未复制其任何源码或词库文件。）*

### 3. 本项目独立实现部分

本项目 `src/`、`scripts/`、`test/` 下的所有代码均由本项目从零独立编写（Node.js 22+ 零第三方依赖），包括：无损 CDP 多目标管理器、自动免 TUN 代理探测与注入模块、三层优先级词库热更新加载器、渲染层 LRU 缓存翻译运行时、本地 Web 管理控制台、未翻译词条扫描导出器、上游词库一键同步脚本以及完整自动化测试套件。

---

## 开源协议

本项目原创代码基于 [MIT License](./LICENSE) 开源；第三方词库遵循其各自许可协议（见 [THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md)）。
