use once_cell::sync::Lazy;
use std::sync::atomic::{AtomicBool, AtomicUsize, Ordering};
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
    set_sdr_white_level_raw,
};
use super::model::{luminance, DisplayInfo};

static HDR_INFO_DISABLED: Lazy<AtomicBool> = Lazy::new(|| AtomicBool::new(false));
static HDR_CONSECUTIVE_FAILURES: Lazy<AtomicUsize> = Lazy::new(|| AtomicUsize::new(0));
const MAX_CONSECUTIVE_FAILURES: usize = 3;

pub(super) fn get_hdr_displays_impl() -> Result<Vec<DisplayInfo>, String> {
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

    HDR_CONSECUTIVE_FAILURES.store(0, Ordering::Relaxed);
    HDR_INFO_DISABLED.store(false, Ordering::Relaxed);

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
        let failures = HDR_CONSECUTIVE_FAILURES.fetch_add(1, Ordering::Relaxed) + 1;
        if failures >= MAX_CONSECUTIVE_FAILURES {
            HDR_INFO_DISABLED.store(true, Ordering::Relaxed);
            tracing::error!("HDR disabled after {} consecutive failures", failures);
        }
        return Err(format!("QueryDisplayConfig failed: {:#?}", result));
    }

    let mut displays = Vec::new();

    for i in 0..path_count as usize {
        let path = paths[i];
        let display_name = get_display_name(path);
        let hdr_enabled = is_hdr_enabled(path);

        if !hdr_enabled {
            continue;
        }

        let nits = match get_sdr_white_level_raw(path.targetInfo.adapterId, path.targetInfo.id) {
            Ok(n) => n,
            Err(e) => {
                tracing::warn!(
                    "Failed to read SDR white level for '{}': {}; using fallback {} nits",
                    display_name,
                    e,
                    luminance::DEFAULT_NITS
                );
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
        HighPart: adapter_high as i32,
    };
    let nits =
        ((percentage.clamp(0, 100) * (max_nits.saturating_sub(min_nits))) / 100) + min_nits;
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
                HighPart: display.adapter_id_high as i32,
            };
            let (min_nits, max_nits) = (
                display.min_nits.unwrap_or(80),
                display.max_nits.unwrap_or(480),
            );
            let nits =
                ((percentage.clamp(0, 100) * (max_nits.saturating_sub(min_nits))) / 100)
                    + min_nits;
            set_sdr_white_level_raw(adapter_id, display.target_id, nits)
        })
        .collect()
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

fn is_hdr_enabled(path: DISPLAYCONFIG_PATH_INFO) -> bool {
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
            (advanced_color.Anonymous.value & 0x2) != 0
        } else {
            false
        }
    }
}
