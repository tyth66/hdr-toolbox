use once_cell::sync::Lazy;
use std::collections::HashMap;
use std::thread;
use std::time::Duration;
use windows::Win32::Devices::Display::{
    DisplayConfigGetDeviceInfo, GetDisplayConfigBufferSizes, QueryDisplayConfig,
    DISPLAYCONFIG_DEVICE_INFO_GET_ADVANCED_COLOR_INFO, DISPLAYCONFIG_DEVICE_INFO_GET_TARGET_NAME,
    DISPLAYCONFIG_GET_ADVANCED_COLOR_INFO, DISPLAYCONFIG_GET_ADVANCED_COLOR_INFO_0,
    DISPLAYCONFIG_PATH_INFO, DISPLAYCONFIG_TARGET_DEVICE_NAME, QDC_ONLY_ACTIVE_PATHS,
};
use windows::Win32::Foundation::LUID;
use windows::Win32::Graphics::Gdi::DISPLAYCONFIG_COLOR_ENCODING;

use super::ffi::{
    get_brightness_range_from_physical_monitor, get_hmonitor_for_display, get_sdr_white_level_raw,
    set_advanced_color_state, set_sdr_white_level_raw,
};
use super::model::{luminance, DisplayInfo};

const MAX_CONSECUTIVE_FAILURES: usize = 3;
const HDR_STATE_POLL_ATTEMPTS: usize = 8;
const HDR_STATE_POLL_DELAY_MS: u64 = 150;

/// Advanced color info bits from DISPLAYCONFIG_GET_ADVANCED_COLOR_INFO
const ADVANCED_COLOR_SUPPORTED_BIT: u32 = 0x1;
const ADVANCED_COLOR_ENABLED_BIT: u32 = 0x2;

/// Key for identifying a display across API calls.
#[derive(Clone, Debug, Hash, PartialEq, Eq)]
struct DisplayKey {
    adapter_id_low: i32,
    adapter_id_high: i32,
    target_id: u32,
}

