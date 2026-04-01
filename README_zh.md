<!-- HDR Toolbox -->

<div align="center">

# HDR Toolbox

**Windows 系统托盘应用，调节 HDR 显示器 SDR 亮度**

[![Windows](https://img.shields.io/badge/Windows-10%2F11-blue?style=flat-square&logo=windows&logoColor=white)](https://www.microsoft.com/windows)
[![License](https://img.shields.io/badge/License-MIT-green?style=flat-square)](LICENSE)
[![Rust](https://img.shields.io/badge/Rust-1.70+-orange?style=flat-square&logo=rust&logoColor=white)](https://www.rust-lang.org)
[![Tauri](https://img.shields.io/badge/Tauri-2.0-4K8C6D?style=flat-square&logo=tauri&logoColor=white)](https://tauri.app)

**[English →](README.md)**

---

## ✨ 功能特点

| 功能 | 说明 |
|------|------|
| 🎚️ **亮度滑块** | 实时调节 SDR 白点电平（80-480 尼特） |
| 🌗 **HDR 开关** | 一键开启/关闭 HDR 模式 |
| ⌨️ **全局热键** | 自定义快捷键（默认 `Win+Alt+↑/↓`） |
| 🖱️ **滚轮调节** | 滑块上滚动微调（2% 步进） |
| 🖥️ **多显示器** | 每台显示器独立控制 |
| ⚡ **静默刷新** | 从托盘唤醒时自动同步状态 |
| 🔄 **手动刷新** | 标题栏按钮重新检测显示器 |
| 🚀 **开机自启** | 可选系统启动时运行 |
| 📍 **托盘控制** | 左键显示/隐藏，右键菜单 |

---

## 📋 系统要求

- **系统：** Windows 10 或 Windows 11
- **显示器：** 支持 HDR
- **说明：** HDR 可随时开启应用会自动检测可用显示器

---

## 🚀 快速开始

### 下载安装

从 **[Releases](https://github.com/your-repo/hdr-toolbox/releases)** 下载：

```
hdr-toolbox.exe
```

### 从源码构建

```bash
# 克隆项目
git clone https://github.com/your-repo/hdr-toolbox.git
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

## 📖 使用方法

```
1. 运行应用 → 托盘出现图标
2. 左键点击托盘 → 显示/隐藏亮度窗口
3. 右键点击托盘 → 打开设备菜单
4. 拖动滑块或使用滚轮/键盘调节
5. 点击状态栏 HDR 开关切换模式
```

### ⌨️ 热键

| 快捷键 | 功能 |
|--------|------|
| `Win+Alt+↑` | 亮度 +4% |
| `Win+Alt+↓` | 亮度 -4% |
| `Win+Alt+H` | 切换 HDR |

> 在 **设置** 中自定义热键

---

## ⚙️ 配置

| 设置 | 说明 |
|------|------|
| **开机自启** | 在设置中开启/关闭 |
| **亮度范围** | 固定 **80-480 尼特** |

> ℹ️ 此应用控制的是 **SDR 白点电平**（Windows 显示适配层），而非显示器 OSD 背光亮度。

---

## ❓ 常见问题

| 问题 | 解答 |
|------|------|
| **HDR 开关是灰色** | 确保显示器已连接且支持 HDR，点击刷新按钮 |
| **调节无效果** | 部分显示器可能不支持此控制路径 |
| **如何退出** | 右键托盘图标 → **退出** |

---

## 🛠️ 技术栈

| 层级 | 技术 |
|------|------|
| 前端 | React 18 · TypeScript · Vite |
| 后端 | Rust · Tauri 2 |
| 系统 API | Windows DisplayConfig API |

---

## 📄 许可证

MIT 许可证 · 详见 [LICENSE](LICENSE)
