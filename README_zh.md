<!-- BrightBox -->

<div align="center">

# BrightBox

**轻量 Windows 托盘亮度工具**

[![Windows](https://img.shields.io/badge/Windows-10%2F11-blue?style=flat-square&logo=windows&logoColor=white)](https://www.microsoft.com/windows)
[![License](https://img.shields.io/badge/License-MIT-green?style=flat-square)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Rust](https://img.shields.io/badge/Rust-1.70+-orange?style=flat-square&logo=rust&logoColor=white)](https://www.rust-lang.org)
[![Tauri](https://img.shields.io/badge/Tauri-2.0-4K8C6D?style=flat-square&logo=tauri&logoColor=white)](https://tauri.app)

**[English ->](README.md)**

</div>

---

## 它能做什么

BrightBox 常驻 Windows 系统托盘，为支持的显示器提供一个紧凑的亮度面板。它可以调节 HDR 下的 SDR 白点电平，也可以在可用时通过 DDC/CI 调节外接显示器亮度，或通过 Windows 调节内置屏亮度。

如果同一台物理显示器同时支持 HDR 和 DDC/CI 亮度，它在应用里仍然只显示为一台显示器。开启或关闭 HDR 时，只会改变滑块当前控制的亮度类型，不会生成重复的显示器条目。

---

## 功能

| 功能 | 说明 |
|------|------|
| 🎚️ 亮度滑块 | 在托盘窗口里调节选中显示器亮度 |
| 🌗 HDR 开关 | 为支持 HDR 的显示器开启或关闭 HDR |
| 🖥️ 多显示器支持 | 每台检测到的显示器都可以独立控制 |
| 🔗 同步亮度 | 可选将一次亮度调整应用到所有支持的显示器 |
| 📍 托盘控制 | 左键显示/隐藏窗口，右键打开菜单 |
| ⌨️ 快捷键 | 使用可自定义快捷键调节亮度 |
| 🖱️ 鼠标滚轮 | 在滑块上直接微调亮度 |
| 🚀 开机自启 | 可随 Windows 启动 |
| 🎨 明暗主题 | 可跟随 Windows，也可手动选择浅色或深色 |
| 🧾 轮转日志 | 保留少量本地日志，便于排查问题 |

---

## 系统要求

- Windows 10 或 Windows 11
- 显示器至少支持以下一种亮度控制方式：
  - HDR SDR 白点电平
  - 外接显示器 DDC/CI 亮度
  - Windows 内置屏亮度控制

不同显示器暴露的能力不同。例如有的显示器支持 HDR 但不支持 DDC/CI 亮度，也有的显示器支持 DDC/CI 亮度但不支持 HDR。

---

## 下载

从 **[Releases](https://github.com/tyth66/hdr-toolbox/releases)** 下载最新版：

```text
brightbox.exe
```

运行后，应用图标会出现在系统托盘里。

---

## 使用方法

1. 启动 BrightBox。
2. 左键点击托盘图标，显示或隐藏亮度窗口。
3. 在侧边显示器栏中选择一台显示器。
4. 拖动滑块、滚动鼠标滚轮，或使用亮度快捷键调节。
5. 需要切换 HDR 模式时，使用选中显示器的 HDR 开关。

HDR 开启时，滑块控制 SDR 白点电平。HDR 关闭时，如果显示器支持物理亮度控制，同一个滑块会控制显示器亮度。

### 刷新行为

| 操作 | 会发生什么 | 刷新按钮转动 |
|------|------------|--------------|
| 从托盘打开窗口 | 读取已知显示器的当前状态 | 否 |
| 窗口重新获得焦点 | 读取已知显示器的当前状态 | 否 |
| 点击刷新按钮 | 重新检测显示器和亮度控制方式 | 是 |

插拔显示器、改动显示硬件，或应用里的显示器状态看起来不对时，使用刷新按钮。普通的托盘唤醒和窗口聚焦只会静默更新状态，不会让刷新按钮转动。

### 快捷键

| 快捷键 | 功能 |
|--------|------|
| `Ctrl+Alt+Up` | 亮度 +4% |
| `Ctrl+Alt+Down` | 亮度 -4% |

可以在设置里修改这些快捷键。

---

## 设置

| 设置 | 说明 |
|------|------|
| 开机自启 | Windows 启动时自动运行 BrightBox |
| 同步所有显示器 | 将亮度调整应用到每台具备可用亮度控制方式的显示器 |
| 主题 | 跟随 Windows，或手动选择浅色/深色 |

---

## 说明

- HDR SDR 白点电平的控制范围是 80-480 尼特。
- DDC/CI 是否可用取决于显示器、线缆、显卡输出路径和显示器设置。
- 部分显示器需要在显示器 OSD 菜单中手动开启 DDC/CI。
- Windows 设置、显示器 OSD 和其他亮度工具可能会修改同一个硬件亮度值。应用在托盘窗口显示或重新获得焦点时，会读取已知显示器的当前状态。

---

## 常见问题

| 问题 | 解答 |
|------|------|
| HDR 开关不可用 | 当前显示器没有报告 HDR 支持。亮度仍可能通过其他受支持方式工作。 |
| 调节亮度没有效果 | 当前显示器可能没有暴露可用的亮度控制方式，或显示器菜单里关闭了 DDC/CI。 |
| 我在别处改了亮度 | 显示或聚焦应用窗口，它会读取当前已知显示器状态。如果显示设置变了，请点击刷新按钮。 |
| 如何退出 | 右键点击托盘图标，选择退出。 |

---

## 从源码运行

BrightBox 使用 Bun 管理依赖、运行脚本和执行前端测试。Vite 仍然负责前端开发服务器和生产前端构建。

```bash
bun install
bun run tauri dev
bun run tauri build
```

发布版 exe 会生成在 `src-tauri/target/release/` 下。

---

## 许可证

MIT 许可证。详见 [LICENSE](LICENSE)。
