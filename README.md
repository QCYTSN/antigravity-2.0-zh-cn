# Antigravity 2.0 无损中文汉化引擎 (`antigravity-2.0-zh-cn`)

专为 **Google Antigravity 2.0 桌面端** 打造的零侵入、零依赖动态中文汉化套件。

> **核心理念**：不修改任何官方安装文件（不动 `Antigravity.exe` 与 `app.asar`），无需安装额外中文版软件；官方自动更新不损坏汉化；支持一键无损切换中/英文与新版本词条一键采集。

---

## 核心特性

- **零侵入 / 无损安全**：通过 Electron 标准本地调试协议（CDP，`127.0.0.1` 仅本机回环）在渲染层动态替换 UI 文本，不破坏软件签名与文件完整性，关闭即可 100% 恢复原版。
- **零第三方依赖**：基于 Node.js 22+ 原生 `fetch` 与 `WebSocket`，无需 `npm install`，开箱即用。
- **React 友好 & 防误伤保护**：
  - 仅修改 `Text` 节点的 `nodeValue` 与安全 UI 属性（`placeholder` / `title` / `aria-label` / `data-tooltip`），不破坏 React 虚拟 DOM 结构。
  - 自动跳过代码块（`<code>` / `<pre>`）、编辑器（Monaco / CodeMirror）、终端、输入框正文、Markdown 正文、URL、文件路径和代码特征字符串。
- **本地 Web 管理控制台（`http://127.0.0.1:19222`）**：
  - **一键中/英切换**：无需重启 Antigravity 2.0，实时无损切换。
  - **新版本快速适配**：点击“扫描当前界面”自动捕获 Antigravity 2.0 新版本新增的未翻译英文控件，在线填中文立即热生效。
  - **词库热更新**：直接编辑 `dict/*.json` 或在面板中增删词条，保存即刻推送到所有运行中的窗口。
- **无黑窗桌面快捷方式**：一键在桌面生成带有官方图标的 `Antigravity 2.0 中文版` 快捷方式。

---

## 环境要求

- Windows 10 / 11
- 已安装官方 **Antigravity 2.0**
- **Node.js >= 22**（当前环境已内置原生 `WebSocket`）

---

## 快速开始

### 1. 首次使用（推荐）

1. 先**彻底退出**当前运行的 Antigravity 2.0（注意检查右下角系统托盘图标并退出）。
2. 双击项目目录下的 **`创建桌面快捷方式.bat`**，会在桌面生成带官方图标的 **`Antigravity 2.0 中文版`**（双击无黑窗启动）。
3. 双击桌面快捷方式（或直接双击本目录的 **`启动中文版.bat`**），即可自动启动 Antigravity 2.0 并实时完成界面汉化。

### 2. 打开本地汉化管理面板

启动中文版后，双击 **`打开管理面板.bat`** 或浏览器访问：

```text
http://127.0.0.1:19222
```

在管理面板中可以：
- 查看已挂载的 Antigravity 2.0 窗口及已汉化节点数
- 一键暂停汉化（切回原版英文）或恢复中文
- 扫描当前页面未翻译的新增英文 UI 控件并直接录入词库

---

## 常用脚本与命令

| 文件 / 命令 | 作用 |
| :--- | :--- |
| `启动中文版.bat` / `npm start` | 启动 Antigravity 2.0 并挂载实时汉化引擎（保留终端日志，方便排障） |
| `创建桌面快捷方式.bat` | 在桌面创建无黑窗、带官方图标的 `Antigravity 2.0 中文版` 快捷方式 |
| `打开管理面板.bat` | 在浏览器打开 `http://127.0.0.1:19222` 汉化控制台 |
| `热附着汉化.bat` / `npm run attach` | 仅挂载汉化引擎（适用于 Antigravity 已以 `--remote-debugging-port=9229` 运行时） |
| `npm run check` | 环境自检（检查 Node 版本、Antigravity 路径、词库规模与 CDP 端口状态） |
| `npm run validate` | 校验 `dict/` 下所有 JSON 词库与正则模板语法 |
| `npm test` | 运行内置自动化单元测试 |

