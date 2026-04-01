//! Tauri library - exposes Rust functions to the frontend.

mod app;
mod display;
mod tray;

use tauri::Manager;

pub use display::{get_hdr_displays, set_brightness, set_brightness_all, set_hdr_enabled, DisplayError};
pub use tray::{setup_tray, update_tray_menu, update_tray_tooltip};

pub fn run() {
    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::from_default_env()
                .add_directive(tracing::Level::INFO.into()),
        )
        .with_target(false)
        .init();

    tracing::info!("HDR Toolbox starting...");

    tauri::Builder::default()
        .manage(app::AppState::default())
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::LaunchAgent,
            Some(vec!["--autostart"]),
        ))
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            // A second instance was started - focus the existing window
            tracing::info!("Second instance detected, focusing existing window");
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.show();
                let _ = window.set_focus();
            }
        }))
        .invoke_handler(tauri::generate_handler![
            get_hdr_displays,
            set_brightness,
            set_brightness_all,
            set_hdr_enabled,
            app::commands::get_tray_rect,
            app::commands::set_startup_info_mode,
            app::commands::set_dragging_mode,
            app::commands::quit,
        ])
        .setup(|app| {
            tracing::info!("Setting up tray icon...");
            setup_tray(app.app_handle())?;
            app::window::configure_main_window(app);
            tracing::info!("Setup complete!");
            Ok(())
        })
        .run(tauri::generate_context!())
        .unwrap_or_else(|e| {
            tracing::error!("Failed to run Tauri application: {}", e);
            std::process::exit(1);
        });
}
