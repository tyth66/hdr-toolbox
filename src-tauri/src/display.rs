//! Windows DisplayConfig API for HDR-SDR brightness control.
//! Implements both GET and SET operations for SDR white level via raw FFI.

use once_cell::sync::Lazy;
use std::sync::atomic::{AtomicBool, AtomicUsize, Ordering};

use windows::Win32::Devices::Display::{
    DisplayConfigGetDeviceInfo, DisplayConfigSetDeviceInfo, GetDisplayConfigBufferSizes,
    GetNumberOfPhysicalMonitorsFromHMONITOR, GetPhysicalMonitorsFromHMONITOR,
    QueryDisplayConfig, DISPLAYCONFIG_DEVICE_INFO_GET_ADVANCED_COLOR_INFO,
    DISPLAYCONFIG_DEVICE_INFO_GET_SDR_WHITE_LEVEL, DISPLAYCONFIG_DEVICE_INFO_GET_TARGET_NAME,
    DISPLAYCONFIG_GET_ADVANCED_COLOR_INFO, DISPLAYCONFIG_GET_ADVANCED_COLOR_INFO_0,
    DISPLAYCONFIG_PATH_INFO, DISPLAYCONFIG_SDR_WHITE_LEVEL, DISPLAYCONFIG_TARGET_DEVICE_NAME,
    QDC_ONLY_ACTIVE_PATHS, PHYSICAL_MONITOR,
};
use windows::Win32::Devices::Display::GetMonitorBrightness;
use windows::Win32::Foundation::{HWND, LUID};
use windows::Win32::Graphics::Gdi::{
    DISPLAYCONFIG_COLOR_ENCODING, HMONITOR,
    MONITOR_DEFAULTTONEAREST, MonitorFromWindow,
};
// WinRT imports for DisplayMonitor EDID luminance
use windows::Devices::Display::DisplayMonitor;
use windows::Devices::Enumeration::DeviceInformation;

static HDR_INFO_DISABLED: Lazy<AtomicBool> = Lazy::new(|| AtomicBool::new(false));
/// Consecutive failure counter — resets to 0 on success, disables after 3 consecutive failures
static HDR_CONSECUTIVE_FAILURES: Lazy<AtomicUsize> = Lazy::new(|| AtomicUsize::new(0));
const MAX_CONSECUTIVE_FAILURES: usize = 3;

/// SDR white level in nits (not the internal API value)
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct DisplayInfo {
    pub name: String,
    pub nits: u32,
    pub min_percentage: u32,  // From GetMonitorBrightness (0-100), default 0
    pub max_percentage: u32,  // From GetMonitorBrightness (0-100), default 100
    pub hdr_enabled: bool,
    pub adapter_id_low: i32,
    pub adapter_id_high: i32,
    pub target_id: u32,
    // EDID luminance range from DisplayMonitor (nits), if available
    pub min_nits: Option<u32>,
    pub max_nits: Option<u32>,
}

impl DisplayInfo {
    /// Convert nits to the internal API value: nits * 1000 / 80
    fn nits_to_api_value(nits: u32) -> u32 {
        nits.saturating_mul(1000) / 80
    }

    /// Convert internal API value to nits: SDRWhiteLevel * 80 / 1000
    fn api_value_to_nits(value: u32) -> u32 {
        value.saturating_mul(80) / 1000
    }
}

/// Get brightness range from physical monitor using MCCS (Monitor Control Command Set).
/// Returns min/max/current brightness as percentages (0-100).
/// Returns None if the monitor doesn't support this capability.
fn get_brightness_range_from_physical_monitor(
    hmonitor: HMONITOR,
) -> Option<(u32, u32, u32)> {
    unsafe {
        // First get the number of physical monitors
        let mut count: u32 = 0;
        if GetNumberOfPhysicalMonitorsFromHMONITOR(hmonitor, &mut count).is_err() || count == 0 {
            tracing::warn!("GetNumberOfPhysicalMonitorsFromHMONITOR failed or returned 0");
            return None;
        }

        // Get the physical monitors
        let mut monitors: Vec<PHYSICAL_MONITOR> = vec![std::mem::zeroed(); count as usize];
        if GetPhysicalMonitorsFromHMONITOR(hmonitor, &mut monitors).is_err() {
            tracing::warn!("GetPhysicalMonitorsFromHMONITOR failed");
            return None;
        }

        // Get brightness for the first physical monitor
        let monitor = &monitors[0];
        let mut min_brightness: u32 = 0;
        let mut current_brightness: u32 = 0;
        let mut max_brightness: u32 = 0;

        // Note: GetMonitorBrightness returns percentages (0-100)
        // It takes raw pointers, returns 1 (TRUE) on success, 0 (FALSE) on failure
        let result = GetMonitorBrightness(
            monitor.hPhysicalMonitor,
            &mut min_brightness,
            &mut current_brightness,
            &mut max_brightness,
        );

        if result == 0 {
            tracing::warn!("GetMonitorBrightness failed");
            return None;
        }

        tracing::info!(
            "Monitor brightness range: min={}, current={}, max={}",
            min_brightness,
            current_brightness,
            max_brightness
        );

        Some((min_brightness, current_brightness, max_brightness))
    }
}

