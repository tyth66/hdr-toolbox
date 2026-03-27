//! Tauri library — exposes Rust functions to the frontend.

mod display;
mod tray;

#[cfg(target_os = "windows")]
use window_vibrancy::apply_mica;

use display::DisplayInfo;
use std::sync::Mutex;
use tauri::{AppHandle, Manager, State};

/// Shared app state holding current display list for tray menu access.
pub struct AppState {
    pub displays: Mutex<Vec<DisplayInfo>>,
}

impl Default for AppState {
    fn default() -> Self {
        Self {
            displays: Mutex::new(Vec::new()),
        }
    }
}

pub use display::{get_hdr_displays, set_brightness, set_brightness_all};
pub use tray::{setup_tray, update_tray_menu, update_tray_tooltip};

/// Update cached display list (called from JS after loadDisplays).
/// Also updates tray tooltip and menu to reflect current display state.
#[tauri::command]
fn update_displays_and_tooltip(app: AppHandle, state: State<AppState>, displays: Vec<DisplayInfo>) {
    // Update cached displays
    {
        let mut cached = state.displays.lock().unwrap();
        *cached = displays;
    }
    // Update tray tooltip and rebuild menu with fresh device list
    tray::update_tray_tooltip(&app);
    tray::update_tray_menu(&app);
}

/// Get cached displays for tray menu (avoids async call in menu context).
#[tauri::command]
fn get_cached_displays(state: State<AppState>) -> Vec<DisplayInfo> {
    state.displays.lock().unwrap().clone()
}

/// Update tray tooltip only (without rebuilding menu).
/// Used by hotkey handlers to avoid menu rebuild overhead on frequent brightness changes.
#[tauri::command]
fn update_tray_tooltip_only(app: AppHandle) {
    update_tray_tooltip(&app);
}

/// Get the tray icon's bounding rectangle for positioning windows above it.
#[tauri::command]
fn get_tray_rect(app: AppHandle) -> Option<tauri::Rect> {
    tray::get_tray_rect(&app)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Set up tracing subscriber
    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::from_default_env()
                .add_directive(tracing::Level::INFO.into()),
        )
        .with_target(false)
        .init();

    tracing::info!("HDR Toolbox starting...");

    tauri::Builder::default()
        .manage(AppState::default())
        // Global shortcut plugin - JS side registers shortcuts via @tauri-apps/plugin-global-shortcut
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::LaunchAgent,
            Some(vec!["--autostart"]),
        ))
        .invoke_handler(tauri::generate_handler![
            get_hdr_displays,
            set_brightness,
            set_brightness_all,
            update_displays_and_tooltip,
            get_cached_displays,
            update_tray_tooltip_only,
            get_tray_rect,
        ])
        .setup(|app| {
            tracing::info!("Setting up tray icon...");
            setup_tray(app.app_handle())?;

            // Apply Windows 11 Mica backdrop
            #[cfg(target_os = "windows")]
            {
                if let Some(window) = app.get_webview_window("main") {
                    if let Err(e) = apply_mica(&window, Some(true)) {
                        tracing::warn!("Failed to apply Mica backdrop: {}", e);
                    } else {
                        tracing::info!("Mica backdrop applied successfully");
                    }
                }
            }

            tracing::info!("Setup complete!");
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
