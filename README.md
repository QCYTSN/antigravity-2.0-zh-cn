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

## 项目简介

`antigravity-2.0-zh-cn` 是一个专门面向 **Google Antigravity 2.0 独立桌面端** 的外挂式中文汉化工具。

与修改 `app.asar` 的传统补丁不同，本项目**完全不触碰官方安装目录下的任何文件**，也不需要安装额外的中文版客户端。它通过 Electron 标准本地调试协议（Chrome DevTools Protocol，仅限本机 `127.0.0.1`）在渲染层动态翻译界面文案，配合本地 Web 控制台实现**一键中英切换**、**词库热更新**与**新版本词条一键采集**。

> **适用范围说明**：本项目**仅针对 Antigravity 2.0 独立桌面端**设计，不针对 Antigravity IDE（VS Code 版）。

---

## 核心特性

- **零侵入 / 无损安全**：不修改 `Antigravity.exe`、`app.asar` 或任何官方配置；不破坏应用签名；官方自动升级不会损坏汉化；停止启动器即 100% 恢复原版。
- **零第三方依赖**：直接基于 Node.js 22+ 原生 `fetch` 与 `WebSocket`，无需执行 `npm install`，下载即可运行。
- **React 友好与防误伤保护**：
  - 仅替换纯文本节点（`Text.nodeValue`）与安全 UI 属性（`placeholder`、`title`、`aria-label`、`data-tooltip`），绝不重写 `innerHTML`，避免 React 虚拟 DOM 异常。
  - 自动跳过 `<code>`、`<pre>`、代码编辑器（Monaco / CodeMirror）、终端输出、输入框正文、Markdown 正文、URL、文件路径及代码特征字符串，防止误译用户内容。
- **本地 Web 汉化控制台（`http://127.0.0.1:19222`）**：
  - 实时查看已挂载的 Antigravity 2.0 窗口及已替换节点数。
  - **一键无损切换中/英文**，无需重启客户端。
  - **新版本快速适配**：一键扫描当前页面尚未翻译的英文 UI 控件，在线填写译文并立刻生效。
- **模块化词库 + 热更新**：内置 750+ 条高频精确词条与 66 条正则动态模板（支持忽略大小写、换行空白规范化、末尾标点保留、同源 `iframe` 与 Shadow DOM 覆盖），编辑 `dict/*.json` 保存即刻热推送。
- **自动兼容免 TUN 代理**：启动器默认自动探测环境变量、Windows 系统代理及常见本地代理端口，向 Antigravity 2.0 注入代理参数并放行 `localhost`，避免免 TUN 环境下后端失联导致项目会话列表加载为空。
- **无黑窗桌面快捷方式**：一键生成带 Antigravity 官方图标的桌面快捷方式，日常双击使用体验与原版一致。

---

## 环境要求

- **操作系统**：Windows 10 / 11
- **目标软件**：已安装官方 **Google Antigravity 2.0** 桌面端
- **运行时**：**Node.js >= 22.0.0**（需要原生 `WebSocket` 与 `fetch` 支持）

可在终端执行以下命令确认 Node.js 版本：

```powershell
node -v
# 输出应为 v22.x.x 或更高版本（例如 v24.15.0）
```

---

## 使用方法

### 第 1 步：获取项目

方式 A（推荐，使用 Git 克隆）：

```powershell
git clone https://github.com/QCYTSN/antigravity-2.0-zh-cn.git
cd antigravity-2.0-zh-cn
```

方式 B：点击 GitHub 页面右上角 **Code -> Download ZIP**，解压到任意英文路径（例如 `D:\Github_Ku\antigravity-2.0-zh-cn`）。

> 本项目零依赖，**不需要**运行 `npm install`。

### 第 2 步：运行环境自检（可选，推荐首次执行）

在项目根目录终端运行：

```powershell
npm run check
```

自检会确认：
1. Node.js 版本与原生 `WebSocket` 支持是否正常；
2. 是否自动找到了你本机的 `Antigravity.exe`；
3. 词库文件是否加载正常；
4. 当前是否有 Antigravity 进程正在运行。

如果提示未能自动找到 `Antigravity.exe`，请打开根目录的 [config.json](./config.json)，手动填入你本机的绝对路径（注意 JSON 反斜杠需双写 `\\`）：

```json
{
  "exePath": "C:\\Users\\你的用户名\\AppData\\Local\\Programs\\Antigravity\\Antigravity.exe"
}
```

### 第 3 步：创建无黑窗桌面快捷方式（推荐）

双击项目根目录的 **`创建桌面快捷方式.bat`**。

