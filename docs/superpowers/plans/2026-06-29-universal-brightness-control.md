# Universal Brightness Control — 实现状态

**计划日期:** 2026-06-29  
**最后更新:** 2026-06-30  
**状态:** 13/14 任务完成，仅剩硬件冒烟验证

## 完成能力

| 能力 | 实现位置 | 状态 |
|---|---|---|
| 共享 Rust/TS DisplayInfo + BrightnessSource 契约 | `display/model.rs` + `types.ts` | ✅ |
| 纯亮度转换/路由函数 | `display/brightness.rs` | ✅ |
| DDC/CI provider (枚举 + high-level + VCP 读写) | `display/ddcci.rs` | ✅ |
| WMI provider (COM 枚举 + WmiSetBrightness) | `display/wmi.rs` | ✅ |
| 结构化 DDC/WMI 错误码 | `display/error.rs` + `errors.ts` | ✅ |
| 架构边界测试 (provider 模块隔离) | `architectureContract.test.ts` | ✅ |
| Provider 合并 (HdrSdr > DDC > WMI 去重) | `display/service.rs` | ✅ |
| Source-routed 亮度写入 | `display/service.rs` | ✅ |
| 每显示器故障追踪 (3 次阈值) | `display/service.rs` | ✅ |
| 前端通用 brightness 状态 (非 nits 派生) | `hooks/displayState.ts` | ✅ |
| Source-aware UI 标签 | `BrightnessSlider` + `StatusBar` | ✅ |
| 托盘通用摘要 | `app/state.rs` + `tray.rs` | ✅ |
| 文档更新 | README / DESIGN / AGENTS.md | ✅ |

## 待完成

- [ ] **硬件冒烟测试** — 在真实 Windows 多显示器环境验证：HDR SDR、DDC/CI、WMI 三条路径的滑块控制和托盘同步。

## 关键架构决策

- **Rust 权威**: 后端拥有显示状态，前端单向消费
- **Provider 软失败**: DDC/WMI 枚举失败不阻塞其他 provider
- **同名去重**: HDR SDR > DDC > WMI 优先级，防重复
- **不引入 Node 原生模块**: 纯 Rust + Tauri IPC
- **命令名兼容**: 保留 `get_hdr_displays` 名称避免断裂变更

## 验证

```bash
npm test              # 前端测试 + Rust 测试 (51 pass)
npm run typecheck     # TypeScript 零错误
cd src-tauri && cargo clippy --all-targets -- -D warnings  # 零 warning
```
