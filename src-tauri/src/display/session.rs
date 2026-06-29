use super::model::{BrightnessSource, DisplayInfo};
use crate::{
    app::{AppState, TrayState},
    tray,
};
use tauri::AppHandle;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(super) struct DisplayTarget {
    adapter_low: i32,
    adapter_high: i32,
    target_id: u32,
}

impl DisplayTarget {
    pub(super) fn new(adapter_low: i32, adapter_high: i32, target_id: u32) -> Self {
        Self {
            adapter_low,
            adapter_high,
            target_id,
        }
    }

    pub(super) fn matches(self, display: &DisplayInfo) -> bool {
        display.adapter_id_low == self.adapter_low
            && display.adapter_id_high == self.adapter_high
            && display.target_id == self.target_id
    }
}

/// Replaces cached displays and updates tray summary state.
///
/// Poisoned mutexes are logged and treated as recoverable because the next
/// successful hardware refresh can repair stale app state.
/// Flips brightness_source between HdrSdr and ddc_source when HDR is toggled.
/// Returns the updated display list for the frontend.
pub(super) fn flip_hdr_source_in_cache(
    app: &AppHandle,
    state: &AppState,
    target: DisplayTarget,
    hdr_enabled: bool,
) -> Result<Vec<DisplayInfo>, crate::display::DisplayError> {
    match state.displays.lock() {
        Ok(mut guard) => {
            let display = guard
                .iter_mut()
                .find(|d| target.matches(d))
                .ok_or_else(crate::display::DisplayError::display_not_found)?;

            if hdr_enabled {
                // HDR turned ON: restore HdrSdr, save current source as ddc_source
                if display.ddc_source.is_some() || display.brightness_source != BrightnessSource::HdrSdr {
                    let current = display.brightness_source;
                    display.brightness_source = BrightnessSource::HdrSdr;
                    display.ddc_source = Some(current);
                }
            } else {
                // HDR turned OFF: switch to ddc_source if available
                if let Some(ddc) = display.ddc_source.take() {
                    display.brightness_source = ddc;
                    display.ddc_source = Some(BrightnessSource::HdrSdr);
                }
                // If no ddc_source, slider will be disabled by frontend
            }
            display.hdr_enabled = hdr_enabled;

            let displays = guard.clone();
            drop(guard);
            sync_tray_from_display_guard(state, &displays);
            refresh_tray(app);
            Ok(displays)
        }
        Err(poisoned) => {
            tracing::error!(
                "[CRITICAL] Display mutex poisoned during HDR toggle: {}",
                poisoned
            );
            let mut guard = poisoned.into_inner();
            if let Some(display) = guard.iter_mut().find(|d| target.matches(d)) {
                if hdr_enabled && display.ddc_source.is_some() {
                    let current = display.brightness_source;
                    display.brightness_source = BrightnessSource::HdrSdr;
                    display.ddc_source = Some(current);
                } else if !hdr_enabled {
                    if let Some(ddc) = display.ddc_source.take() {
                        display.brightness_source = ddc;
                        display.ddc_source = Some(BrightnessSource::HdrSdr);
                    }
                }
                display.hdr_enabled = hdr_enabled;
            }
            let displays = guard.clone();
            drop(guard);
            sync_tray_from_display_guard(state, &displays);
            refresh_tray(app);
            Ok(displays)
        }
    }
}
pub(super) fn replace_cached_displays(
    state: &AppState,
    displays: Vec<DisplayInfo>,
) -> Vec<DisplayInfo> {
    let tray_state = TrayState::from_displays(&displays);

    if let Ok(mut guard) = state.displays.lock() {
        *guard = displays.clone();
    } else {
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

pub(super) fn update_cached_brightness(
    state: &AppState,
    target: DisplayTarget,
    percentage: u32,
) -> Vec<DisplayInfo> {
    match state.displays.lock() {
        Ok(mut guard) => {
            update_display_brightness(&mut guard, target, percentage);
            sync_tray_from_display_guard(state, &guard)
        }
        Err(poisoned) => {
            tracing::error!(
                "[CRITICAL] Display mutex poisoned during brightness update. Hardware brightness set, \
                but UI cache may be stale: {}",
                poisoned
            );
            let mut guard = poisoned.into_inner();
            update_display_brightness(&mut guard, target, percentage);
            sync_tray_from_display_guard(state, &guard)
        }
    }
}

pub(super) fn replace_cached_brightness_outcome(
    state: &AppState,
    displays: Vec<DisplayInfo>,
) -> bool {
    match state.displays.lock() {
        Ok(mut guard) => {
            *guard = displays;
            sync_tray_from_display_guard(state, &guard);
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
    }
}

pub(super) fn cached_displays(state: &AppState) -> Vec<DisplayInfo> {
    match state.displays.lock() {
        Ok(guard) => guard.clone(),
        Err(poisoned) => {
            tracing::error!(
                "[CRITICAL] Display mutex poisoned while reading cached displays: {}",
                poisoned
            );
            poisoned.into_inner().clone()
        }
    }
}

pub(super) fn sync_display_cache(
    app: &AppHandle,
    state: &AppState,
    displays: Vec<DisplayInfo>,
) -> Vec<DisplayInfo> {
    let displays = replace_cached_displays(state, displays);
    refresh_tray(app);
    displays
}

pub(super) fn clear_display_cache(app: &AppHandle, state: &AppState) -> Vec<DisplayInfo> {
    sync_display_cache(app, state, Vec::new())
}

pub(super) fn sync_cached_brightness(
    app: &AppHandle,
    state: &AppState,
    target: DisplayTarget,
    percentage: u32,
) -> Vec<DisplayInfo> {
    let displays = update_cached_brightness(state, target, percentage);
    refresh_tray(app);
    displays
}

pub(super) fn sync_brightness_outcome(
    app: &AppHandle,
    state: &AppState,
    displays: Vec<DisplayInfo>,
) -> bool {
    let updated = replace_cached_brightness_outcome(state, displays);
    if updated {
        refresh_tray(app);
    }
    updated
}

fn refresh_tray(app: &AppHandle) {
    tray::update_tray_tooltip(app);
    tray::update_tray_menu(app);
}

fn update_display_brightness(displays: &mut [DisplayInfo], target: DisplayTarget, percentage: u32) {
    if let Some(display) = displays.iter_mut().find(|display| target.matches(display)) {
        let percentage = percentage.clamp(0, 100);
        display.brightness = percentage;
        display.brightness_raw = Some(match display.brightness_source {
            BrightnessSource::DdcVcp => {
                (percentage * display.brightness_raw_max.unwrap_or(100)) / 100
            }
            BrightnessSource::HdrSdr | BrightnessSource::DdcHighLevel | BrightnessSource::Wmi => {
                percentage
            }
        });
        if display.brightness_source == BrightnessSource::HdrSdr {
            display.nits = super::brightness::percent_to_sdr_nits(percentage);
        }
    }
}

fn sync_tray_from_display_guard(state: &AppState, displays: &[DisplayInfo]) -> Vec<DisplayInfo> {
    let updated_displays = displays.to_vec();
    replace_cached_tray_state(state, &updated_displays);
    updated_displays
}

fn replace_cached_tray_state(state: &AppState, displays: &[DisplayInfo]) {
    if let Ok(mut tray_guard) = state.tray_state.lock() {
        *tray_guard = TrayState::from_displays(displays);
    } else {
        tracing::error!("[CRITICAL] Tray state mutex poisoned while syncing display cache.");
    }
}

#[cfg(test)]
mod tests {
    use super::{
        replace_cached_brightness_outcome, replace_cached_displays, update_cached_brightness,
        DisplayTarget,
    };
    use crate::{
        app::{AppState, TrayDisplaySummary, TrayState},
        display::{
            model::{luminance, BrightnessSource},
            DisplayInfo,
        },
    };

    fn display(name: &str, target_id: u32, nits: u32) -> DisplayInfo {
        DisplayInfo {
            name: name.to_string(),
            brightness: super::super::brightness::sdr_nits_to_percent(nits),
            brightness_source: BrightnessSource::HdrSdr,
            brightness_raw: Some(super::super::brightness::sdr_nits_to_percent(nits)),
            brightness_raw_max: Some(100),
            brightness_device_id: format!("1:2:{target_id}"),
            brightness_vcp_code: None,
            ddc_source: None,
            nits,
            min_percentage: 0,
            max_percentage: 100,
            hdr_supported: true,
            hdr_enabled: true,
            adapter_id_low: 1,
            adapter_id_high: 2,
            target_id,
            min_nits: Some(luminance::MIN_NITS),
            max_nits: Some(luminance::MAX_NITS),
        }
    }

    #[test]
    fn replace_cached_displays_updates_display_cache_and_tray_summary() {
        let state = AppState::default();
        let displays = vec![display("Display A", 1, 280), display("Display B", 2, 320)];

        let returned = replace_cached_displays(&state, displays.clone());

        assert_eq!(returned, displays);
        assert_eq!(*state.displays.lock().unwrap(), displays);
        assert_eq!(
            *state.tray_state.lock().unwrap(),
            TrayState {
                displays: vec![
                    TrayDisplaySummary {
                        name: "Display A".to_string(),
                        brightness: 50,
                        brightness_source: BrightnessSource::HdrSdr,
                    },
                    TrayDisplaySummary {
                        name: "Display B".to_string(),
                        brightness: 60,
                        brightness_source: BrightnessSource::HdrSdr,
                    },
                ],
            }
        );
    }

    #[test]
    fn update_cached_brightness_only_updates_matching_display() {
        let state = AppState::default();
        replace_cached_displays(
            &state,
            vec![display("Display A", 1, 80), display("Display B", 2, 80)],
        );

        let updated = update_cached_brightness(&state, DisplayTarget::new(1, 2, 2), 50);

        assert_eq!(
            updated,
            vec![display("Display A", 1, 80), display("Display B", 2, 280)]
        );
        assert_eq!(
            *state.tray_state.lock().unwrap(),
            TrayState {
                displays: vec![
                    TrayDisplaySummary {
                        name: "Display A".to_string(),
                        brightness: 0,
                        brightness_source: BrightnessSource::HdrSdr,
                    },
                    TrayDisplaySummary {
                        name: "Display B".to_string(),
                        brightness: 50,
                        brightness_source: BrightnessSource::HdrSdr,
                    },
                ],
            }
        );
    }

    #[test]
    fn replace_cached_brightness_outcome_reports_success_after_cache_sync() {
        let state = AppState::default();
        let displays = vec![display("Display A", 1, 280)];

        assert!(replace_cached_brightness_outcome(&state, displays.clone()));
        assert_eq!(*state.displays.lock().unwrap(), displays);
    }
}