/// Get EDID luminance range for all displays via WinRT DisplayMonitor API.
/// Returns a vector of (device_name, min_nits, max_nits) tuples.
/// Uses windows-future's join() for synchronous blocking on IAsyncOperation.
/// Returns empty vector if no luminance data is available or on error.
fn get_edid_luminance_all() -> Vec<(String, Option<u32>, Option<u32>)> {
    // Get the DisplayMonitor device interface class GUID for filtering
    let selector = match DisplayMonitor::GetDeviceSelector() {
        Ok(s) => s,
        Err(e) => {
            tracing::warn!("DisplayMonitor::GetDeviceSelector failed: {:?}", e);
            return Vec::new();
        }
    };

    // Enumerate devices using FindAllAsync with the AQS selector
    // In windows-rs 0.62, FindAllAsync takes an AQS string argument
    let device_collection = match DeviceInformation::FindAllAsyncAqsFilter(&selector)
        .and_then(|op| op.join())
    {
        Ok(dc) => dc,
        Err(e) => {
            tracing::warn!("DeviceInformation::FindAllAsyncAqsFilter failed: {:?}", e);
            return Vec::new();
        }
    };

    let mut results = Vec::new();
    let size = match device_collection.Size() {
        Ok(s) => s,
        Err(e) => {
            tracing::warn!("Failed to get device collection size: {:?}", e);
            return Vec::new();
        }
    };

    for i in 0..size {
        let device_info = match device_collection.GetAt(i) {
            Ok(info) => info,
            Err(_) => continue,
        };

        let device_id = match device_info.Id() {
            Ok(id) => id,
            Err(_) => continue,
        };

        let device_name = match device_info.Name() {
            Ok(name) => name.to_string(),
            Err(_) => continue,
        };

        // Get DisplayMonitor from device ID
        let monitor = match DisplayMonitor::FromIdAsync(&device_id)
            .and_then(|op| op.join())
        {
            Ok(m) => m,
            Err(e) => {
                tracing::debug!("DisplayMonitor::FromIdAsync failed for {}: {:?}", device_name, e);
                continue;
            }
        };

        // Read luminance values from EDID
        let min_nits = monitor.MinLuminanceInNits().ok().map(|v| v as u32);
        let max_nits = monitor.MaxLuminanceInNits().ok().map(|v| v as u32);

        if let (Some(min), Some(max)) = (min_nits, max_nits) {
            tracing::info!(
                "EDID luminance for {}: {}-{} nits",
                device_name,
                min,
                max
            );
        } else {
            tracing::warn!(
                "EDID luminance not available for {}",
                device_name
            );
        }

        results.push((device_name, min_nits, max_nits));
    }

    results
}

/// Get HMONITOR from an LUID and target ID.
/// This requires enumerating displays, which is expensive, so we use a simpler approach
/// based on the fact that for our use case (HDR brightness), we can use the default monitor.
fn get_hmonitor_for_display(_adapter_id: LUID, _target_id: u32) -> Option<HMONITOR> {
    // For simplicity, we get the primary monitor.
    // In a full implementation, we'd enumerate all monitors and match by LUID.
    // Note: MonitorFromWindow with NULL HWND returns the primary monitor
    let hmonitor = unsafe { MonitorFromWindow(HWND::default(), MONITOR_DEFAULTTONEAREST) };
    if hmonitor.0 == std::ptr::null_mut() {
        None
    } else {
        Some(hmonitor)
    }
}

/// Get SDR white level for a specific adapter + target.
fn get_sdr_white_level_raw(adapter_id: LUID, target_id: u32) -> Result<u32, String> {
    let mut sdr_info = DISPLAYCONFIG_SDR_WHITE_LEVEL {
        header: windows::Win32::Devices::Display::DISPLAYCONFIG_DEVICE_INFO_HEADER {
            r#type: DISPLAYCONFIG_DEVICE_INFO_GET_SDR_WHITE_LEVEL,
            size: std::mem::size_of::<DISPLAYCONFIG_SDR_WHITE_LEVEL>() as u32,
            adapterId: adapter_id,
            id: target_id,
        },
        SDRWhiteLevel: 0,
    };

    unsafe {
        let result = DisplayConfigGetDeviceInfo(
            &mut sdr_info.header as *mut _
                as *mut windows::Win32::Devices::Display::DISPLAYCONFIG_DEVICE_INFO_HEADER,
        );
        if result == 0 {
            Ok(DisplayInfo::api_value_to_nits(sdr_info.SDRWhiteLevel))
        } else {
            Err(format!(
                "DisplayConfigGetDeviceInfo(GET_SDR_WHITE_LEVEL) failed: {}",
                result
            ))
        }
    }
}