脚本会自动查找官方 `Antigravity.exe` 图标，并在桌面生成一个名为 **`Antigravity 2.0 中文版`** 的快捷方式。

### 第 4 步：启动中文版 Antigravity 2.0

1. **先彻底退出正在运行的原版 Antigravity**（请务必检查 Windows 右下角系统托盘图标并右键退出）。
2. 双击桌面刚刚生成的 **`Antigravity 2.0 中文版`** 快捷方式（或直接双击项目目录下的 **`启动中文版.bat`** 查看实时日志）。
3. Antigravity 2.0 启动完成后，界面会自动完成中文汉化；当你关闭 Antigravity 2.0 时，后台汉化引擎也会自动优雅退出，不残留僵尸进程。

### 第 5 步：使用本地管理面板与适配新版词条

启动中文版后，双击 **`打开管理面板.bat`** 或在浏览器访问：

```text
http://127.0.0.1:19222
```

你可以在面板中完成以下操作：
- **一键切换中/英文**：点击右上角“暂停汉化（切回英文）”/“开启中文汉化”，Antigravity 界面实时无损切换。
- **扫描并补齐未翻译词条**：在 Antigravity 2.0 中打开任意新页面（例如设置页、弹窗或新功能区），回到控制台点击 **“扫描当前界面”**，填入中文后点 **“录入”**，会立刻生效并自动持久化到 [dict/user-custom.json](./dict/user-custom.json)。
- **在线管理自定义词库**：随时搜索、新增、覆盖或删除个人专属译文。

---

## 可选配套：让 AI 回复也默认使用简体中文

本工具负责汉化 **Antigravity 2.0 软件界面**；如果你希望 AI 智能体在对话回复、任务规划和文档产物（Artifacts）中也默认使用简体中文，可以启用项目附带的原生插件模板：

将目录 `optional-agent-plugin/zh-cn-assistant` 整个复制到：

```text
%USERPROFILE%\.gemini\config\plugins\zh-cn-assistant
```

复制后即可在 Antigravity 的 **Customizations -> Plugins** 中作为标准原生插件自由开关。

---

## 常用脚本与命令速查

| 脚本 / 命令 | 说明 |
| :--- | :--- |
| `创建桌面快捷方式.bat` | 在桌面创建无黑窗、带官方图标的 `Antigravity 2.0 中文版` 快捷方式 |
| `启动中文版.bat` / `npm start` | 在命令行窗口启动 Antigravity 2.0 并实时打印汉化挂载日志（排障首选） |
| `打开管理面板.bat` | 在默认浏览器中打开 `http://127.0.0.1:19222` 管理面板 |
| `导出未翻译词条.bat` / `npm run scan` | 一键全量扫描当前运行窗口中尚未翻译的英文 UI，导出为 `untranslated-report.json` 方便批量补全 |
| `热附着汉化.bat` / `npm run attach` | 仅挂载汉化引擎（适用于 Antigravity 已以调试端口启动但需重连时） |
| `npm run check` | 运行环境自检（Node 版本、程序路径、词库规模、端口与进程状态） |
| `npm run validate` | 校验 `dict/` 下所有 JSON 词库格式、重复键与正则合法性 |
| `npm test` | 运行内置自动化单元测试套件 |

---

## 配置项说明（`config.json`）

| 字段 | 默认值 | 说明 |
| :--- | :--- | :--- |
| `exePath` | `""` | 手动指定 `Antigravity.exe` 绝对路径；留空则自动探测常见路径与注册表 |
| `proxyMode` | `"auto"` | 代理策略：`"auto"` 自动继承环境变量/Windows 系统代理/常见本地代理端口；`"none"` 禁用代理注入；也可填如 `"http://127.0.0.1:7897"` |
| `cdpPort` | `9229` | 本地 CDP 调试端口（仅绑定 `127.0.0.1`） |
| `cdpHost` | `"127.0.0.1"` | 本地回环地址，**请勿改为 `0.0.0.0`** 以确保安全 |
| `webConsoleEnabled` | `true` | 是否启动本地 Web 管理面板 |
| `webConsolePort` | `19222` | 本地 Web 管理面板端口（如端口冲突可自行修改） |
| `autoOpenConsole` | `false` | 设为 `true` 时，每次启动中文版会自动弹出管理面板网页 |
| `enabledOnStart` | `true` | 启动时是否默认开启中文汉化 |
| `watchDictionaries` | `true` | 是否监听 `dict/` 目录变更并自动热更新词库 |
| `pollIntervalMs` | `1500` | 检测新打开窗口/子面板的轮询间隔（毫秒） |
| `maxTextLength` | `220` | 参与匹配的最大文本长度，超长段落自动跳过以防误伤正文 |
| `extraLaunchArgs` | `[]` | 启动 `Antigravity.exe` 时额外附加的命令行参数 |
| `ignoreSelectors` | 见文件 | 强制跳过翻译的 CSS 选择器列表（如代码编辑器、终端、正文容器） |

