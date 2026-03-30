use crate::{app::{AppState, TrayState}, tray};
use super::model::DisplayInfo;
use super::service::{
    get_hdr_displays_after_toggle_impl, get_hdr_displays_impl, set_brightness_all_impl,
    set_brightness_impl, set_hdr_enabled_impl,
};
use tauri::{AppHandle, State};

fn replace_cached_displays(state: &State<AppState>, displays: Vec<DisplayInfo>) -> Vec<DisplayInfo> {
    let tray_state = TrayState::from_displays(&displays);

    if let Ok(mut guard) = state.displays.lock() {
        *guard = displays.clone();
    } else {
        tracing::error!("Failed to lock displays mutex (poisoned)");
    }

    if let Ok(mut guard) = state.tray_state.lock() {
        *guard = tray_state;
    } else {
        tracing::error!("Failed to lock tray_state mutex (poisoned)");
    }

    displays
}

fn update_tray_state(app: &AppHandle) {
    tray::update_tray_tooltip(app);
    tray::update_tray_menu(app);
}

#[tauri::command]
pub fn get_hdr_displays(app: AppHandle, state: State<AppState>) -> Result<Vec<DisplayInfo>, String> {
    match get_hdr_displays_impl() {
        Ok(displays) => {
            let displays = replace_cached_displays(&state, displays);
            update_tray_state(&app);
            Ok(displays)
        }
        Err(err) => {
            replace_cached_displays(&state, Vec::new());
            update_tray_state(&app);
            Err(err)
        }
    }
}

#[tauri::command]
pub fn set_brightness(
    app: AppHandle,
    state: State<AppState>,
    adapter_low: i32,
    adapter_high: i32,
    target_id: u32,
    percentage: u32,
    min_nits: u32,
    max_nits: u32,
) -> Result<Vec<DisplayInfo>, String> {
    set_brightness_impl(
        adapter_low,
        adapter_high,
        target_id,
        percentage,
        min_nits,
        max_nits,
    )?;

    let updated_nits = super::service::percentage_to_nits_public(percentage, min_nits, max_nits);
    let displays = match state.displays.lock() {
        Ok(mut guard) => {
            if let Some(display) = guard.iter_mut().find(|display| {
                display.adapter_id_low == adapter_low
                    && display.adapter_id_high == adapter_high
                    && display.target_id == target_id
            }) {
                display.nits = updated_nits;
            }
            let updated_displays = guard.clone();

            if let Ok(mut tray_guard) = state.tray_state.lock() {
                *tray_guard = TrayState::from_displays(&updated_displays);
            } else {
                tracing::error!("Failed to lock tray_state mutex (poisoned)");
            }

            updated_displays
        }
        Err(e) => {
            tracing::error!("Failed to lock displays mutex (poisoned): {}", e);
            Vec::new()
        }
    };

    update_tray_state(&app);
    Ok(displays)
}

#[tauri::command]
pub fn set_brightness_all(
    app: AppHandle,
    state: State<AppState>,
    displays: Vec<DisplayInfo>,
    percentage: u32,
) -> Vec<Result<(), String>> {
    let original_displays = displays.clone();
    let results = set_brightness_all_impl(displays, percentage);

    let updated_state = match state.displays.lock() {
        Ok(mut guard) => {
            for (display, result) in original_displays.iter().zip(results.iter()) {
                if result.is_err() {
                    continue;
                }

                let updated_nits = super::service::percentage_to_nits_public(
                    percentage,
                    display.min_nits.unwrap_or(80),
                    display.max_nits.unwrap_or(480),
                );

                if let Some(cached_display) = guard.iter_mut().find(|cached| {
                    cached.adapter_id_low == display.adapter_id_low
                        && cached.adapter_id_high == display.adapter_id_high
                        && cached.target_id == display.target_id
                }) {
                    cached_display.nits = updated_nits;
                }
            }

            let updated_displays = guard.clone();
            if let Ok(mut tray_guard) = state.tray_state.lock() {
                *tray_guard = TrayState::from_displays(&updated_displays);
            } else {
                tracing::error!("Failed to lock tray_state mutex (poisoned)");
            }

            true
        }
        Err(e) => {
            tracing::error!("Failed to lock displays mutex (poisoned): {}", e);
            false
        }
    };

    if updated_state {
        update_tray_state(&app);
    }

    results
}

#[tauri::command]
pub fn set_hdr_enabled(
    app: AppHandle,
    state: State<AppState>,
    adapter_low: i32,
    adapter_high: i32,
    target_id: u32,
    enabled: bool,
) -> Result<Vec<DisplayInfo>, String> {
    set_hdr_enabled_impl(adapter_low, adapter_high, target_id, enabled)?;

    match get_hdr_displays_after_toggle_impl(adapter_low, adapter_high, target_id, enabled) {
        Ok(displays) => {
            let displays = replace_cached_displays(&state, displays);
            update_tray_state(&app);
            Ok(displays)
        }
        Err(err) => {
            replace_cached_displays(&state, Vec::new());
            update_tray_state(&app);
            Err(err)
        }
    }
}
