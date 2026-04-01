use windows::Win32::Devices::Display::GetMonitorBrightness;
use windows::Win32::Devices::Display::{
    DestroyPhysicalMonitors, DisplayConfigGetDeviceInfo, DisplayConfigSetDeviceInfo,
    GetDisplayConfigBufferSizes, GetNumberOfPhysicalMonitorsFromHMONITOR,
    GetPhysicalMonitorsFromHMONITOR, QueryDisplayConfig,
    DISPLAYCONFIG_DEVICE_INFO_SET_ADVANCED_COLOR_STATE,
    DISPLAYCONFIG_DEVICE_INFO_GET_SDR_WHITE_LEVEL, DISPLAYCONFIG_PATH_INFO,
    DISPLAYCONFIG_SDR_WHITE_LEVEL, DISPLAYCONFIG_SET_ADVANCED_COLOR_STATE, PHYSICAL_MONITOR,
    QDC_ONLY_ACTIVE_PATHS,
};
use windows::Win32::Foundation::{HWND, LUID};
use windows::Win32::Graphics::Gdi::{HMONITOR, MONITOR_DEFAULTTONEAREST, MonitorFromWindow};

use super::model::DisplayInfo;

/// Undocumented Windows DisplayConfig device info type for setting SDR white level.
/// This is a private Microsoft interface type not documented in the official API.
const DISPLAYCONFIG_DEVICE_INFO_SET_SDR_WHITE_LEVEL: i32 = 0xFFFFFFEE_u32 as i32;

pub(super) fn get_brightness_range_from_physical_monitor(
    hmonitor: HMONITOR,
) -> Option<(u32, u32, u32)> {
    unsafe {
        let mut count: u32 = 0;
        if GetNumberOfPhysicalMonitorsFromHMONITOR(hmonitor, &mut count).is_err() || count == 0 {
            tracing::warn!("GetNumberOfPhysicalMonitorsFromHMONITOR failed or returned 0");
            return None;
        }

        let mut monitors: Vec<PHYSICAL_MONITOR> = vec![std::mem::zeroed(); count as usize];
        if GetPhysicalMonitorsFromHMONITOR(hmonitor, &mut monitors).is_err() {
            tracing::warn!("GetPhysicalMonitorsFromHMONITOR failed");
            return None;
        }

        let monitor = &monitors[0];
        let mut min_brightness: u32 = 0;
        let mut current_brightness: u32 = 0;
        let mut max_brightness: u32 = 0;

        let result = GetMonitorBrightness(
            monitor.hPhysicalMonitor,
            &mut min_brightness,
            &mut current_brightness,
            &mut max_brightness,
        );

        let brightness = if result == 0 {
            tracing::warn!("GetMonitorBrightness failed");
            None
        } else {
            tracing::info!(
                "Monitor brightness range: min={}, current={}, max={}",
                min_brightness,
                current_brightness,
                max_brightness
            );
            Some((min_brightness, current_brightness, max_brightness))
        };

        if let Err(e) = DestroyPhysicalMonitors(&monitors) {
            tracing::warn!("DestroyPhysicalMonitors failed: {}", e);
        }

        brightness
    }
}

