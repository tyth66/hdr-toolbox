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
    /// Whether startup info overlay is showing — prevents blur-to-hide
    pub startup_info_active: Mutex<bool>,
    /// Whether window is being dragged — prevents blur-to-hide during drag
    pub is_dragging: Mutex<bool>,
}

impl Default for AppState {
    fn default() -> Self {
        Self {
            displays: Mutex::new(Vec::new()),
            startup_info_active: Mutex::new(false),
            is_dragging: Mutex::new(false),
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
        let mut cached = match state.displays.lock() {
            Ok(guard) => guard,
            Err(e) => {
                tracing::error!("Failed to lock displays mutex (poisoned): {}", e);
                return;
            }
        };
        *cached = displays;
    }
    // Update tray tooltip and rebuild menu with fresh device list
    tray::update_tray_tooltip(&app);
    tray::update_tray_menu(&app);
}

/// Get cached displays for tray menu (avoids async call in menu context).
#[tauri::command]
fn get_cached_displays(state: State<AppState>) -> Vec<DisplayInfo> {
    match state.displays.lock() {
        Ok(guard) => guard.clone(),
        Err(e) => {
            tracing::error!("Failed to lock displays mutex (poisoned): {}", e);
            Vec::new()
        }
    }
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

/// Set whether startup info overlay is active (prevents blur-to-hide).
#[tauri::command]
fn set_startup_info_mode(state: State<AppState>, active: bool) {
    let mut flag = match state.startup_info_active.lock() {
        Ok(guard) => guard,
        Err(e) => {
            tracing::error!("Failed to lock startup_info_active mutex (poisoned): {}", e);
            return;
        }
    };
    *flag = active;
    tracing::info!("Startup info mode: {}", active);
}

/// Set whether window is being dragged (prevents blur-to-hide during drag).
#[tauri::command]
fn set_dragging_mode(state: State<AppState>, active: bool) {
    let mut flag = match state.is_dragging.lock() {
        Ok(guard) => guard,
        Err(e) => {
            tracing::error!("Failed to lock is_dragging mutex (poisoned): {}", e);
            return;
        }
    };
    *flag = active;
    tracing::info!("Dragging mode: {}", active);
}

/// Exit the application immediately (bypasses window close-to-hide handler).
#[tauri::command]
fn quit(app: AppHandle) {
    app.exit(0);
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
            set_startup_info_mode,
            set_dragging_mode,
            quit,
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
                    // Listen for window focus loss to auto-hide (blur-to-hide)
                    let win_handle = window.clone();
                    let app_handle = app.app_handle().clone();
                    window.on_window_event(move |event| {
                        if let tauri::WindowEvent::Focused(false) = event {
                            // Check if startup info is showing — skip hide if so
                            if let Some(state) = app_handle.try_state::<AppState>() {
                                let startup_active = state.startup_info_active.lock()
                                    .map(|g| *g)
                                    .unwrap_or(false);
                                let dragging = state.is_dragging.lock()
                                    .map(|g| *g)
                                    .unwrap_or(false);
                                if startup_active || dragging {
                                    tracing::info!("Window lost focus but startup/dragging active, skipping hide");
                                    return;
                                }
                            }
                            tracing::info!("Window lost focus, hiding...");
                            let _ = win_handle.hide();
                        }
                    });
                }
            }

            tracing::info!("Setup complete!");
            Ok(())
        })
        .run(tauri::generate_context!())
        .unwrap_or_else(|e| {
            tracing::error!("Failed to run Tauri application: {}", e);
            std::process::exit(1);
        });
}
