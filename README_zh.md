# HDR Toolbox

一个轻量级 Windows 托盘工具，用于调节 HDR 显示器的 SDR 内容亮度，基于 **Rust + Tauri 2 + React** 构建。

## 功能

- 托盘常驻
- 左键托盘图标显示或隐藏亮度窗口
- 右键托盘图标打开动态设备菜单
- 全局快捷键：`Ctrl+Alt+Up` / `Ctrl+Alt+Down`
- 支持多台 HDR 显示器独立调节
- 设置中可切换开机自启
- 拖动滑块时实时应用亮度
- 鼠标悬停在亮度条上时可通过滚轮调节亮度
- 标题栏在设置按钮旁提供手动刷新按钮
- 从托盘显示窗口时，每次都会静默刷新一次显示器状态
- 非阻断错误会通过自动消失的通知条提示

## 系统要求

- Windows 10/11
- 支持 HDR 的显示器
- 已在 Windows 设置中启用 HDR

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
|- components/
|- hooks/
|- services/
|- types.ts
|- types.test.ts
'- hooks/displayState.test.ts
```

- `App.tsx`：组合层
- `components/`：纯展示组件
- `hooks/`：显示器状态、快捷键、窗口定位、启动提示
- `services/tauriApi.ts`：Rust 命令的类型化封装
- `*.test.ts`：前端纯逻辑测试

### 后端

```text
src-tauri/src/
|- lib.rs
|- tray.rs
'- display/
   |- model.rs
   |- ffi.rs
   |- service.rs
   '- commands.rs
```

- `display/ffi.rs`：原始 Windows DisplayConfig / MCCS 调用
- `display/service.rs`：HDR 枚举、失败状态逻辑与亮度业务逻辑
- `display/commands.rs`：Tauri 命令边界
- `tray.rs`：托盘图标、提示和菜单事件

## 重要说明

- SDR 白电平范围固定为 **80-480 nits**
- 本项目控制的是 **SDR White Level**，不是显示器 OSD 背光亮度
- MCCS 亮度只作为信息展示，不是实际控制路径
- 设置 SDR White Level 依赖未文档化的 Windows 设备信息类型 `0xFFFFFFEE`
- 自定义 SET 结构体中的 `final_value` 必须为 `1`
- 标题栏刷新按钮会触发手动重新扫描显示器
- 从托盘显示窗口时，每次都会执行一次静默刷新，不会重复弹出启动提示层
- 在亮度滑块区域滚动滚轮会按 `5%` 步进调节亮度
- 非阻断失败会显示 5 秒后自动消失的通知条；初始化失败仍然是阻断式错误页面

## 许可证

MIT
