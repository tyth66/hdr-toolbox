# HDR Toolbox

一个轻量级 Windows 托盘工具，用于调节 HDR 显示器的 SDR 内容亮度，基于 **Rust + Tauri 2 + React** 构建。

## 功能

- 托盘常驻
- 左键托盘图标显示或隐藏亮度窗口
- 右键托盘图标打开动态设备菜单
- 支持自定义全局快捷键用于增减亮度
- 支持多台支持 HDR 的显示器独立调节，并保留当前 HDR 开关状态
- 状态栏提供可用的 HDR 开关
- 设置中可切换开机自启
- 拖动滑块时实时应用亮度
- 亮度滑块支持键盘调节并会实际提交亮度变化
- 鼠标悬停在亮度条上时可通过滚轮调节亮度
- 标题栏在设置按钮旁提供手动刷新按钮
- 从托盘显示窗口时，每次都会静默刷新一次显示器状态
- 非阻断错误会通过自动消失的通知条提示
- 界面文案已统一优化，HDR 状态、空状态和设置项表达更清晰

## 系统要求

- Windows 10/11
- 支持 HDR 的显示器
- HDR 初始可为关闭状态，应用仍可识别支持 HDR 的显示器并按显示器开启 HDR

## 开发运行

```bash
npm install
npm run tauri dev
```

## 构建

```bash
npm run build
npm run tauri build
```

## 测试

```bash
npm test
```

该命令会运行：

- 前端纯 TypeScript 逻辑测试
- Rust 显示服务辅助逻辑单元测试

输出文件：

```text
src-tauri/target/release/hdr-toolbox.exe
```

## 架构

### 前端

```text
src/
|- App.tsx
|- app/
|  |- useAppController.ts
|  '- useNoticeController.ts
|- brightness/
|  '- useBrightnessController.ts
|- hotkeys.ts
|- components/
|- hooks/
|  |- useDisplaySelection.ts
|  |- useDisplayDeviceActions.ts
|  |- useDisplays.ts
|  |- useHotkeys.ts
|  |- useWindowPosition.ts
|  |- useStartupOverlay.ts
|  |- displayState.ts
|  '- displayState.test.ts
|- services/
|  '- tauriApi.ts
|- displayContract.test.ts
|- errors.test.ts
|- hotkeys.test.ts
|- types.ts
|- types.test.ts
'- errors.ts
```

- `App.tsx`：轻量组合层
- `app/`：应用级控制器，负责初始化、弹窗、自启动和 notice
- `brightness/`：滑块交互控制器
- `hotkeys.ts`：快捷键归一化、持久化和展示文案
- `components/`：纯展示组件
- `hooks/useDisplays.ts`：对外统一的显示器状态 hook 门面
- `hooks/useDisplaySelection.ts`：选中显示器与派生百分比状态
- `hooks/useDisplayDeviceActions.ts`：刷新、亮度应用、HDR 切换流程
- `services/tauriApi.ts`：Rust 命令的类型化封装
- `displayContract.test.ts`：TypeScript/Rust 源码级契约校验
- `errors.test.ts`：用户可见错误文案映射的回归测试
- `*.test.ts`：前端逻辑与契约测试

### 后端

```text
src-tauri/src/
|- lib.rs
|- app/
|  |- mod.rs
|  |- state.rs
|  |- commands.rs
|  '- window.rs
|- tray.rs
'- display/
   |- model.rs
   |- ffi.rs
   |- service.rs
   '- commands.rs
```

- `app/state.rs`：共享 `AppState` 和 tray 摘要状态
- `app/commands.rs`：应用级命令，如托盘坐标、启动提示保护、拖动保护和退出
- `app/window.rs`：Mica 与失焦隐藏窗口行为
- `display/ffi.rs`：原始 Windows DisplayConfig / MCCS 调用
- `display/service.rs`：支持 HDR 的显示器枚举、HDR 切换后的状态轮询、失败状态逻辑与亮度业务逻辑
- `display/commands.rs`：Tauri 命令边界，同时维护 Rust 侧显示器真实状态
- `tray.rs`：基于 tray 摘要状态的托盘图标、提示和菜单事件

## 重要说明

- SDR 白电平范围固定为 **80-480 nits**
- 本项目控制的是 **SDR White Level**，不是显示器 OSD 背光亮度
- MCCS 亮度只作为信息展示，不是实际控制路径
- 设置 SDR White Level 依赖未文档化的 Windows 设备信息类型 `0xFFFFFFEE`
- 自定义 SET 结构体中的 `final_value` 必须为 `1`
- 现在会枚举所有支持 HDR 的显示器，即使当前 HDR 处于关闭状态
- `DisplayInfo` 同时区分 `hdr_supported` 和 `hdr_enabled`
- HDR 开关通过 `DISPLAYCONFIG_SET_ADVANCED_COLOR_STATE` 实现
- HDR 开关写入后会短时间轮询显示器状态，确保前端拿到稳定的 HDR 最终状态
- Rust 现在是显示器状态的真实来源，前端只消费命令返回结果，不再主动把显示器状态回推给 Tauri
- tray 现在使用 Rust 侧摘要模型渲染，不再直接依赖完整 `DisplayInfo`
- 标题栏刷新按钮会触发手动重新扫描显示器
- 从托盘显示窗口时，每次都会执行一次静默刷新，不会重复弹出启动提示层
- 通过键盘调节亮度滑块时，现在会真正提交亮度变化，而不只是更新本地预览值
- 全局快捷键可在设置中自定义，亮度步进为 `4%`
- 在亮度滑块区域滚动滚轮会按 `2%` 步进调节亮度
- HDR 关闭时会禁用 SDR 亮度滑块
- 当前界面文案已统一为更直接的用户表达，例如 `HDR On`、`HDR Ready` 和 `No HDR-capable displays found`
- 非阻断失败会显示 5 秒后自动消失的通知条；初始化失败仍然是阻断式错误页面
- `npm test` 现在还会校验 TypeScript/Rust 的 `DisplayInfo` 契约、共享亮度常量和错误文案映射

## 许可证

MIT
