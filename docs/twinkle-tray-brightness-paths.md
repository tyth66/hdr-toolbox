# Twinkle Tray Brightness Paths — 参考笔记

**调研日期:** 2026-06-29  
**状态:** 已完成吸收，DDC VCP 优先级、WMI 路径、HDR SDR nits 转换均已实现在 HDR Toolbox 中

## Twinkle Tray 亮度路径汇总

| 路径 | Twinkle Tray API | HDR Toolbox 对应 |
|---|---|---|
| DDC/CI VCP | `SetVCPFeature` (native addon) | `display/ddcci.rs` (windows-rs) |
| DDC high-level | `SetMonitorBrightness` (native addon) | `display/ddcci.rs` (windows-rs) |
| WMI 内置屏 | `WmiSetBrightness` (COM/WMI) | `display/wmi.rs` (COM/WMI) |
| HDR SDR 白点 | `setSDRBrightness` (windows-hdr) | `display/ffi.rs` (DisplayConfig) |

## HDR Toolbox 架构差异

- **不采用** Twinkle Tray 的 Electron 子进程模式，Rust 后端直接拥有 provider 选择权
- **不采用** native Node addon（`@hensm/ddcci`），使用 windows-rs 直接调用 Win32 API
- **不采用** PowerShell WMI fallback，使用原生 COM/WMI
- **VCP 优先级** 保持一致: `0x10` → `0x13` → `0x6B` → `0x12`
- **nits 转换** 保持一致: `nits = 80 + percent * 4`（80-480 范围）
