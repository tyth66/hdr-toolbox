//! System tray management for HDR Toolbox.

use crate::AppState;
use tauri::{
    image::Image,
    menu::{Menu, MenuBuilder, MenuItem, PredefinedMenuItem},
    tray::{MouseButton, MouseButtonState, TrayIcon, TrayIconBuilder, TrayIconEvent},
    AppHandle, Emitter, Manager,
};

pub const TRAY_ID: &str = "main-tray";

/// Build the full tray menu including dynamic device list.
/// Returns the Menu along with owned MenuItems to avoid lifetime issues.
fn build_full_menu(app: &AppHandle, displays: Vec<crate::DisplayInfo>) -> Result<Menu<tauri::Wry>, tauri::Error> {
    if displays.is_empty() {
        // Still include Quit button so the menu is interactive even without HDR displays
        let no_display = MenuItem::with_id(app, "no-display", "No HDR displays", false, None::<&str>)
            .map_err(|e| {
                tracing::error!("Failed to create no-display menu item: {}", e);
                e
            })?;
        let quit_item = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)
            .map_err(|e| {
                tracing::error!("Failed to create quit menu item: {}", e);
                e
            })?;
        // Use MenuBuilder to avoid lifetime issues with trait objects
        let menu = MenuBuilder::new(app)
            .item(&no_display)
            .item(&quit_item)
            .build()?;
        return Ok(menu);
    }

    // Build menu items - store them in a Vec to extend their lifetime
    // All items must be kept alive for the Menu to own them
    let mut owned_items: Vec<MenuItem<tauri::Wry>> = Vec::new();
    
    // Build device items
    for (i, d) in displays.iter().enumerate() {
        let label = format!("{} ({} nits)", d.name, d.nits);
        match MenuItem::with_id(app, &format!("display-{}", i), &label, true, None::<&str>) {
            Ok(item) => owned_items.push(item),
            Err(e) => {
                tracing::error!("Failed to create menu item for display {}: {}", i, e);
                // Continue with other items instead of failing completely
            }
        }
    }

    // Add separator and Quit button
    let separator = PredefinedMenuItem::separator(app).map_err(|e| {
        tracing::error!("Failed to create separator: {}", e);
        e
    })?;
    
    let quit_item = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)
        .map_err(|e| {
            tracing::error!("Failed to create quit menu item: {}", e);
            e
        })?;

    // Build menu using MenuBuilder to properly own all items
    let mut menu_builder = MenuBuilder::new(app);
    for item in &owned_items {
        menu_builder = menu_builder.item(item);
    }
    menu_builder = menu_builder.item(&separator).item(&quit_item);
    
    menu_builder.build()
}

/// Update the tray tooltip to show display info.
pub fn update_tray_tooltip(app: &AppHandle) {
    if let Some(tray) = app.tray_by_id(TRAY_ID) {
        let state = app.state::<AppState>();
        let displays = match state.displays.lock() {
            Ok(guard) => guard,
            Err(e) => {
                tracing::error!("Failed to lock displays mutex for tooltip: {}", e);
                return;
            }
        };

        let tooltip = if displays.is_empty() {
            "HDR Toolbox - No HDR displays".to_string()
        } else if displays.len() == 1 {
            format!(
                "HDR Toolbox - {}: {} nits",
                displays[0].name, displays[0].nits
            )
        } else {
            format!("HDR Toolbox - {} displays", displays.len())
        };

        let _ = tray.set_tooltip(Some(&tooltip));
    }
}

