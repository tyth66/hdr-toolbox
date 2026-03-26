//! Windows DisplayConfig API for HDR-SDR brightness control.
//! Implements both GET and SET operations for SDR white level via raw FFI.

use once_cell::sync::Lazy;
use std::sync::atomic::{AtomicBool, Ordering};

use windows::Win32::Devices::Display::{
    DisplayConfigGetDeviceInfo, DisplayConfigSetDeviceInfo, GetDisplayConfigBufferSizes,
    QueryDisplayConfig, DISPLAYCONFIG_DEVICE_INFO_GET_ADVANCED_COLOR_INFO,
    DISPLAYCONFIG_DEVICE_INFO_GET_SDR_WHITE_LEVEL, DISPLAYCONFIG_DEVICE_INFO_GET_TARGET_NAME,
    DISPLAYCONFIG_GET_ADVANCED_COLOR_INFO, DISPLAYCONFIG_GET_ADVANCED_COLOR_INFO_0,
    DISPLAYCONFIG_PATH_INFO, DISPLAYCONFIG_SDR_WHITE_LEVEL, DISPLAYCONFIG_TARGET_DEVICE_NAME,
    QDC_ONLY_ACTIVE_PATHS,
};
use windows::Win32::Foundation::LUID;
use windows::Win32::Graphics::Gdi::DISPLAYCONFIG_COLOR_ENCODING;

static HDR_INFO_DISABLED: Lazy<AtomicBool> = Lazy::new(|| AtomicBool::new(false));

/// SDR white level in nits (not the internal API value)
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct DisplayInfo {
    pub name: String,
    pub nits: u32,
    pub hdr_enabled: bool,
    pub adapter_id_low: i32,
    pub adapter_id_high: i32,
    pub target_id: u32,
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
        return Err("HDR info is disabled due to previous failures".to_string());
    }

    let mut path_count: u32 = 0;
    let mut mode_count: u32 = 0;

    let result = unsafe {
        GetDisplayConfigBufferSizes(QDC_ONLY_ACTIVE_PATHS, &mut path_count, &mut mode_count)
    };
    if result != windows::Win32::Foundation::WIN32_ERROR(0) {
        HDR_INFO_DISABLED.store(true, Ordering::Relaxed);
        return Err(format!("GetDisplayConfigBufferSizes failed: {:#?}", result));
    }

    if path_count == 0 {
        HDR_INFO_DISABLED.store(true, Ordering::Relaxed);
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
        let nits = match get_sdr_white_level_raw(path.targetInfo.adapterId, path.targetInfo.id) {
            Ok(n) => n,
            Err(_) => 1000,
        };

        displays.push(DisplayInfo {
            name: display_name,
            nits,
            hdr_enabled,
            adapter_id_low: path.targetInfo.adapterId.LowPart as i32,
            adapter_id_high: path.targetInfo.adapterId.HighPart as i32,
            target_id: path.targetInfo.id,
        });
    }

    if displays.is_empty() {
        Err("No HDR displays found. Ensure HDR is enabled in Windows Settings.".to_string())
    } else {
        Ok(displays)
    }
}

/// Set SDR brightness for a specific display.
#[tauri::command]
pub fn set_brightness(
    adapter_low: i32,
    adapter_high: i32,
    target_id: u32,
    nits: u32,
) -> Result<(), String> {
    let adapter_id = LUID {
        LowPart: adapter_low as u32,
        HighPart: adapter_high as i32,
    };
    set_sdr_white_level_raw(adapter_id, target_id, nits)
}

/// Set brightness for all HDR displays.
#[tauri::command]
pub fn set_brightness_all(displays: Vec<DisplayInfo>, nits: u32) -> Vec<Result<(), String>> {
    displays
        .into_iter()
        .map(|d| {
            let adapter_id = LUID {
                LowPart: d.adapter_id_low as u32,
                HighPart: d.adapter_id_high as i32,
            };
            set_sdr_white_level_raw(adapter_id, d.target_id, nits)
        })
        .collect()
}
