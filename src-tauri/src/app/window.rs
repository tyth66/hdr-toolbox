use crate::app::AppState;
use tauri::{App, Manager, WindowEvent};

#[cfg(target_os = "windows")]
use window_vibrancy::apply_mica;

pub fn configure_main_window(app: &mut App) {
    #[cfg(target_os = "windows")]
    {
        if let Some(window) = app.get_webview_window("main") {
            if let Err(e) = apply_mica(&window, Some(true)) {
                tracing::warn!("Failed to apply Mica backdrop: {}", e);
            } else {
                tracing::info!("Mica backdrop applied successfully");
            }

            let win_handle = window.clone();
            let app_handle = app.app_handle().clone();
            window.on_window_event(move |event| {
                if let WindowEvent::Focused(false) = event {
                    if let Some(state) = app_handle.try_state::<AppState>() {
                        let startup_active =
                            state.startup_info_active.lock().map(|g| *g).unwrap_or(false);
                        let dragging = state.is_dragging.lock().map(|g| *g).unwrap_or(false);

                        if startup_active || dragging {
                            tracing::info!(
                                "Window lost focus but startup/dragging active, skipping hide"
                            );
                            return;
                        }
                    }

                    tracing::info!("Window lost focus, hiding...");
                    let _ = win_handle.hide();
                }
            });
        }
    }
}