---

## 项目结构与词库适配指南

```text
antigravity-2.0-zh-cn/
├── config.json                  # 本地配置（自定义 exePath、CDP 端口、忽略选择器等）
├── dict/                        # 模块化词库（支持文件修改自动热更新）
│   ├── common.json              # 通用按钮、弹窗、状态标签
│   ├── sidebar.json             # 左侧栏导航、项目与会话列表
│   ├── chat.json                # 对话区、输入框、工具调用、产物、辅助面板
│   ├── settings.json            # 全局设置、项目设置、权限与沙箱策略
│   ├── customizations.json      # Skills / Rules / Plugins / Hooks / MCP / 定时任务
│   ├── patterns.json            # 正则模板（如 "5 minutes ago" -> "5 分钟前"）
│   └── user-custom.json         # 用户自定义词库（优先级最高，个人修改写这里不冲突）
├── src/
│   ├── index.mjs                # 主启动器与 CLI
│   ├── config.mjs               # 配置加载与 Windows 路径自动探测
│   ├── dict-loader.mjs          # 词库合并、原子写入与文件热监听
│   ├── cdp-manager.mjs          # 零依赖 CDP 多窗口连接与热推送管理器
│   ├── injector-runtime.mjs     # 注入到渲染层的 React-safe 翻译引擎
│   └── web-console.mjs          # 本地 HTTP 管理控制台
├── scripts/                     # 快捷方式生成、无黑窗启动包装器与词库校验
├── optional-agent-plugin/       # 可选配套原生插件：让 AI 默认用中文回复与写文档
└── test/                        # Node 内置单元测试
```

### 如何快速适配 Antigravity 2.0 新版本更新？

1. 打开管理面板 `http://127.0.0.1:19222`。
2. 在 Antigravity 2.0 中切到你想补充汉化的页面（例如新版设置页或新弹窗）。
3. 在管理面板点击 **“扫描当前界面”**，把新出现的英文词条填上中文点 **“录入”**，会立刻生效并保存到 `dict/user-custom.json`。
4. 如果发现某个特定区域不希望被翻译，只需把对应的 CSS 选择器添加到 `config.json` 的 `ignoreSelectors` 数组中即可。

---

## 可选配套：让 AI 默认用中文回复（原生插件）

本项目还附带了一个标准的 Antigravity 原生规则插件模板：

```text
optional-agent-plugin/zh-cn-assistant/
```

如果你希望 AI Agent 在对话、规划和生成文档时也默认使用简体中文，可以将 `zh-cn-assistant` 整个文件夹复制到：

```text
%USERPROFILE%\.gemini\config\plugins\zh-cn-assistant
```

即可在 Antigravity 的 **Customizations -> Plugins** 中按原生插件开关管理。

---

## 常见问题

1. **提示“检测到 Antigravity 2.0 已经在运行（且未开启本地调试端口）”怎么办？**
   - Electron 应用启用了单实例锁，如果原版已在运行，新启动的进程无法额外打开调试端口。请先右键右下角托盘图标彻底退出 Antigravity，再双击中文版快捷方式启动即可。
2. **找不到 `Antigravity.exe` 怎么办？**
   - 打开 `config.json`，把你本机的 `Antigravity.exe` 绝对路径填到 `"exePath"` 字段（注意 JSON 中反斜杠需要双写 `\\`），保存后重试。
3. **为什么系统顶部原生菜单栏/托盘右键菜单还是英文？**
   - 这是无损方案的有意取舍：CDP 只作用于渲染层（页面内 95%+ 的高频交互区、侧边栏、对话区、设置页和辅助面板），不修改官方 `app.asar`，从而换来“零侵入、免重装、更新不坏”的稳定性。
