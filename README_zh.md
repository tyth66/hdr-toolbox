<!-- HDR Toolbox -->

<div align="center">

# HDR Toolbox

**Windows 托盘亮度工具，支持 DDC/CI 外接显示器、内置屏 WMI 亮度和 HDR SDR 白点电平**

[![Windows](https://img.shields.io/badge/Windows-10%2F11-blue?style=flat-square&logo=windows&logoColor=white)](https://www.microsoft.com/windows)
[![License](https://img.shields.io/badge/License-MIT-green?style=flat-square)](LICENSE)
[![Rust](https://img.shields.io/badge/Rust-1.70+-orange?style=flat-square&logo=rust&logoColor=white)](https://www.rust-lang.org)
[![Tauri](https://img.shields.io/badge/Tauri-2.0-4K8C6D?style=flat-square&logo=tauri&logoColor=white)](https://tauri.app)

**[English →](README.md)**

</div>

---

## 当前范围

HDR Toolbox 是一个 Universal Brightness Control 风格的 Windows 托盘应用。Rust/TypeScript 共享显示器契约已经加入 `BrightnessSource`、通用 `brightness`、provider 身份和 DDC VCP code 元数据。provider 模块现在已包含 DDC/CI 物理显示器和内置屏 WMI 的枚举/写入路径，Rust service 已经把 HDR SDR、DDC/CI 和 WMI provider 结果合并为一个显示器列表，后端亮度写入也已经按来源路由。

---

## ✨ 功能特点

| 功能 | 说明 |
|------|------|
| 🎚️ **亮度滑块** | 实时调节 SDR 白点电平（80-480 尼特） |
| 🌗 **HDR 开关** | 一键开启/关闭 HDR 模式 |
| ⌨️ **全局热键** | 自定义快捷键（默认 `Ctrl+Alt+↑/↓`） |
| 🖱️ **滚轮调节** | 滑块上滚动微调（2% 步进） |
| 🖥️ **多显示器** | 每台显示器独立控制，也可同步调节亮度 |
| ⚡ **静默刷新** | 从托盘唤醒时自动同步状态 |
| 🔄 **手动刷新** | 标题栏按钮重新检测显示器 |
| 🚀 **开机自启** | 可选系统启动时运行 |
| 📍 **托盘控制** | 左键显示/隐藏，右键菜单 |
| 🎨 **原生主题** | Acrylic 窗口材质、Fluent UI 控件和固定 Codex 强调色 |
| 🧾 **轮转日志** | 在 `log/` 下写入时间戳命名的 `.log` 文件，单文件 10MB，最多保留 3 份 |
| 🧭 **通用亮度模型** | 内部 `DisplayInfo` 包含 `BrightnessSource`、标准化 `brightness`、raw 亮度元数据、provider 身份和 Rust 侧来源路由 |
| 🧱 **结构化 provider 错误** | DDC/CI 和 WMI 失败会通过稳定的结构化错误码贯穿 Rust 命令和前端处理 |
| 🧩 **Provider 模块边界** | 架构测试锁定物理显示器 API 只能进入 `display/ddcci.rs`，WMI API 只能进入 `display/wmi.rs` |
| 🧮 **DDC/CI provider** | Rust provider 代码可枚举物理显示器句柄、读取 high-level/VCP 亮度、写入 high-level/VCP 亮度，并保留 raw/percent helper 测试 |
| 🖥️ **WMI provider** | Rust provider 代码可连接 `ROOT\WMI`，读取 `WmiMonitorBrightness`，并调用 `WmiMonitorBrightnessMethods.WmiSetBrightness` 写入亮度 |
| 🔀 **Provider merge** | Rust service 在现有显示器列表命令背后合并 HDR SDR、DDC/CI 和 WMI provider 结果 |
| 🔀 **HDR 来源切换** | HDR 开关在同一显示器条目上自动翻转 SDR 白点电平和物理亮度（DDC/CI 或内置屏 WMI），无重复条目 |
| 🎛️ **按来源路由的后端写入** | Rust 亮度命令现在会按选中显示器的 `BrightnessSource` 路由 HDR SDR、DDC/CI high-level、DDC/CI VCP 和 WMI 写入 |
| 🧩 **通用前端状态** | 前端 display-state hooks 现在读取和更新标准化 `brightness`，不再把所有 slider 值都从 HDR SDR nits 反推 |
| 🏷️ **来源感知 UI 标签** | 主滑块和状态栏会描述 HDR SDR、DDC/CI 和 WMI 亮度来源，并允许非 HDR 亮度控件 |
| 📍 **通用托盘摘要** | 托盘菜单和 tooltip 摘要使用来源感知的亮度百分比，不再是 HDR-only nits |

---

## 📋 系统要求

- **系统：** Windows 10 或 Windows 11
- **显示器：** 支持 HDR
- **说明：** HDR 可以处于关闭状态，应用仍会检测支持 HDR 的显示器

---

## 🚀 快速开始

### 下载安装

从 **[Releases](https://github.com/tyth66/hdr-toolbox/releases)** 下载：

```
hdr-toolbox.exe
```

### 从源码构建

```bash
# 克隆项目
git clone https://github.com/tyth66/hdr-toolbox.git
cd hdr-toolbox

# 安装依赖
npm install

# 开发模式
npm run tauri dev

# 构建发布版
npm run tauri build
```

> **输出文件：** `src-tauri/target/release/hdr-toolbox.exe`

---

## 🔁 CI/CD

- 每次分支代码 push 和 pull request 都会运行 Windows CI。
- CI 会验证 TypeScript、前端测试、Rust 格式、`cargo check`、clippy、Rust 测试和 Vite 前端构建。
- `main` 分支 push 的 CI 通过后，Release workflow 会自动构建 Windows Tauri 发布包，上传为 workflow artifact，并发布正式的 `HDR Toolbox` GitHub Release。
- 正式发布使用固定的 `release` tag，产物文件名保持稳定且不带版本号后缀：`hdr-toolbox.exe`、`hdr-toolbox-setup.exe`、`hdr-toolbox.msi`。

---

## 📖 使用方法

```
1. 运行应用 → 托盘出现图标
2. 左键点击托盘 → 显示/隐藏亮度窗口
3. 右键点击托盘 → 打开设备菜单
4. 拖动滑块或使用滚轮/键盘调节
5. 点击 HDR 开关在 SDR 白点电平和物理亮度之间切换
```

### ⌨️ 热键

| 快捷键 | 功能 |
|--------|------|
| `Ctrl+Alt+↑` | 亮度 +4% |
| `Ctrl+Alt+↓` | 亮度 -4% |

> 在 **设置** 中自定义热键

---

## ⚙️ 配置

| 设置 | 说明 |
|------|------|
| **开机自启** | 在设置中开启/关闭 |
| **同步所有显示器亮度** | 将亮度调节应用到检测到的每台 HDR 显示器 |
| **主题** | 默认跟随系统，也可在设置中选择浅色/深色 |
| **亮度范围** | 固定 **80-480 尼特** |
| **日志** | debug 构建写入仓库 `log/`；release 构建写入 exe 同级 `log/`。日志按创建时间戳命名，单文件 10MB，最多保留 3 份。 |

> ℹ️ HDR 开启时控制 **SDR 白点电平**；HDR 关闭时自动切换为物理亮度（DDC/CI 或 WMI）。

### 外观

应用使用透明 Tauri 窗口和 Windows Acrylic 背景材质，控件层使用 Fluent UI v9。固定 Codex 强调色（`#339CFF`）会应用到滑块、开关、选中显示器、悬停和焦点状态。每次托盘窗口显示前都会先刷新强调色变量。

---

## ❓ 常见问题

| 问题 | 解答 |
|------|------|
| **HDR 开关是灰色** | 显示器不支持 HDR。无需 HDR 也可通过 DDC/WMI 调节亮度 |
| **调节无效果** | 部分显示器可能不支持此控制路径 |
| **如何退出** | 右键托盘图标 → **退出** |

---

## 🛠️ 技术栈

| 层级 | 技术 |
|------|------|
| 前端 | React 18 · TypeScript · Vite |
| UI | Fluent UI v9 · CSS tokens · Windows Acrylic |
| 后端 | Rust · Tauri 2 |
| 系统 API | Windows DisplayConfig API · DDC/CI · WMI provider API |

---

## 📄 许可证

MIT 许可证 · 详见 [LICENSE](LICENSE)
