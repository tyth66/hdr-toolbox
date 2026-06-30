use super::model::DisplayInfo;
use super::projection::apply_brightness_projection;
use super::service::{
    get_hdr_displays_impl, refresh_known_display_state_impl, set_brightness_all_impl,
    set_display_brightness_impl, set_hdr_enabled_impl,
};
use super::session::{
    cached_displays, clear_display_cache, flip_hdr_source_in_cache, sync_brightness_outcome,
    sync_cached_brightness, sync_cached_display_state, sync_display_cache, DisplayTarget,
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
                    apply_brightness_projection(&mut display, percentage);
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
pub fn refresh_cached_displays(app: AppHandle, state: State<AppState>) -> Vec<DisplayInfo> {
    sync_cached_display_state(&app, &state)
}

#[tauri::command]
pub fn refresh_known_display_state(
    app: AppHandle,
    state: State<AppState>,
) -> Result<Vec<DisplayInfo>, DisplayError> {
    let displays = cached_displays(&state);
    let displays = refresh_known_display_state_impl(displays)?;
    let displays = sync_display_cache(&app, &state, displays);
    Ok(displays)
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
    let _legacy_bounds = (min_nits, max_nits);
    let target = DisplayTarget::new(adapter_low, adapter_high, target_id);
    let display = cached_displays(&state)
        .into_iter()
        .find(|display| target.matches(display))
        .ok_or_else(DisplayError::display_not_found)?;

    set_display_brightness_impl(&display, percentage)?;

    let displays = sync_cached_brightness(&app, &state, target, percentage);
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

    // Flip the brightness_source in cache: HDR on -> HdrSdr, HDR off -> fallback_source
    // This avoids a full re-enumeration and keeps a single entry per display.
    let target = DisplayTarget::new(adapter_low, adapter_high, target_id);
    let displays = flip_hdr_source_in_cache(&app, &state, target, enabled)?;

    Ok(displays)
}

#[cfg(test)]
mod tests {
    use super::{build_brightness_all_outcome, BrightnessAllFailure, BrightnessAllOutcome};
    use crate::display::{
        model::{luminance, BrightnessSource},
        DisplayError, DisplayInfo,
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
            fallback_source: None,
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

    fn display_with_source(
        name: &str,
        target_id: u32,
        brightness: u32,
        source: BrightnessSource,
    ) -> DisplayInfo {
        DisplayInfo {
            name: name.to_string(),
            brightness,
            brightness_source: source,
            brightness_raw: Some(brightness),
            brightness_raw_max: Some(100),
            brightness_device_id: format!("device-{target_id}"),
            brightness_vcp_code: (source == BrightnessSource::DdcVcp).then_some(0x10),
            fallback_source: None,
            nits: if source == BrightnessSource::HdrSdr {
                super::super::brightness::percent_to_sdr_nits(brightness)
            } else {
                luminance::DEFAULT_NITS
            },
            min_percentage: 0,
            max_percentage: 100,
            hdr_supported: source == BrightnessSource::HdrSdr,
            hdr_enabled: source == BrightnessSource::HdrSdr,
            adapter_id_low: 1,
            adapter_id_high: 2,
            target_id,
            min_nits: (source == BrightnessSource::HdrSdr).then_some(luminance::MIN_NITS),
            max_nits: (source == BrightnessSource::HdrSdr).then_some(luminance::MAX_NITS),
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

    #[test]
    fn brightness_all_outcome_updates_percent_for_successful_displays() {
        let original = vec![
            display_with_source("HDR", 1, 50, BrightnessSource::HdrSdr),
            display_with_source("DDC", 2, 40, BrightnessSource::DdcVcp),
        ];
        let results = vec![Ok(()), Ok(())];

        let outcome = build_brightness_all_outcome(original, results, 75);

        assert_eq!(outcome.displays[0].brightness, 75);
        assert_eq!(outcome.displays[0].nits, 380);
        assert_eq!(outcome.displays[1].brightness, 75);
        assert_eq!(outcome.displays[1].nits, luminance::DEFAULT_NITS);
        assert_eq!(outcome.failures.len(), 0);
    }
}
