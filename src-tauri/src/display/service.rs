use once_cell::sync::Lazy;
use std::collections::HashMap;
use std::thread;
use std::time::Duration;
use windows::Win32::Foundation::LUID;

use super::ffi::{
    get_advanced_color_info, get_display_name, get_sdr_white_level_raw, query_active_display_paths,
    set_advanced_color_state, set_sdr_white_level_raw, DisplayPath,
};
use super::model::{luminance, BrightnessSource, DisplayInfo};
use super::DisplayError;
use super::{
    ddcci::{self, DdcDisplay},
    wmi::{self, WmiDisplay},
};

const MAX_CONSECUTIVE_FAILURES: usize = 3;
const HDR_STATE_POLL_ATTEMPTS: usize = 8;
const HDR_STATE_POLL_DELAY_MS: u64 = 150;

/// Key for identifying a display across API calls.
#[derive(Clone, Debug, Hash, PartialEq, Eq)]
struct DisplayKey {
    adapter_id_low: i32,
    adapter_id_high: i32,
    target_id: u32,
}

impl DisplayKey {
    fn from_path(path: &DisplayPath) -> Self {
        Self {
            adapter_id_low: path.adapter_id_low,
            adapter_id_high: path.adapter_id_high,
            target_id: path.target_id,
        }
    }

    #[allow(dead_code)]
    fn from_display(display: &DisplayInfo) -> Self {
        Self {
            adapter_id_low: display.adapter_id_low,
            adapter_id_high: display.adapter_id_high,
            target_id: display.target_id,
        }
    }
}

/// Per-display failure tracking.
/// Instead of one global kill switch, each display tracks its own failure count.
/// A display is skipped only after MAX_CONSECUTIVE_FAILURES failures for THAT display.
struct PerDisplayFailureTracker {
    failures: HashMap<DisplayKey, usize>,
}

impl PerDisplayFailureTracker {
    fn new() -> Self {
        Self {
            failures: HashMap::new(),
        }
    }

    /// Record a failure for a specific display.
    /// Returns true if the display should be skipped (too many failures).
    fn record_failure(&mut self, key: &DisplayKey) -> bool {
        let count = self.failures.entry(key.clone()).or_insert(0);
        *count += 1;
        tracing::warn!(
            "Display {:?} failure #{}. HDR will be disabled for this display after {} total failures.",
            key,
            *count,
            MAX_CONSECUTIVE_FAILURES
        );
        *count >= MAX_CONSECUTIVE_FAILURES
    }

    /// Reset failure count for a display (on successful operation).
    fn reset(&mut self, key: &DisplayKey) {
        if self.failures.remove(key).is_some() {
            tracing::info!("Display {:?} recovered from previous failures.", key);
        }
    }

    /// Check if a display should be skipped due to too many failures.
    fn is_disabled(&self, key: &DisplayKey) -> bool {
        self.failures
            .get(key)
            .map(|&count| count >= MAX_CONSECUTIVE_FAILURES)
            .unwrap_or(false)
    }
}

/// Global failure tracker instance.
/// Uses Lazy to avoid static initialization order issues.
static FAILURE_TRACKER: Lazy<std::sync::Mutex<PerDisplayFailureTracker>> =
    Lazy::new(|| std::sync::Mutex::new(PerDisplayFailureTracker::new()));

pub(super) fn get_hdr_displays_impl() -> Result<Vec<DisplayInfo>, DisplayError> {
    get_displays_impl()
}

pub(super) fn get_displays_impl() -> Result<Vec<DisplayInfo>, DisplayError> {
    let displays = enumerate_all_brightness_displays();

    if displays.is_empty() {
        Err(DisplayError::no_hdr_displays())
    } else {
        Ok(displays)
    }
}

fn enumerate_all_brightness_displays() -> Vec<DisplayInfo> {
    let mut displays = match enumerate_hdr_sdr_displays() {
        Ok(displays) => displays,
        Err(error) => {
            tracing::warn!("HDR SDR enumeration skipped: {}", error);
            Vec::new()
        }
    };

    match ddcci::enumerate_ddc_displays() {
        Ok(ddc_displays) => {
            for display in ddc_displays {
                merge_ddc_display(&mut displays, display);
            }
        }
        Err(error) => tracing::warn!("DDC/CI enumeration skipped: {}", error),
    }

    match wmi::enumerate_wmi_displays() {
        Ok(wmi_displays) => {
            for display in wmi_displays {
                merge_wmi_display(&mut displays, display);
            }
        }
        Err(error) => tracing::warn!("WMI enumeration skipped: {}", error),
    }

    displays
}


