use super::model::DisplayInfo;
use super::service::{
    get_hdr_displays_after_toggle_impl, get_hdr_displays_impl, set_brightness_all_impl,
    set_brightness_impl, set_hdr_enabled_impl,
};
use super::session::{
    cached_displays, clear_display_cache, sync_brightness_outcome, sync_cached_brightness,
    sync_display_cache, DisplayTarget,
};
use crate::{app::AppState, display::DisplayError};
use tauri::{AppHandle, State};

#[derive(Debug, Clone, PartialEq, Eq, serde::Serialize)]
pub struct BrightnessAllFailure {
    pub adapter_id_low: i32,
    pub adapter_id_high: i32,
    pub target_id: u32,
    pub name: String,
    pub error: DisplayError,
}

#[derive(Debug, Clone, PartialEq, Eq, serde::Serialize)]
pub struct BrightnessAllOutcome {
    pub displays: Vec<DisplayInfo>,
    pub failures: Vec<BrightnessAllFailure>,
}

fn build_brightness_all_outcome(
    displays: Vec<DisplayInfo>,
    results: Vec<Result<(), DisplayError>>,
    percentage: u32,
) -> BrightnessAllOutcome {
    let mut failures = Vec::new();
    let updated_displays = displays
        .into_iter()
        .zip(results)
        .map(|(mut display, result)| {
            match result {
                Ok(()) => {
                    display.nits = super::service::percentage_to_nits_public(
                        percentage,
                        display.min_nits.unwrap_or(80),
                        display.max_nits.unwrap_or(480),
                    );
                }
                Err(error) => failures.push(BrightnessAllFailure {
                    adapter_id_low: display.adapter_id_low,
                    adapter_id_high: display.adapter_id_high,
                    target_id: display.target_id,
                    name: display.name.clone(),
                    error,
                }),
            }
            display
        })
        .collect();

    BrightnessAllOutcome {
        displays: updated_displays,
        failures,
    }
}

#[tauri::command]
pub fn get_hdr_displays(
    app: AppHandle,
    state: State<AppState>,
) -> Result<Vec<DisplayInfo>, DisplayError> {
    match get_hdr_displays_impl() {
        Ok(displays) => {
            let displays = sync_display_cache(&app, &state, displays);
            Ok(displays)
        }
        Err(err) => {
            clear_display_cache(&app, &state);
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
) -> Result<Vec<DisplayInfo>, DisplayError> {
    set_brightness_impl(
        adapter_low,
        adapter_high,
        target_id,
        percentage,
        min_nits,
        max_nits,
    )?;

    let updated_nits = super::service::percentage_to_nits_public(percentage, min_nits, max_nits);
    let target = DisplayTarget::new(adapter_low, adapter_high, target_id);
    let displays = sync_cached_brightness(&app, &state, target, updated_nits);
    Ok(displays)
}

#[tauri::command]
pub fn set_brightness_all(
    app: AppHandle,
    state: State<AppState>,
    percentage: u32,
) -> BrightnessAllOutcome {
    let displays = cached_displays(&state);
    let results = set_brightness_all_impl(displays.clone(), percentage);
    let outcome = build_brightness_all_outcome(displays, results, percentage);

    sync_brightness_outcome(&app, &state, outcome.displays.clone());

    outcome
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
    set_hdr_enabled_impl(adapter_low, adapter_high, target_id, enabled)?;

    match get_hdr_displays_after_toggle_impl(adapter_low, adapter_high, target_id, enabled) {
        Ok(displays) => {
            let displays = sync_display_cache(&app, &state, displays);
            Ok(displays)
        }
        Err(err) => {
            clear_display_cache(&app, &state);
            Err(err)
        }
    }
}

#[cfg(test)]
mod tests {
    use super::{build_brightness_all_outcome, BrightnessAllFailure, BrightnessAllOutcome};
    use crate::display::{model::luminance, DisplayError, DisplayInfo};

    fn display(name: &str, target_id: u32, nits: u32) -> DisplayInfo {
        DisplayInfo {
            name: name.to_string(),
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
    fn brightness_all_outcome_updates_successful_displays_and_reports_failures() {
        let original = vec![display("Display A", 1, 80), display("Display B", 2, 80)];
        let results = vec![Ok(()), Err(DisplayError::brightness_failed("denied"))];

        let outcome = build_brightness_all_outcome(original.clone(), results, 50);

        assert_eq!(
            outcome,
            BrightnessAllOutcome {
                displays: vec![display("Display A", 1, 280), display("Display B", 2, 80)],
                failures: vec![BrightnessAllFailure {
                    adapter_id_low: 1,
                    adapter_id_high: 2,
                    target_id: 2,
                    name: "Display B".to_string(),
                    error: DisplayError::brightness_failed("denied"),
                }],
            }
        );
    }
}
