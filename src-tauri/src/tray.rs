//! System tray management for HDR Toolbox.

use crate::AppState;
use tauri::{
    image::Image,
    menu::{Menu, MenuItem, PredefinedMenuItem},
    tray::{MouseButton, MouseButtonState, TrayIcon, TrayIconBuilder, TrayIconEvent},
    AppHandle, Emitter, Manager,
};

pub const TRAY_ID: &str = "main-tray";

/// Build a static menu (About, Autostart, Quit).
fn build_static_menu(app: &AppHandle) -> Result<Menu<tauri::Wry>, tauri::Error> {
    let auto_start_item = MenuItem::with_id(
        app,
        "autostart",
        "Auto-start with Windows",
        true,
        None::<&str>,
    )?;
    let about_item = MenuItem::with_id(app, "about", "About", true, None::<&str>)?;
    let quit_item = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;

    Menu::with_items(
        app,
        &[
            &auto_start_item as &dyn tauri::menu::IsMenuItem<tauri::Wry>,
            &PredefinedMenuItem::separator(app)? as &dyn tauri::menu::IsMenuItem<tauri::Wry>,
            &about_item as &dyn tauri::menu::IsMenuItem<tauri::Wry>,
            &quit_item as &dyn tauri::menu::IsMenuItem<tauri::Wry>,
        ],
    )
}

/// Build the full tray menu including dynamic device list.
fn build_full_menu(app: &AppHandle) -> Result<Menu<tauri::Wry>, tauri::Error> {
    let state = app.state::<AppState>();
    let displays = state.displays.lock().unwrap();

    if displays.is_empty() {
        let no_display =
            MenuItem::with_id(app, "no-display", "No HDR displays", false, None::<&str>)?;
        return Menu::with_items(
            app,
            &[&no_display as &dyn tauri::menu::IsMenuItem<tauri::Wry>],
        );
    }

    // Build device items
    let device_items: Vec<MenuItem<tauri::Wry>> = displays
        .iter()
        .enumerate()
        .map(|(i, d)| {
            let label = format!("{} ({} nits)", d.name, d.nits);
            MenuItem::with_id(app, &format!("display-{}", i), &label, true, None::<&str>).unwrap()
        })
        .collect();

    let auto_start_item = MenuItem::with_id(
        app,
        "autostart",
        "Auto-start with Windows",
        true,
        None::<&str>,
    )?;
    let about_item = MenuItem::with_id(app, "about", "About", true, None::<&str>)?;
    let quit_item = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
    let sep1 = PredefinedMenuItem::separator(app)?;
    let sep2 = PredefinedMenuItem::separator(app)?;

    // Build combined list of trait objects
    let mut all_items: Vec<&dyn tauri::menu::IsMenuItem<tauri::Wry>> = Vec::new();
    for item in &device_items {
        all_items.push(item as &dyn tauri::menu::IsMenuItem<tauri::Wry>);
    }
    all_items.push(&sep1 as &dyn tauri::menu::IsMenuItem<tauri::Wry>);
    all_items.push(&auto_start_item as &dyn tauri::menu::IsMenuItem<tauri::Wry>);
    all_items.push(&sep2 as &dyn tauri::menu::IsMenuItem<tauri::Wry>);
    all_items.push(&about_item as &dyn tauri::menu::IsMenuItem<tauri::Wry>);
    all_items.push(&quit_item as &dyn tauri::menu::IsMenuItem<tauri::Wry>);

    Menu::with_items(app, &all_items)
}

/// Update the tray tooltip to show display info.
pub fn update_tray_tooltip(app: &AppHandle) {
    if let Some(tray) = app.tray_by_id(TRAY_ID) {
        let state = app.state::<AppState>();
        let displays = state.displays.lock().unwrap();

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

    let display_count: usize = {
        let state = app.state::<AppState>();
        let guard = state.displays.lock().unwrap();
        guard.len()
    };

    match build_full_menu(app) {
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
            if let Ok(idx) = id.strip_prefix("display-").unwrap().parse::<usize>() {
                let _ = app.emit("select-display", idx);
                // Emit event to show window - JS will handle positioning
                let _ = app.emit("show-window", ());
            }
        }
        "autostart" => {
            let _ = app.emit("toggle-autostart", ());
        }
        "about" => {
            let _ = app.emit("show-about", ());
            let _ = app.emit("show-window", ());
        }
        "quit" => {
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
    let tray = TrayIconBuilder::with_id(TRAY_ID)
        .tooltip("HDR Toolbox")
        .icon(Image::from_bytes(include_bytes!("../icons/fluent@1x.png")).unwrap())
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
