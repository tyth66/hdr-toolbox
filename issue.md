# HDR Toolbox 问题与优化文档

**创建日期:** 2026-03-26
**项目类型:** Rust + Tauri 2 Windows 桌面应用
**用途:** HDR 显示器 SDR 亮度控制

---

## 一、已优化项

### 1.1 已移除 `devtools` 功能

| 项目 | 详情 |
|------|------|
| **位置** | `src-tauri/Cargo.toml:14` |
| **变更前** | `tauri = { version = "2", features = ["tray-icon", "devtools", "image-png"] }` |
| **变更后** | `tauri = { version = "2", features = ["tray-icon", "image-png"] }` |
| **影响** | 二进制体积减少约 5-10MB，WebView2 初始化开销降低 |

**说明:** `devtools` 功能会在 WebView2 中启用开发者工具，即便不打开 DevTools 面板也会产生性能开销。

### 1.2 已移除未使用的 Windows API 功能

| 项目 | 详情 |
|------|------|
| **位置** | `src-tauri/Cargo.toml:29` |
| **变更前** | `"Win32_System_Registry"` |
| **变更后** | 已移除 |
| **影响** | 更小的二进制体积，减少不必要的 Windows API 加载 |

---

## 二、待优化项

### 2.1 高优先级

#### 问题: 快捷键操作触发托盘菜单重建

| 项目 | 详情 |
|------|------|
| **位置** | `src/App.tsx:172-176` |
| **问题描述** | 每次快捷键调整亮度时，调用 `update_displays_and_tooltip`，该命令会调用 `update_tray_tooltip` 和 `update_tray_menu`，导致整个托盘菜单重建 |
| **触发频率** | 用户按住快捷键时可能每秒触发多次 |
| **影响** | 不必要的菜单重建开销 |

**建议修复方案:**
在 Rust 端新增一个仅更新 tooltip 的命令 `update_tray_tooltip_only`，不重建菜单。

```rust
#[tauri::command]
fn update_tray_tooltip_only(app: AppHandle, state: State<AppState>, nits: u32) {
    update_tray_tooltip(&app);
}
```

---

#### 问题: 滑块防抖延迟过高

| 项目 | 详情 |
|------|------|
| **位置** | `src/App.tsx:37` |
| **当前值** | `100ms` |
| **问题描述** | 用户拖动滑块时，亮度更新有 100ms 延迟，影响实时体验 |

**建议:** 将防抖时间降至 `50ms` 或 `30ms`，在 `handleSliderCommit`（释放滑块时）确保最终值被应用。

---

### 2.2 中优先级

#### 问题: Vite 无生产环境分包策略

| 项目 | 详情 |
|------|------|
| **位置** | `vite.config.ts` |
| **问题描述** | 所有前端代码打包到单个 bundle，无代码分割 |
| **影响** | 首屏加载时间、缓存粒度 |

**建议优化:**

```ts
export default defineConfig({
  plugins: [react()],
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    watch: {
      ignored: ["**/src-tauri/**"],
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor': ['react', 'react-dom'],
          'tauri': ['@tauri-apps/api/core', '@tauri-apps/api/event'],
        },
      },
    },
  },
});
```

---

#### 问题: Release 优化级别可进一步调整

| 项目 | 详情 |
|------|------|
| **位置** | `src-tauri/Cargo.toml:37` |
| **当前值** | `opt-level = "s"` |
| **选项对比** | `"s"` 优化体积优先，`"z"` 更激进体积优化 |

**说明:** 切换到 `"z"` 可能减少约 5-10% 二进制体积，但编译时间可能增加。当前设置已属合理，此为可选优化。

---

### 2.3 低优先级

#### 潜在优化: `tracing` 替换为 `log`

| 项目 | 详情 |
|------|------|
| **位置** | `src-tauri/Cargo.toml:19-20` |
| **当前依赖** | `tracing` + `tracing-subscriber` |
| **替代方案** | `log` + `env_logger` 或 `simplelog` |
| **影响** | `tracing` 生态更丰富但体积更大 |

**说明:** 当前 `tracing` 使用较为简单，仅用于 INFO 级别日志。替换收益有限，暂不推荐。

---

## 三、架构观察

### 3.1 设计良好的部分

| 项目 | 说明 |
|------|------|
| 错误处理 | 统一使用 `Result<T, String>`，无 `anyhow`/`thiserror` 依赖 |
| 状态管理 | `AppState` Mutex 锁持有时间短，无竞争问题 |
| React 架构 | 纯 hooks 实现，无不必要的重渲染 |
| IPC 设计 | Tauri 命令设计简洁，payload 体积小 |
| Release 优化 | `lto = true`, `codegen-units = 1` 配置正确 |

### 3.2 可改进的架构部分

| 项目 | 说明 |
|------|------|
| `hotkey.rs` | 仅包含未使用的 `format_shortcut()` 函数，属于死代码 |
| 命令拆分 | `update_displays_and_tooltip` 职责过多，可考虑拆分为独立命令 |

---

## 四、死代码

| 文件 | 内容 | 建议 |
|------|------|------|
| `src-tauri/src/hotkey.rs` | `format_shortcut()` 函数从未被调用 | 可安全删除整文件 |

---

## 五、测试建议

项目目前无测试文件。如需添加测试，建议覆盖:

| 优先级 | 测试场景 |
|--------|----------|
| 高 | `DisplayInfo::nits_to_api_value` / `api_value_to_nits` 转换逻辑 |
| 高 | 亮度值 clamp 逻辑 (80-480, 4的倍数) |
| 中 | `get_hdr_displays` 空数组错误处理 |
| 中 | `set_brightness_all` 多显示器广播 |

---

## 六、依赖版本

| 依赖 | 当前版本 | 建议 |
|------|----------|------|
| `tauri` | 2.x | 关注 Tauri 2.x 后续更新 |
| `windows` | 0.62 | 可关注 0.63+ 更新 |
| `once_cell` | 1.x | Rust 1.79+ 可替换为 std::sync::Lazy（收益低，暂不推荐） |

---

## 七、编译验证

任何配置修改后，执行以下命令验证:

```bash
# Rust 检查
cd src-tauri && cargo check

# 完整构建
npm run tauri build
```

---

*文档维护: 每次重大变更后更新此文档*
