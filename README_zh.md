# HDR Toolbox

轻量级 Windows 系统托盘应用，用于快速调节 HDR 显示器 SDR 内容的亮度，基于 **Rust + Tauri** 构建。

## ✨ 功能特性

| 功能 | 说明 |
|------|------|
| 🎛️ **系统托盘控制** | 常驻系统托盘运行 |
| 🖱️ **左键单击** | 显示/隐藏亮度调节滑块窗口 |
| 🖱️ **右键单击** | 弹出动态设备列表上下文菜单 |
| ⌨️ **全局快捷键** | `Ctrl+Alt+↑/↓` 增减亮度 10% |
| 🖥️ **多显示器支持** | 每台 HDR 显示器独立控制 |
| 🚀 **开机自启** | 可在设置面板中切换（⚙️ 按钮） |
| 💡 **实时滑块** | 拖动滑块立即应用亮度变化 |

## 📋 系统要求

- Windows 10/11
- 支持 HDR 的显示器，且已在 Windows 设置中开启 HDR
- 磁盘空间约 5 MB

## 🚀 快速开始

### 使用预编译版本

从 `src-tauri/target/release/` 目录下载最新的 `.exe` 文件。

### 从源码构建

#### 前置条件

- **Rust** 1.77+ ([rustup](https://rustup.rs/))
- **Node.js** 18+ ([nodejs.org](https://nodejs.org/))
- **Visual Studio** Build Tools（包含 C++ 工作负载）

#### 构建步骤

```bash
# 安装前端依赖
npm install

# 开发模式
npm run tauri dev

# 生产构建
npm run tauri build
```

编译后的二进制文件位于：
```
src-tauri/target/release/hdr-toolbox.exe
```

## 🎮 使用说明

### 操作方式

| 操作 | 输入 |
|------|------|
| 显示/隐藏滑块 | 左键单击托盘图标 |
| 打开设备菜单 | 右键单击托盘图标 |
| 切换显示器 | 右键 → 选择显示器 |
| 打开设置 | 点击标题栏 ⚙️（设置）按钮 |
| 增加亮度 | `Ctrl+Alt+↑`（+10%） |
| 降低亮度 | `Ctrl+Alt+↓`（-10%） |
| 失去焦点隐藏 | 点击窗口外部自动隐藏 |

### 启动行为

首次启动时，应用会显示通知，列出所有检测到的 HDR 显示器及其当前亮度。4 秒后通知自动关闭，主窗口滑块保留供用户操作。窗口在失去焦点（blur）时也会自动隐藏。系统托盘工具提示始终显示当前显示器的亮度。

### 亮度范围

- **UI 滑块**：0–100%（与 Windows 显示滑块一致）
- **Nits 范围**：80–480 尼特（因显示器 HDR 元数据而异）
- **换算公式**：`((percentage / 100) * (max_nits - min_nits)) + min_nits`
- **快捷键步进**：每次 ±10%

## 🏗️ 架构

### 技术栈

| 层级 | 技术 |
|------|------|
| UI 框架 | Tauri 2.x (WebView2) |
| 前端 | React 18 + TypeScript + Vite |
| 后端 | Rust |
| Windows API | `windows-rs` crate + 原始 FFI |
| 系统托盘 | Tauri 内置 `tray-icon` |
| 全局快捷键 | `tauri-plugin-global-shortcut` |
| 开机自启 | `tauri-plugin-autostart` |

### 核心文件

```
src-tauri/
├── src/
│   ├── main.rs          # 入口点
│   ├── lib.rs           # Tauri 构建器 + 插件配置
│   ├── display.rs       # DisplayConfig API（HDR 读取/设置）
│   └── tray.rs         # 系统托盘（托盘在 Rust 中管理，不通过 tauri.conf.json）
src/
├── App.tsx              # React 滑块 UI
└── main.tsx            # Tauri 事件监听
```

### 核心实现

HDR 亮度控制核心使用 Windows DisplayConfig API：

```rust
// 读取 SDR 白电平（官方 API）
DisplayConfigGetDeviceInfo(&mut sdr_info.header);

// 设置 SDR 白电平（非官方 API）
DisplayConfigSetDeviceInfo(&mut set_params.header);
```

**重要提示**：`DISPLAYCONFIG_DEVICE_INFO_SET_SDR_WHITE_LEVEL`（`0xFFFFFFEE`）是**微软未文档化**的 API。SET 操作需要 3 字段结构体（GET 为 2 字段），额外的 `finalValue` 字段**必须设置为 1** 才能使亮度变化生效。使用 GET 结构体进行 SET 操作会静默失败。
 
## 🔧 配置

无需配置文件，设置立即生效。

## 📄 许可证

MIT 许可证 — 见 [LICENSE](LICENSE)