pub(super) fn get_hmonitor_for_display(_adapter_id: LUID, _target_id: u32) -> Option<HMONITOR> {
    let mut path_count: u32 = 0;
    let mut mode_count: u32 = 0;

    unsafe {
        if GetDisplayConfigBufferSizes(QDC_ONLY_ACTIVE_PATHS, &mut path_count, &mut mode_count)
            != windows::Win32::Foundation::WIN32_ERROR(0)
        {
            tracing::warn!("GetDisplayConfigBufferSizes failed, using primary monitor");
            return get_primary_hmonitor();
        }

        if path_count == 0 {
            return get_primary_hmonitor();
        }

        let mut paths = vec![DISPLAYCONFIG_PATH_INFO::default(); path_count as usize];
        let mut modes = vec![
            windows::Win32::Devices::Display::DISPLAYCONFIG_MODE_INFO::default();
            mode_count as usize
        ];

        if QueryDisplayConfig(
            QDC_ONLY_ACTIVE_PATHS,
            &mut path_count,
            paths.as_mut_ptr(),
            &mut mode_count,
            modes.as_mut_ptr(),
            None,
        ) != windows::Win32::Foundation::WIN32_ERROR(0)
        {
            tracing::warn!("QueryDisplayConfig failed, using primary monitor");
            return get_primary_hmonitor();
        }

        // Note: There is no direct Windows API to obtain HMONITOR from adapter LUID + target ID.
        // QueryDisplayConfig returns paths with adapter/target IDs, but HMONITOR must be
        // obtained via MonitorFromWindow with an HWND. For multi-monitor setups where we need
        // the specific monitor for a given adapter/target, we fall back to the primary monitor.
        // This is a known limitation of the Windows DisplayConfig API.
        tracing::debug!("QueryDisplayConfig found {} paths, using primary monitor for brightness range", path_count);
        get_primary_hmonitor()
    }
}

fn get_primary_hmonitor() -> Option<HMONITOR> {
    let hmonitor = unsafe { MonitorFromWindow(HWND::default(), MONITOR_DEFAULTTONEAREST) };
    if hmonitor.0.is_null() {
        None
    } else {
        Some(hmonitor)
    }
}

pub(super) fn get_sdr_white_level_raw(adapter_id: LUID, target_id: u32) -> Result<u32, String> {
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
        let result = DisplayConfigGetDeviceInfo(&mut sdr_info.header);
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

#[repr(C)]
struct DISPLAYCONFIG_SET_SDR_WHITE_LEVEL {
    header: windows::Win32::Devices::Display::DISPLAYCONFIG_DEVICE_INFO_HEADER,
    sdrwhite_level: u32,
    final_value: u8,
}

pub(super) fn set_sdr_white_level_raw(
    adapter_id: LUID,
    target_id: u32,
    nits: u32,
) -> Result<(), String> {
    let nits = nits.clamp(80, 480).div_ceil(4) * 4;
    let api_value = DisplayInfo::nits_to_api_value(nits);

    let set_params = DISPLAYCONFIG_SET_SDR_WHITE_LEVEL {
        header: windows::Win32::Devices::Display::DISPLAYCONFIG_DEVICE_INFO_HEADER {
            r#type: windows::Win32::Devices::Display::DISPLAYCONFIG_DEVICE_INFO_TYPE(
                DISPLAYCONFIG_DEVICE_INFO_SET_SDR_WHITE_LEVEL,
            ),
            size: std::mem::size_of::<DISPLAYCONFIG_SET_SDR_WHITE_LEVEL>() as u32,
            adapterId: adapter_id,
            id: target_id,
        },
        sdrwhite_level: api_value,
        final_value: 1,
    };

    unsafe {
        let result = DisplayConfigSetDeviceInfo(&set_params.header);
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

pub(super) fn set_advanced_color_state(
    adapter_id: LUID,
    target_id: u32,
    enabled: bool,
) -> Result<(), String> {
    let set_params = DISPLAYCONFIG_SET_ADVANCED_COLOR_STATE {
        header: windows::Win32::Devices::Display::DISPLAYCONFIG_DEVICE_INFO_HEADER {
            r#type: DISPLAYCONFIG_DEVICE_INFO_SET_ADVANCED_COLOR_STATE,
            size: std::mem::size_of::<DISPLAYCONFIG_SET_ADVANCED_COLOR_STATE>() as u32,
            adapterId: adapter_id,
            id: target_id,
        },
        Anonymous: windows::Win32::Devices::Display::DISPLAYCONFIG_SET_ADVANCED_COLOR_STATE_0 {
            value: if enabled { 1 } else { 0 },
        },
    };

    unsafe {
        let result = DisplayConfigSetDeviceInfo(&set_params.header);
        if result == 0 {
            Ok(())
        } else {
            Err(format!(
                "DisplayConfigSetDeviceInfo(SET_ADVANCED_COLOR_STATE) failed: {}",
                result
            ))
        }
    }
}