pub(super) fn set_display_brightness_impl(
    display: &DisplayInfo,
    percentage: u32,
) -> Result<(), DisplayError> {
    let percentage = percentage.clamp(0, 100);

    match display.brightness_source {
        BrightnessSource::HdrSdr => {
            let adapter_id = LUID {
                LowPart: display.adapter_id_low as u32,
                HighPart: display.adapter_id_high,
            };
            let nits = super::brightness::percent_to_sdr_nits(percentage);
            set_sdr_white_level_raw(adapter_id, display.target_id, nits)
        }
        BrightnessSource::DdcHighLevel => {
            ddcci::set_ddc_high_level_brightness(&display.brightness_device_id, percentage)
        }
        BrightnessSource::DdcVcp => {
            let vcp_code = display.brightness_vcp_code.ok_or_else(|| {
                DisplayError::ddc_brightness_failed(format!(
                    "Missing DDC VCP code for {}",
                    display.brightness_device_id
                ))
            })?;
            let vcp_code = u8::try_from(vcp_code).map_err(|_| {
                DisplayError::ddc_brightness_failed(format!(
                    "Invalid DDC VCP code {vcp_code} for {}",
                    display.brightness_device_id
                ))
            })?;
            ddcci::set_ddc_vcp_brightness(
                &display.brightness_device_id,
                vcp_code,
                percentage,
                display.brightness_raw_max.unwrap_or(100),
            )
        }
        BrightnessSource::Wmi => wmi::set_wmi_brightness(&display.brightness_device_id, percentage),
    }
}


pub(super) fn set_brightness_all_impl(
    displays: Vec<DisplayInfo>,
    percentage: u32,
) -> Vec<Result<(), DisplayError>> {
    displays
        .iter()
        .map(|display| set_display_brightness_impl(display, percentage))
        .collect()
}

pub(super) fn set_hdr_enabled_impl(
    adapter_low: i32,
    adapter_high: i32,
    target_id: u32,
    enabled: bool,
) -> Result<(), DisplayError> {
    let adapter_id = LUID {
        LowPart: adapter_low as u32,
        HighPart: adapter_high,
    };
    set_advanced_color_state(adapter_id, target_id, enabled)
}

#[allow(dead_code)] pub(super) fn get_hdr_displays_after_toggle_impl(
    adapter_low: i32,
    adapter_high: i32,
    target_id: u32,
    expected_enabled: bool,
) -> Result<Vec<DisplayInfo>, DisplayError> {
    let mut last_displays: Option<Vec<DisplayInfo>> = None;

    for attempt in 0..HDR_STATE_POLL_ATTEMPTS {
        let displays = get_hdr_displays_impl()?;
        let matches_expected_state = displays.iter().any(|display| {
            display.adapter_id_low == adapter_low
                && display.adapter_id_high == adapter_high
                && display.target_id == target_id
                && display.hdr_enabled == expected_enabled
        });

        if matches_expected_state {
            return Ok(displays);
        }

        last_displays = Some(displays);

        if attempt + 1 < HDR_STATE_POLL_ATTEMPTS {
            thread::sleep(Duration::from_millis(HDR_STATE_POLL_DELAY_MS));
        }
    }

    Ok(last_displays.unwrap_or_default())
}


