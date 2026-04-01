use crate::{app::{AppState, TrayState}, display::DisplayError, tray};
use super::model::DisplayInfo;
use super::service::{
    get_hdr_displays_after_toggle_impl, get_hdr_displays_impl, set_brightness_all_impl,
    set_brightness_impl, set_hdr_enabled_impl,
};
use tauri::{AppHandle, State};

/// Replaces cached displays and updates tray state.
/// 
/// Note: If a mutex is poisoned (due to a previous panic in a critical section),
/// we log a critical error and continue with stale cached state. The next
/// successful display refresh will correct the state. This is a tradeoff between
/// availability and consistency - we prefer to keep the app running rather than
/// crashing on recoverable poison errors.
fn replace_cached_displays(state: &State<AppState>, displays: Vec<DisplayInfo>) -> Vec<DisplayInfo> {
    let tray_state = TrayState::from_displays(&displays);

    if let Ok(mut guard) = state.displays.lock() {
        *guard = displays.clone();
    } else {
        // Poison indicates a previous panic held the lock. We cannot recover the
        // lock without potentially deadlocking. Continue with stale cached state;
        // next get_hdr_displays call will refresh from hardware.
        tracing::error!(
            "[CRITICAL] Display state mutex is poisoned. Cached state may be stale. \
            HDR operations will continue but tray tooltip may show outdated info."
        );
    }

    if let Ok(mut guard) = state.tray_state.lock() {
        *guard = tray_state;
    } else {
        tracing::error!(
            "[CRITICAL] Tray state mutex is poisoned. Tray menu may show stale display info. \
            Right-click tray to see current state."
        );
    }

    displays
}

fn update_tray_state(app: &AppHandle) {
    tray::update_tray_tooltip(app);
    tray::update_tray_menu(app);
}

/// Convert a String error to a structured DisplayError based on error content.
fn map_string_to_display_error(err: String) -> DisplayError {
    let lower = err.to_lowercase();
    if lower.contains("no hdr-capable displays found") || lower.contains("no hdr displays found") {
        DisplayError::no_hdr_displays()
    } else if lower.contains("no display paths found") {
        DisplayError::no_display_paths()
    } else if lower.contains("getdisplayconfigbuffersizes failed") 
        || lower.contains("querydisplayconfig failed")
        || lower.contains("displayconfiggetdeviceinfo failed")
        || lower.contains("displayconfigsetdeviceinfo failed")
    {
        DisplayError::api_failed(&err)
    } else if lower.contains("sdr white level") || lower.contains("set_sdr_white_level") {
        DisplayError::sdr_white_level_failed(&err)
    } else if lower.contains("hdr") && (lower.contains("toggle") || lower.contains("set_advanced_color")) {
        DisplayError::hdr_toggle_failed(&err)
    } else if lower.contains("polling timed out") || lower.contains("hdr state polling") {
        DisplayError::hdr_polling_timeout()
    } else if lower.contains("brightness") {
        DisplayError::brightness_failed(&err)
    } else if lower.contains("display not found") || lower.contains("adapter") {
        DisplayError::invalid_adapter()
    } else {
        DisplayError::api_failed(&err)
    }
}

#[tauri::command]
pub fn get_hdr_displays(app: AppHandle, state: State<AppState>) -> Result<Vec<DisplayInfo>, DisplayError> {
    match get_hdr_displays_impl() {
        Ok(displays) => {
            let displays = replace_cached_displays(&state, displays);
            update_tray_state(&app);
            Ok(displays)
        }
        Err(err) => {
            replace_cached_displays(&state, Vec::new());
            update_tray_state(&app);
            Err(map_string_to_display_error(err))
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
) -> Result<Vec<DisplayInfo>, DisplayError> {
    if let Err(err) = set_brightness_impl(
        adapter_low,
        adapter_high,
        target_id,
        percentage,
        min_nits,
        max_nits,
    ) {
        return Err(map_string_to_display_error(err));
    }

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
                tracing::error!("[CRITICAL] Tray state mutex poisoned after brightness set. Tray may show stale nits.");
            }

            updated_displays
        }
        Err(e) => {
            // Cannot update display nits in cache. Brightness WAS set on hardware,
            // but UI may show stale value until next refresh.
            tracing::error!(
                "[CRITICAL] Display mutex poisoned during brightness update. Hardware brightness set, \
                but UI cache may be stale: {}",
                e
            );
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
) -> Vec<Result<(), DisplayError>> {
    let original_displays = displays.clone();
    let results = set_brightness_all_impl(displays, percentage);

    // Convert String errors to DisplayError
    let results: Vec<Result<(), DisplayError>> = results
        .into_iter()
        .map(|r| r.map_err(|e| map_string_to_display_error(e)))
        .collect();

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
                tracing::error!("[CRITICAL] Tray state mutex poisoned during brightness_all update.");
            }

            true
        }
        Err(e) => {
            tracing::error!(
                "[CRITICAL] Display mutex poisoned during brightness_all. Hardware brightness set, \
                but UI cache may be stale: {}",
                e
            );
            false
        }
    };

    if updated_state {
        update_tray_state(&app);
    }

    // Return converted results
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
) -> Result<Vec<DisplayInfo>, DisplayError> {
    if let Err(err) = set_hdr_enabled_impl(adapter_low, adapter_high, target_id, enabled) {
        return Err(map_string_to_display_error(err));
    }

    match get_hdr_displays_after_toggle_impl(adapter_low, adapter_high, target_id, enabled) {
        Ok(displays) => {
            let displays = replace_cached_displays(&state, displays);
            update_tray_state(&app);
            Ok(displays)
        }
        Err(err) => {
            replace_cached_displays(&state, Vec::new());
            update_tray_state(&app);
            Err(map_string_to_display_error(err))
        }
    }
}
