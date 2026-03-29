use crate::{app::AppState, tray};
use tauri::{AppHandle, State};

/// Get the tray icon's bounding rectangle for positioning windows above it.
#[tauri::command]
pub fn get_tray_rect(app: AppHandle) -> Option<tauri::Rect> {
    tray::get_tray_rect(&app)
}

/// Set whether startup info overlay is active (prevents blur-to-hide).
#[tauri::command]
pub fn set_startup_info_mode(state: State<AppState>, active: bool) {
    let mut flag = match state.startup_info_active.lock() {
        Ok(guard) => guard,
        Err(e) => {
            tracing::error!(
                "Failed to lock startup_info_active mutex (poisoned): {}",
                e
            );
            return;
        }
    };
    *flag = active;
    tracing::info!("Startup info mode: {}", active);
}

/// Set whether window is being dragged (prevents blur-to-hide during drag).
#[tauri::command]
pub fn set_dragging_mode(state: State<AppState>, active: bool) {
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
pub fn quit(app: AppHandle) {
    app.exit(0);
}