fn enumerate_hdr_sdr_displays() -> Result<Vec<DisplayInfo>, DisplayError> {
    let paths = query_active_display_paths()?;

    let mut displays = Vec::new();
    let mut tracker = match FAILURE_TRACKER.lock() {
        Ok(guard) => guard,
        Err(poisoned) => {
            tracing::error!(
                "[CRITICAL] Failure tracker mutex was poisoned (previous panic in critical section): {}",
                poisoned
            );
            poisoned.into_inner()
        }
    };

    for path in paths {
        let key = DisplayKey::from_path(&path);

        if tracker.is_disabled(&key) {
            tracing::warn!(
                "Skipping display {:?} - too many consecutive failures. Refresh to retry.",
                key
            );
            continue;
        }

        let display_name = get_display_name(path);
        let advanced_color_info = get_advanced_color_info(path);
        let hdr_supported = advanced_color_info.is_supported();
        let hdr_enabled = advanced_color_info.is_enabled();

        if !hdr_supported {
            continue;
        }

        let nits = match get_sdr_white_level_raw(path.adapter_id, path.target_id) {
            Ok(n) => {
                tracker.reset(&key);
                n
            }
            Err(e) => {
                let disabled = tracker.record_failure(&key);
                if disabled {
                    tracing::error!(
                        "Display '{}' ({:?}) disabled after {} consecutive failures",
                        display_name,
                        key,
                        MAX_CONSECUTIVE_FAILURES
                    );
                } else {
                    tracing::warn!(
                        "Failed to read SDR white level for '{}': {}; using fallback {} nits",
                        display_name,
                        e,
                        luminance::DEFAULT_NITS
                    );
                }
                luminance::DEFAULT_NITS
            }
        };

        let brightness = super::brightness::sdr_nits_to_percent(nits);

        displays.push(DisplayInfo {
            name: display_name,
            brightness,
            brightness_source: BrightnessSource::HdrSdr,
            brightness_raw: Some(brightness),
            brightness_raw_max: Some(100),
            brightness_device_id: display_identity(
                path.adapter_id_low,
                path.adapter_id_high,
                path.target_id,
            ),
            brightness_vcp_code: None,
            ddc_source: None,
            nits,
            min_percentage: 0,
            max_percentage: 100,
            hdr_supported,
            hdr_enabled,
            adapter_id_low: path.adapter_id_low,
            adapter_id_high: path.adapter_id_high,
            target_id: path.target_id,
            min_nits: Some(luminance::MIN_NITS),
            max_nits: Some(luminance::MAX_NITS),
        });
    }

    Ok(displays)
}

fn merge_ddc_display(displays: &mut Vec<DisplayInfo>, display: DdcDisplay) {
    let ddc_source = if display.high_level_supported {
        BrightnessSource::DdcHighLevel
    } else {
        BrightnessSource::DdcVcp
    };

    // If an HDR SDR entry already exists, inject DDC metadata for HDR-off fallback.
    if let Some(existing) = displays.iter_mut().find(|existing| {
        existing.brightness_source == BrightnessSource::HdrSdr && existing.name == display.name
    }) {
        existing.ddc_source = Some(ddc_source);
        existing.brightness_device_id = display.device_key;
        existing.brightness_vcp_code = display.vcp_code.map(u32::from);
        existing.brightness_raw = Some(display.brightness_raw);
        existing.brightness_raw_max = Some(display.brightness_raw_max);
        return;
    }

    let target_id = next_provider_target_id(displays);

    displays.push(DisplayInfo {
        name: display.name,
        brightness: display.brightness_percent,
        brightness_source: ddc_source,
        brightness_raw: Some(display.brightness_raw),
        brightness_raw_max: Some(display.brightness_raw_max),
        brightness_device_id: display.device_key,
        brightness_vcp_code: display.vcp_code.map(u32::from),
        ddc_source: None,
        nits: luminance::DEFAULT_NITS,
        min_percentage: 0,
        max_percentage: 100,
        hdr_supported: false,
        hdr_enabled: false,
        adapter_id_low: -1000,
        adapter_id_high: 0,
        target_id,
        min_nits: None,
        max_nits: None,
    });
}

fn merge_wmi_display(displays: &mut Vec<DisplayInfo>, display: WmiDisplay) {
    // If an HDR SDR entry already exists, inject WMI metadata for HDR-off fallback.
    if let Some(existing) = displays.iter_mut().find(|existing| {
        existing.brightness_source == BrightnessSource::HdrSdr && existing.name == display.name
    }) {
        existing.ddc_source = Some(BrightnessSource::Wmi);
        existing.brightness_device_id = display.key;
        existing.brightness_raw = Some(display.brightness_percent);
        existing.brightness_raw_max = Some(100);
        existing.brightness_vcp_code = None;
        return;
    }

    // No HDR SDR entry — append as a standalone WMI display.
    let target_id = next_provider_target_id(displays);

    displays.push(DisplayInfo {
        name: display.name,
        brightness: display.brightness_percent,
        brightness_source: BrightnessSource::Wmi,
        brightness_raw: Some(display.brightness_percent),
        brightness_raw_max: Some(100),
        brightness_device_id: display.key,
        brightness_vcp_code: None,
        ddc_source: None,
        nits: luminance::DEFAULT_NITS,
        min_percentage: 0,
        max_percentage: 100,
        hdr_supported: false,
        hdr_enabled: false,
        adapter_id_low: -2000,
        adapter_id_high: 0,
        target_id,
        min_nits: None,
        max_nits: None,
    });
}

fn next_provider_target_id(displays: &[DisplayInfo]) -> u32 {
    displays
        .iter()
        .map(|display| display.target_id)
        .max()
        .unwrap_or(0)
        .saturating_add(1)
}