/// Rebuild and set the tray menu with current display list.
/// Must be called BEFORE right-click so the menu is ready to show.
/// Called from update_displays_and_tooltip after displays are loaded.
pub fn update_tray_menu(app: &AppHandle) {
    let tray = match app.tray_by_id(TRAY_ID) {
        Some(t) => t,
        None => return,
    };

    let (display_count, displays) = {
        let state = app.state::<AppState>();
        let lock_result = state.displays.lock();
        match lock_result {
            Ok(guard) => (guard.len(), guard.clone()),
            Err(e) => {
                tracing::error!("Failed to lock displays mutex: {}", e);
                (0, Vec::new())
            }
        }
    };

    match build_full_menu(app, displays) {
        Ok(menu) => {
            if let Err(e) = tray.set_menu(Some(menu)) {
                tracing::error!("Failed to set tray menu: {}", e);
            } else {
                tracing::info!("Tray menu updated with {} displays", display_count);
            }
        }
        Err(e) => {
            tracing::error!("Failed to build tray menu: {}", e);
        }
    }
}

/// Handle tray icon click events.
pub fn handle_tray_click(app: &AppHandle, event: TrayIconEvent) {
    match event {
        TrayIconEvent::Click {
            button: MouseButton::Left,
            button_state: MouseButtonState::Up,
            ..
        } => {
            tracing::info!("Tray left-click: toggling window");
            // Left click: show/hide the brightness slider window
            if let Some(window) = app.get_webview_window("main") {
                if window.is_visible().unwrap_or(false) {
                    let _ = window.hide();
                } else {
                    // Emit event to let JS handle positioning
                    let _ = app.emit("show-window", ());
                }
            }
        }
        // Right-click: menu is already set via update_tray_menu() before this fires.
        // Windows automatically shows the menu that was set via set_menu.
        // Do NOT call set_menu here — it must be done BEFORE right-click.
        TrayIconEvent::Click {
            button: MouseButton::Right,
            button_state: MouseButtonState::Up,
            ..
        } => {
            tracing::info!("Tray right-click: menu already set, system will show it");
        }
        _ => {}
    }
}

/// Handle menu item clicks from the tray.
pub fn handle_menu_event(app: &AppHandle, event: tauri::menu::MenuEvent) {
    match event.id().as_ref() {
        id if id.starts_with("display-") => {
            // Device selection: switch to that display in the UI
            if let Some(idx_str) = id.strip_prefix("display-") {
                if let Ok(idx) = idx_str.parse::<usize>() {
                    let _ = app.emit("select-display", idx);
                    // Emit event to show window - JS will handle positioning
                    let _ = app.emit("show-window", ());
                } else {
                    tracing::warn!("Failed to parse display index from menu id: {}", id);
                }
            }
        }
        "quit" => {
            // Exit the application immediately
            tracing::info!("Quit menu item clicked, exiting...");
            app.exit(0);
        }
        _ => {}
    }
}

/// Get the tray icon's bounding rectangle (screen coordinates).
/// Returns {x, y, width, height} or null if tray not available.
pub fn get_tray_rect(app: &AppHandle) -> Option<tauri::Rect> {
    let tray = app.tray_by_id(TRAY_ID)?;
    tracing::info!("Tray found, getting rect...");
    let rect = tray.rect().ok().flatten();
    if let Some(r) = rect {
        tracing::info!("Tray rect: pos=({:?}), size={:?}", r.position, r.size);
    } else {
        tracing::info!("Tray rect is None");
    }
    rect
}

/// Setup the system tray.
pub fn setup_tray(app: &AppHandle) -> Result<TrayIcon, tauri::Error> {
    let icon_bytes = include_bytes!("../icons/fluent@1x.png");
    let icon = Image::from_bytes(icon_bytes)
        .map_err(|e| {
            tracing::error!("Failed to load tray icon: {}", e);
            e
        })?;
    
    let tray = TrayIconBuilder::with_id(TRAY_ID)
        .tooltip("HDR Toolbox")
        .icon(icon)
        .show_menu_on_left_click(false)
        .on_tray_icon_event(|tray, event| {
            handle_tray_click(tray.app_handle(), event);
        })
        .on_menu_event(|app, event| {
            handle_menu_event(app, event);
        })
        .build(app)?;

    Ok(tray)
}