/// Undocumented SET_SDR_WHITE_LEVEL struct (3 fields, unlike the documented GET version which has 2).
/// The extra `finalValue` field must be set to 1 for the change to take effect.
/// See: https://stackoverflow.com/questions/74594751/controlling-sdr-content-brightness-programmatically-in-windows-11
#[repr(C)]
struct DISPLAYCONFIG_SET_SDR_WHITE_LEVEL {
    header: windows::Win32::Devices::Display::DISPLAYCONFIG_DEVICE_INFO_HEADER,
    sdrwhite_level: u32,
    final_value: u8, // Must be 1, otherwise the brightness won't change
}

/// Set SDR white level for a specific adapter + target.
fn set_sdr_white_level_raw(adapter_id: LUID, target_id: u32, nits: u32) -> Result<(), String> {
    // Clamp: 80-480 nits, must be multiple of 4
    let nits = ((nits.clamp(80, 480) + 3) / 4) * 4;
    let api_value = DisplayInfo::nits_to_api_value(nits);

    let mut set_params = DISPLAYCONFIG_SET_SDR_WHITE_LEVEL {
        header: windows::Win32::Devices::Display::DISPLAYCONFIG_DEVICE_INFO_HEADER {
            r#type: windows::Win32::Devices::Display::DISPLAYCONFIG_DEVICE_INFO_TYPE(
                0xFFFFFFEE_u32 as i32, // DISPLAYCONFIG_DEVICE_INFO_SET_SDR_WHITE_LEVEL (undocumented)
            ),
            size: std::mem::size_of::<DISPLAYCONFIG_SET_SDR_WHITE_LEVEL>() as u32,
            adapterId: adapter_id,
            id: target_id,
        },
        sdrwhite_level: api_value,
        final_value: 1, // Critical: must be 1 for the brightness change to take effect
    };

    unsafe {
        let result = DisplayConfigSetDeviceInfo(
            &mut set_params.header as *mut _
                as *mut windows::Win32::Devices::Display::DISPLAYCONFIG_DEVICE_INFO_HEADER,
        );
        if result == 0 {
            Ok(())
        } else {
            Err(format!(
                "DisplayConfigSetDeviceInfo(SET_SDR_WHITE_LEVEL) failed: {}",
                result
            ))
        }
    }
}