fn display_identity(adapter_low: i32, adapter_high: i32, target_id: u32) -> String {
    format!("{adapter_low}:{adapter_high}:{target_id}")
}

fn percentage_to_nits(percentage: u32, min_nits: u32, max_nits: u32) -> u32 {
    ((percentage.clamp(0, 100) * (max_nits.saturating_sub(min_nits))) / 100) + min_nits
}

#[allow(dead_code)] pub(super) fn percentage_to_nits_public(percentage: u32, min_nits: u32, max_nits: u32) -> u32 {
    percentage_to_nits(percentage, min_nits, max_nits)
}

#[cfg(test)]
mod tests {
    use super::{
        percentage_to_nits, DisplayKey, PerDisplayFailureTracker, HDR_STATE_POLL_ATTEMPTS,
        HDR_STATE_POLL_DELAY_MS, MAX_CONSECUTIVE_FAILURES,
    };
    use crate::display::model::{luminance, BrightnessSource};

    #[test]
    fn percentage_to_nits_maps_bounds() {
        assert_eq!(
            percentage_to_nits(0, luminance::MIN_NITS, luminance::MAX_NITS),
            80
        );
        assert_eq!(
            percentage_to_nits(100, luminance::MIN_NITS, luminance::MAX_NITS),
            480
        );
    }

    #[test]
    fn percentage_to_nits_maps_midpoint() {
        assert_eq!(
            percentage_to_nits(50, luminance::MIN_NITS, luminance::MAX_NITS),
            280
        );
    }

    #[test]
    fn percentage_to_nits_clamps_out_of_range_values() {
        assert_eq!(
            percentage_to_nits(150, luminance::MIN_NITS, luminance::MAX_NITS),
            480
        );
    }

    #[test]
    fn percentage_to_nits_handles_inverted_range_without_underflow() {
        assert_eq!(percentage_to_nits(50, 480, 80), 480);
    }

    #[test]
    fn per_display_failure_tracker_disables_after_threshold() {
        let mut tracker = PerDisplayFailureTracker::new();
        let key = DisplayKey {
            adapter_id_low: 1,
            adapter_id_high: 2,
            target_id: 3,
        };

        // First two failures should not disable
        assert!(!tracker.record_failure(&key));
        assert!(!tracker.is_disabled(&key));
        assert!(!tracker.record_failure(&key));
        assert!(!tracker.is_disabled(&key));

        // Third failure should disable
        assert!(tracker.record_failure(&key));
        assert!(tracker.is_disabled(&key));
    }

    #[test]
    fn per_display_failure_tracker_resets_on_success() {
        let mut tracker = PerDisplayFailureTracker::new();
        let key = DisplayKey {
            adapter_id_low: 1,
            adapter_id_high: 2,
            target_id: 3,
        };

        // Record some failures
        assert!(!tracker.record_failure(&key));
        assert!(!tracker.record_failure(&key));

        // Reset
        tracker.reset(&key);

        // Should not be disabled
        assert!(!tracker.is_disabled(&key));

        // New failures should start from scratch
        assert!(!tracker.record_failure(&key)); // count: 0 -> 1, 1 >= 3 = false
        assert!(!tracker.record_failure(&key)); // count: 1 -> 2, 2 >= 3 = false
        assert!(tracker.record_failure(&key)); // count: 2 -> 3, 3 >= 3 = true
        assert!(tracker.is_disabled(&key));
    }

    #[test]
    fn per_display_failure_tracker_tracks_displays_independently() {
        let mut tracker = PerDisplayFailureTracker::new();
        let key1 = DisplayKey {
            adapter_id_low: 1,
            adapter_id_high: 2,
            target_id: 3,
        };
        let key2 = DisplayKey {
            adapter_id_low: 4,
            adapter_id_high: 5,
            target_id: 6,
        };

        // Fail display 1 three times
        for _ in 0..MAX_CONSECUTIVE_FAILURES {
            tracker.record_failure(&key1);
        }

        // Display 1 should be disabled, display 2 should not
        assert!(tracker.is_disabled(&key1));
        assert!(!tracker.is_disabled(&key2));
    }

    #[test]
    fn display_key_equality_and_hash() {
        let key1 = DisplayKey {
            adapter_id_low: 1,
            adapter_id_high: 2,
            target_id: 3,
        };
        let key2 = DisplayKey {
            adapter_id_low: 1,
            adapter_id_high: 2,
            target_id: 3,
        };
        let key3 = DisplayKey {
            adapter_id_low: 4,
            adapter_id_high: 5,
            target_id: 6,
        };

        // Same values should be equal
        assert_eq!(key1, key2);

        // Different values should not be equal
        assert_ne!(key1, key3);

        // Hash should be consistent
        use std::collections::HashSet;
        let mut set = HashSet::new();
        set.insert(key1.clone());
        set.insert(key2.clone()); // Duplicate, should not increase size
        set.insert(key3.clone());
        assert_eq!(set.len(), 2); // key1 and key2 are same, so 2 unique
    }