impl DisplayKey {
    fn from_path(path: &DISPLAYCONFIG_PATH_INFO) -> Self {
        Self {
            adapter_id_low: path.targetInfo.adapterId.LowPart as i32,
            adapter_id_high: path.targetInfo.adapterId.HighPart,
            target_id: path.targetInfo.id,
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

pub(super) fn get_hdr_displays_impl() -> Result<Vec<DisplayInfo>, String> {
    let mut path_count: u32 = 0;
    let mut mode_count: u32 = 0;

    let result = unsafe {
        GetDisplayConfigBufferSizes(QDC_ONLY_ACTIVE_PATHS, &mut path_count, &mut mode_count)
    };
    if result != windows::Win32::Foundation::WIN32_ERROR(0) {
        return Err(format!("GetDisplayConfigBufferSizes failed: {:#?}", result));
    }

    if path_count == 0 {
        return Err("No display paths found".to_string());
    }

    let mut paths = vec![DISPLAYCONFIG_PATH_INFO::default(); path_count as usize];
    let mut modes = vec![
        windows::Win32::Devices::Display::DISPLAYCONFIG_MODE_INFO::default();
        mode_count as usize
    ];

    let result = unsafe {
        QueryDisplayConfig(
            QDC_ONLY_ACTIVE_PATHS,
            &mut path_count,
            paths.as_mut_ptr(),
            &mut mode_count,
            modes.as_mut_ptr(),
            None,
        )
    };
    if result != windows::Win32::Foundation::WIN32_ERROR(0) {
        return Err(format!("QueryDisplayConfig failed: {:#?}", result));
    }

    let mut displays = Vec::new();
    let mut tracker = match FAILURE_TRACKER.lock() {
        Ok(guard) => guard,
        Err(poisoned) => {
            // Mutex was poisoned due to a previous panic. Log error and recover the inner value.
            // This means failure tracking state may be stale but the app can continue functioning.
            tracing::error!(
                "[CRITICAL] Failure tracker mutex was poisoned (previous panic in critical section): {}",
                poisoned
            );
            // Recover by using the inner value even though the mutex was poisoned
            poisoned.into_inner()
        }
    };

    #[allow(clippy::needless_range_loop)]
    for i in 0..path_count as usize {
        let path = paths[i];
        let key = DisplayKey::from_path(&path);

        // Check if this specific display has too many failures
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

        let nits = match get_sdr_white_level_raw(path.targetInfo.adapterId, path.targetInfo.id) {
            Ok(n) => {
                // Success - reset failure count for this display
                tracker.reset(&key);
                n
            }
            Err(e) => {
                // Record failure for this specific display
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

        let brightness_range = get_hmonitor_for_display(path.targetInfo.adapterId, path.targetInfo.id)
            .and_then(get_brightness_range_from_physical_monitor);

        let (min_percentage, max_percentage) = brightness_range
            .map(|(min, _current, max)| (min, max))
            .unwrap_or((0, 100));

        let min_nits = Some(luminance::MIN_NITS);
        let max_nits = Some(luminance::MAX_NITS);
        tracing::info!(
            "Display '{}' brightness range: {}-{} nits (HDR10 standard)",
            display_name,
            luminance::MIN_NITS,
            luminance::MAX_NITS
        );

        displays.push(DisplayInfo {
            name: display_name,
            nits,
            min_percentage,
            max_percentage,
            hdr_supported,
            hdr_enabled,
            adapter_id_low: path.targetInfo.adapterId.LowPart as i32,
            adapter_id_high: path.targetInfo.adapterId.HighPart as i32,
            target_id: path.targetInfo.id,
            min_nits,
            max_nits,
        });
    }

    if displays.is_empty() {
        Err("No HDR-capable displays found. Ensure your monitor supports HDR and the display driver is working correctly.".to_string())
    } else {
        Ok(displays)
    }
}

pub(super) fn set_brightness_impl(
    adapter_low: i32,
    adapter_high: i32,
    target_id: u32,
    percentage: u32,
    min_nits: u32,
    max_nits: u32,
) -> Result<(), String> {
    let adapter_id = LUID {
        LowPart: adapter_low as u32,
        HighPart: adapter_high,
    };
    let nits = percentage_to_nits(percentage, min_nits, max_nits);
    set_sdr_white_level_raw(adapter_id, target_id, nits)
}

pub(super) fn set_brightness_all_impl(
    displays: Vec<DisplayInfo>,
    percentage: u32,
) -> Vec<Result<(), String>> {
    displays
        .into_iter()
        .map(|display| {
            let adapter_id = LUID {
                LowPart: display.adapter_id_low as u32,
                HighPart: display.adapter_id_high,
            };
            let (min_nits, max_nits) = (
                display.min_nits.unwrap_or(80),
                display.max_nits.unwrap_or(480),
            );
            let nits = percentage_to_nits(percentage, min_nits, max_nits);
            set_sdr_white_level_raw(adapter_id, display.target_id, nits)
        })
        .collect()
}

pub(super) fn set_hdr_enabled_impl(
    adapter_low: i32,
    adapter_high: i32,
    target_id: u32,
    enabled: bool,
) -> Result<(), String> {
    let adapter_id = LUID {
        LowPart: adapter_low as u32,
        HighPart: adapter_high,
    };
    set_advanced_color_state(adapter_id, target_id, enabled)
}

pub(super) fn get_hdr_displays_after_toggle_impl(
    adapter_low: i32,
    adapter_high: i32,
    target_id: u32,
    expected_enabled: bool,
) -> Result<Vec<DisplayInfo>, String> {
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

fn percentage_to_nits(percentage: u32, min_nits: u32, max_nits: u32) -> u32 {
    ((percentage.clamp(0, 100) * (max_nits.saturating_sub(min_nits))) / 100) + min_nits
}

pub(super) fn percentage_to_nits_public(percentage: u32, min_nits: u32, max_nits: u32) -> u32 {
    percentage_to_nits(percentage, min_nits, max_nits)
}

fn get_display_name(path: DISPLAYCONFIG_PATH_INFO) -> String {
    let mut target_name = DISPLAYCONFIG_TARGET_DEVICE_NAME {
        header: windows::Win32::Devices::Display::DISPLAYCONFIG_DEVICE_INFO_HEADER {
            r#type: DISPLAYCONFIG_DEVICE_INFO_GET_TARGET_NAME,
            size: std::mem::size_of::<DISPLAYCONFIG_TARGET_DEVICE_NAME>() as u32,
            adapterId: path.targetInfo.adapterId,
            id: path.targetInfo.id,
        },
        ..Default::default()
    };

    unsafe {
        if DisplayConfigGetDeviceInfo(&mut target_name.header as *mut _ as *mut _) == 0 {
            let name_wide = target_name.monitorFriendlyDeviceName;
            let name = String::from_utf16_lossy(
                &name_wide[..name_wide
                    .iter()
                    .position(|&c| c == 0)
                    .unwrap_or(name_wide.len())],
            );
            if name.is_empty() {
                "Unknown Display".to_string()
            } else {
                name
            }
        } else {
            "Unknown Display".to_string()
        }
    }
}

#[derive(Clone, Copy, Debug, Default, PartialEq, Eq)]
struct AdvancedColorState {
    value: u32,
}

impl AdvancedColorState {
    fn is_supported(self) -> bool {
        (self.value & ADVANCED_COLOR_SUPPORTED_BIT) != 0
    }

    fn is_enabled(self) -> bool {
        (self.value & ADVANCED_COLOR_ENABLED_BIT) != 0
    }
}

fn get_advanced_color_info(path: DISPLAYCONFIG_PATH_INFO) -> AdvancedColorState {
    let mut advanced_color = DISPLAYCONFIG_GET_ADVANCED_COLOR_INFO {
        header: windows::Win32::Devices::Display::DISPLAYCONFIG_DEVICE_INFO_HEADER {
            r#type: DISPLAYCONFIG_DEVICE_INFO_GET_ADVANCED_COLOR_INFO,
            size: std::mem::size_of::<DISPLAYCONFIG_GET_ADVANCED_COLOR_INFO>() as u32,
            adapterId: path.targetInfo.adapterId,
            id: path.targetInfo.id,
        },
        Anonymous: DISPLAYCONFIG_GET_ADVANCED_COLOR_INFO_0 { value: 0 },
        colorEncoding: DISPLAYCONFIG_COLOR_ENCODING::default(),
        bitsPerColorChannel: 0,
    };

    unsafe {
        if DisplayConfigGetDeviceInfo(&mut advanced_color.header as *mut _ as *mut _) == 0 {
            AdvancedColorState {
                value: advanced_color.Anonymous.value,
            }
        } else {
            AdvancedColorState::default()
        }
    }
}

#[cfg(test)]
mod tests {
    use super::{
        percentage_to_nits, PerDisplayFailureTracker, DisplayKey, MAX_CONSECUTIVE_FAILURES,
        AdvancedColorState, HDR_STATE_POLL_ATTEMPTS, HDR_STATE_POLL_DELAY_MS,
    };
    use crate::display::model::luminance;

    #[test]
    fn percentage_to_nits_maps_bounds() {
        assert_eq!(percentage_to_nits(0, luminance::MIN_NITS, luminance::MAX_NITS), 80);
        assert_eq!(percentage_to_nits(100, luminance::MIN_NITS, luminance::MAX_NITS), 480);
    }

    #[test]
    fn percentage_to_nits_maps_midpoint() {
        assert_eq!(percentage_to_nits(50, luminance::MIN_NITS, luminance::MAX_NITS), 280);
    }

    #[test]
    fn percentage_to_nits_clamps_out_of_range_values() {
        assert_eq!(percentage_to_nits(150, luminance::MIN_NITS, luminance::MAX_NITS), 480);
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
        assert!(tracker.record_failure(&key));  // count: 2 -> 3, 3 >= 3 = true
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
    fn advanced_color_state_reads_supported_and_enabled_bits() {
        let supported_only = AdvancedColorState { value: 0x1 };
        let supported_and_enabled = AdvancedColorState { value: 0x3 };
        let unsupported = AdvancedColorState { value: 0x0 };

        assert!(supported_only.is_supported());
        assert!(!supported_only.is_enabled());
        assert!(supported_and_enabled.is_supported());
        assert!(supported_and_enabled.is_enabled());
        assert!(!unsupported.is_supported());
        assert!(!unsupported.is_enabled());
    }

    #[test]
    fn advanced_color_state_edge_cases() {
        // Only enabled bit set (bit 1 = 0x2)
        let enabled_only = AdvancedColorState { value: 0x2 };
        assert!(!enabled_only.is_supported());
        assert!(enabled_only.is_enabled());

        // Additional bits set should not affect core bits
        let with_extra_bits = AdvancedColorState { value: 0xF };
        assert!(with_extra_bits.is_supported());
        assert!(with_extra_bits.is_enabled());
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
        use crate::display::DisplayInfo;

        let display_info = DisplayInfo {
            name: "Test Display".to_string(),
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
        assert_eq!(HDR_STATE_POLL_ATTEMPTS as u64 * HDR_STATE_POLL_DELAY_MS, 1200);
    }
}