/// Enumerate all HDR displays and get their current brightness.
#[tauri::command]
pub fn get_hdr_displays() -> Result<Vec<DisplayInfo>, String> {
    if HDR_INFO_DISABLED.load(Ordering::Relaxed) {
        return Err("HDR info is disabled due to repeated failures. Restart the app to retry.".to_string());
    }

    let mut path_count: u32 = 0;
    let mut mode_count: u32 = 0;

    let result = unsafe {
        GetDisplayConfigBufferSizes(QDC_ONLY_ACTIVE_PATHS, &mut path_count, &mut mode_count)
    };
    if result != windows::Win32::Foundation::WIN32_ERROR(0) {
        let failures = HDR_CONSECUTIVE_FAILURES.fetch_add(1, Ordering::Relaxed) + 1;
        if failures >= MAX_CONSECUTIVE_FAILURES {
            HDR_INFO_DISABLED.store(true, Ordering::Relaxed);
            tracing::error!("HDR disabled after {} consecutive failures", failures);
        }
        return Err(format!("GetDisplayConfigBufferSizes failed: {:#?}", result));
    }

    if path_count == 0 {
        let failures = HDR_CONSECUTIVE_FAILURES.fetch_add(1, Ordering::Relaxed) + 1;
        if failures >= MAX_CONSECUTIVE_FAILURES {
            HDR_INFO_DISABLED.store(true, Ordering::Relaxed);
            tracing::error!("HDR disabled after {} consecutive failures", failures);
        }
        return Err("No display paths found".to_string());
    }

    // Success — reset failure counter
    HDR_CONSECUTIVE_FAILURES.store(0, Ordering::Relaxed);

    // Get EDID luminance range from WinRT DisplayMonitor API
    let edid_luminance: std::collections::HashMap<String, (Option<u32>, Option<u32>)> =
        get_edid_luminance_all()
            .into_iter()
            .map(|(name, min, max)| (name, (min, max)))
            .collect();

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
        HDR_INFO_DISABLED.store(true, Ordering::Relaxed);
        return Err(format!("QueryDisplayConfig failed: {:#?}", result));
    }

    let mut displays = Vec::new();

    for i in 0..path_count as usize {
        let path = paths[i];

        // Get display name (monitor friendly name)
        let mut target_name = DISPLAYCONFIG_TARGET_DEVICE_NAME {
            header: windows::Win32::Devices::Display::DISPLAYCONFIG_DEVICE_INFO_HEADER {
                r#type: DISPLAYCONFIG_DEVICE_INFO_GET_TARGET_NAME,
                size: std::mem::size_of::<DISPLAYCONFIG_TARGET_DEVICE_NAME>() as u32,
                adapterId: path.targetInfo.adapterId,
                id: path.targetInfo.id,
            },
            ..Default::default()
        };

        let display_name = unsafe {
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
        };

        // Get HDR enabled status
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

        let hdr_enabled = unsafe {
            if DisplayConfigGetDeviceInfo(&mut advanced_color.header as *mut _ as *mut _) == 0 {
                (advanced_color.Anonymous.value & 0x2) != 0
            } else {
                false
            }
        };

        // Skip non-HDR displays
        if !hdr_enabled {
            continue;
        }

        // Get current SDR white level
        // Fallback to 1000 nits (mid-range) if reading fails — this is an approximation
        // since 80-480 nits range maps to percentage values that should be readable
        let nits = match get_sdr_white_level_raw(path.targetInfo.adapterId, path.targetInfo.id) {
            Ok(n) => n,
            Err(_) => 1000,
        };

        // Get brightness range from MCCS API (percentages 0-100)
        // This may fail if the monitor doesn't support MCCS
        let brightness_range = get_hmonitor_for_display(path.targetInfo.adapterId, path.targetInfo.id)
            .and_then(get_brightness_range_from_physical_monitor);

        let (min_percentage, max_percentage) = brightness_range
            .map(|(min, _current, max)| (min, max))
            .unwrap_or((0, 100));

        // Get EDID luminance range for this display (matched by name)
        let (min_nits, max_nits) = edid_luminance
            .get(&display_name)
            .copied()
            .unwrap_or((None, None));

        if let (Some(min), Some(max)) = (min_nits, max_nits) {
            tracing::info!(
                "Display '{}' brightness range: {}-{} nits (from EDID)",
                display_name,
                min,
                max
            );
        } else {
            tracing::warn!(
                "Display '{}' EDID luminance unavailable, using fallback 80-480 nits",
                display_name
            );
        }

        displays.push(DisplayInfo {
            name: display_name,
            nits,
            min_percentage,
            max_percentage,
            hdr_enabled,
            adapter_id_low: path.targetInfo.adapterId.LowPart as i32,
            adapter_id_high: path.targetInfo.adapterId.HighPart as i32,
            target_id: path.targetInfo.id,
            min_nits,
            max_nits,
        });
    }

    if displays.is_empty() {
        Err("No HDR displays found. Ensure HDR is enabled in Windows Settings.".to_string())
    } else {
        Ok(displays)
    }
}

/// Set SDR brightness for a specific display.
/// Accepts percentage (0-100) and converts to nits using the display's min/max range.
#[tauri::command]
pub fn set_brightness(
    adapter_low: i32,
    adapter_high: i32,
    target_id: u32,
    percentage: u32,
    min_nits: u32,
    max_nits: u32,
) -> Result<(), String> {
    let adapter_id = LUID {
        LowPart: adapter_low as u32,
        HighPart: adapter_high as i32,
    };
    // Convert percentage (0-100) to nits
    let nits = ((percentage.clamp(0, 100) * (max_nits - min_nits)) / 100) + min_nits;
    set_sdr_white_level_raw(adapter_id, target_id, nits)
}

/// Set brightness for all HDR displays.
/// Accepts percentage (0-100) and converts to nits.
/// Uses EDID luminance range from DisplayInfo if available, otherwise falls back to 80-480 nits.
#[tauri::command]
pub fn set_brightness_all(displays: Vec<DisplayInfo>, percentage: u32) -> Vec<Result<(), String>> {
    // Standard fallback nits range if EDID data is not available
    const FALLBACK_MIN_NITS: u32 = 80;
    const FALLBACK_MAX_NITS: u32 = 480;

    displays
        .into_iter()
        .map(|d| {
            let adapter_id = LUID {
                LowPart: d.adapter_id_low as u32,
                HighPart: d.adapter_id_high as i32,
            };
            // Use EDID range if available, otherwise fallback to standard range
            let (min_nits, max_nits) = match (d.min_nits, d.max_nits) {
                (Some(min), Some(max)) if min > 0 && max > min => (min, max),
                _ => (FALLBACK_MIN_NITS, FALLBACK_MAX_NITS),
            };
            let nits = ((percentage.clamp(0, 100) * (max_nits - min_nits)) / 100) + min_nits;
            set_sdr_white_level_raw(adapter_id, d.target_id, nits)
        })
        .collect()
}