    #[test]
    fn display_key_from_display_roundtrip() {
        use crate::display::{model::BrightnessSource, DisplayInfo};

        let display_info = DisplayInfo {
            name: "Test Display".to_string(),
            brightness: 50,
            brightness_source: BrightnessSource::HdrSdr,
            brightness_raw: Some(50),
            brightness_raw_max: Some(100),
            brightness_device_id: "123:456:789".to_string(),
            brightness_vcp_code: None,
            ddc_source: None,
            nits: 280,
            min_percentage: 0,
            max_percentage: 100,
            hdr_supported: true,
            hdr_enabled: true,
            adapter_id_low: 123,
            adapter_id_high: 456,
            target_id: 789,
            min_nits: Some(80),
            max_nits: Some(480),
        };

        let key = DisplayKey::from_display(&display_info);
        assert_eq!(key.adapter_id_low, 123);
        assert_eq!(key.adapter_id_high, 456);
        assert_eq!(key.target_id, 789);
    }

    #[test]
    fn hdr_polling_constants_are_correct() {
        assert_eq!(HDR_STATE_POLL_ATTEMPTS, 8);
        assert_eq!(HDR_STATE_POLL_DELAY_MS, 150);
        // Total max polling time: 8 * 150ms = 1200ms
        assert_eq!(
            HDR_STATE_POLL_ATTEMPTS as u64 * HDR_STATE_POLL_DELAY_MS,
            1200
        );
    }

    fn push_hdr_display_for_test(
        displays: &mut Vec<crate::display::DisplayInfo>,
        name: &str,
        adapter_id_low: i32,
        adapter_id_high: i32,
        target_id: u32,
        nits: u32,
        hdr_enabled: bool,
    ) {
        displays.push(crate::display::DisplayInfo {
            name: name.to_string(),
            brightness: super::super::brightness::sdr_nits_to_percent(nits),
            brightness_source: BrightnessSource::HdrSdr,
            brightness_raw: Some(super::super::brightness::sdr_nits_to_percent(nits)),
            brightness_raw_max: Some(100),
            brightness_device_id: format!("{adapter_id_low}:{adapter_id_high}:{target_id}"),
            brightness_vcp_code: None,
            ddc_source: None,
            nits,
            min_percentage: 0,
            max_percentage: 100,
            hdr_supported: true,
            hdr_enabled,
            adapter_id_low,
            adapter_id_high,
            target_id,
            min_nits: Some(luminance::MIN_NITS),
            max_nits: Some(luminance::MAX_NITS),
        });
    }

    fn merge_wmi_display_for_test(
        displays: &mut Vec<crate::display::DisplayInfo>,
        key: &str,
        name: &str,
        brightness_percent: u32,
    ) {
        super::merge_wmi_display(
            displays,
            super::WmiDisplay {
                key: key.to_string(),
                name: name.to_string(),
                brightness_percent,
            },
        );
    }

    #[test]
    fn merge_injects_wmi_fallback_for_hdr_internal_display() {
        let mut displays = Vec::new();
        push_hdr_display_for_test(&mut displays, "Internal Display", 1, 2, 3, 280, true);
        merge_wmi_display_for_test(&mut displays, "WMI-1", "Internal Display", 60);

        // Should still be one entry, not two
        assert_eq!(displays.len(), 1);
        assert_eq!(displays[0].brightness_source, BrightnessSource::HdrSdr);
        assert_eq!(displays[0].ddc_source, Some(BrightnessSource::Wmi));
        assert_eq!(displays[0].brightness_device_id, "WMI-1");
        assert_eq!(displays[0].brightness_raw, Some(60));
    }

    #[test]
    fn merge_adds_standalone_wmi_display_when_no_hdr_match() {
        let mut displays = Vec::new();
        merge_wmi_display_for_test(&mut displays, "WMI-2", "Laptop Panel", 42);

        assert_eq!(displays.len(), 1);
        assert_eq!(displays[0].brightness_source, BrightnessSource::Wmi);
        assert_eq!(displays[0].brightness, 42);
        assert_eq!(displays[0].ddc_source, None);
    }

}