---

## 注意事项与常见问题（必读）

### 1. 启动前必须彻底退出原版 Antigravity（最常见）
Electron 客户端启用了**单实例锁（Single Instance Lock）**。如果原版 Antigravity 已经在后台运行（哪怕只是最小化到了右下角系统托盘），再通过启动器拉起时，新进程会直接把焦点交给旧进程并退出，导致本地调试端口无法打开。

- **正确做法**：先右键右下角托盘图标彻底退出 Antigravity，再双击中文版快捷方式启动。
- **如何确认**：运行 `npm run check`，看到“Antigravity 进程状态: 未运行”后再启动即可。

### 2. 为什么顶部原生系统菜单 / 托盘右键菜单仍为英文？
这是**无损零侵入架构**的有意取舍：CDP 只作用于渲染层（覆盖侧边栏、对话区、设置页、弹窗、自定义面板、产物与辅助面板等 95%+ 的日常交互界面），不解包也不修改官方 `app.asar`。这样能换取官方自动更新永不损坏、无文件校验报错、零风险的长期稳定性。

### 3. 安全性与端口占用说明
- CDP 端口（默认 `9229`）与 Web 控制台端口（默认 `19222`）均严格绑定在 **`127.0.0.1` 本地回环地址**，局域网或公网设备均无法访问。
- 如本机已有其他软件占用 `9229` 或 `19222`，直接修改 [config.json](./config.json) 中的对应端口号即可。

### 4. 关于无黑窗启动脚本（`.vbs`）的安全提示
桌面快捷方式调用的 [scripts/launcher-hidden.vbs](./scripts/launcher-hidden.vbs) 仅有 8 行纯文本代码，作用仅仅是静默调用 `node src/index.mjs launch --gui-alert` 以避免弹出黑色命令行窗口。若个别安全软件对 `.vbs` 有敏感提示，可以放行，或直接使用 **`启动中文版.bat`** / `npm start` 启动。

### 5. 如果遇到个别代码/用户内容被误翻译怎么办？
本引擎默认只匹配词库中明确登记的 UI 文案，并排除了常见代码编辑器与正文容器。如果未来版本 DOM 结构变化导致某区域被误译：
- 将该区域的 CSS 选择器添加到 [config.json](./config.json) 的 `ignoreSelectors` 中；
- 或在 `dict/` 中移除/调整对应词条，保存后立即热生效。

### 6. 如何完全卸载与还原？
因为本工具**从未修改过 Antigravity 任何安装文件**：
1. 退出 Antigravity 2.0；
2. 删除桌面的 `Antigravity 2.0 中文版` 快捷方式和本项目文件夹（如启用了可选插件，顺手删掉 `%USERPROFILE%\.gemini\config\plugins\zh-cn-assistant`）；
3. 正常打开官方原版 Antigravity 即可，零残留。

---

## 目录结构

```text
antigravity-2.0-zh-cn/
├── config.json                  # 本地配置文件
├── config.example.json          # 默认配置模板
├── dict/                        # 模块化词库（支持文件修改自动热更新）
│   ├── common.json              # 通用按钮、弹窗、菜单、状态
│   ├── sidebar.json             # 侧边栏导航、项目、会话列表
│   ├── chat.json                # 对话画布、工具调用、产物、辅助面板
│   ├── settings.json            # 全局/项目设置、权限与沙箱策略
│   ├── customizations.json      # Skills / Rules / Plugins / Hooks / MCP / 定时任务
│   ├── patterns.json            # 锚定正则模板（时间/计数等动态 UI 文本）
│   └── user-custom.json         # 用户自定义词库（优先级最高）
├── src/                         # 核心源码（零第三方依赖）
├── scripts/                     # 桌面快捷方式生成、无黑窗包装与词库校验
├── optional-agent-plugin/       # 可选配套原生中文回复插件模板
└── test/                        # Node 内置单元测试
```

---

## 参与贡献

欢迎提交 PR 补充新版本词条或优化界面保护规则！提交前请运行以下命令确保校验与测试全部通过：

```powershell
npm run validate
npm test
```

## 开源协议

本项目基于 [MIT License](./LICENSE) 开源。
