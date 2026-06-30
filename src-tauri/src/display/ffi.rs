use windows::Win32::Devices::Display::{
    DisplayConfigGetDeviceInfo, DisplayConfigSetDeviceInfo, GetDisplayConfigBufferSizes,
    QueryDisplayConfig, DISPLAYCONFIG_DEVICE_INFO_GET_ADVANCED_COLOR_INFO,
    DISPLAYCONFIG_DEVICE_INFO_GET_SDR_WHITE_LEVEL, DISPLAYCONFIG_DEVICE_INFO_GET_TARGET_NAME,
    DISPLAYCONFIG_DEVICE_INFO_SET_ADVANCED_COLOR_STATE, DISPLAYCONFIG_GET_ADVANCED_COLOR_INFO,
    DISPLAYCONFIG_GET_ADVANCED_COLOR_INFO_0, DISPLAYCONFIG_PATH_INFO,
    DISPLAYCONFIG_SDR_WHITE_LEVEL, DISPLAYCONFIG_SET_ADVANCED_COLOR_STATE,
    DISPLAYCONFIG_TARGET_DEVICE_NAME, QDC_ONLY_ACTIVE_PATHS,
};
use windows::Win32::Foundation::LUID;
use windows::Win32::Graphics::Gdi::DISPLAYCONFIG_COLOR_ENCODING;

use super::{error::DisplayError, model::DisplayInfo};

/// Undocumented Windows DisplayConfig device info type for setting SDR white level.
/// This is a private Microsoft interface type not documented in the official API.
const DISPLAYCONFIG_DEVICE_INFO_SET_SDR_WHITE_LEVEL: i32 = 0xFFFFFFEE_u32 as i32;

/// Advanced color info bits from DISPLAYCONFIG_GET_ADVANCED_COLOR_INFO.
const ADVANCED_COLOR_SUPPORTED_BIT: u32 = 0x1;
const ADVANCED_COLOR_ENABLED_BIT: u32 = 0x2;

#[derive(Clone, Copy, Debug)]
pub(super) struct DisplayPath {
    pub adapter_id: LUID,
    pub adapter_id_low: i32,
    pub adapter_id_high: i32,
    pub target_id: u32,
}

impl DisplayPath {
    fn from_path(path: &DISPLAYCONFIG_PATH_INFO) -> Self {
        Self {
            adapter_id: path.targetInfo.adapterId,
            adapter_id_low: path.targetInfo.adapterId.LowPart as i32,
            adapter_id_high: path.targetInfo.adapterId.HighPart,
            target_id: path.targetInfo.id,
        }
    }
}

#[derive(Clone, Copy, Debug, Default, PartialEq, Eq)]
pub(super) struct AdvancedColorState {
    value: u32,
}

impl AdvancedColorState {
    pub(super) fn is_supported(self) -> bool {
        (self.value & ADVANCED_COLOR_SUPPORTED_BIT) != 0
    }

    pub(super) fn is_enabled(self) -> bool {
        (self.value & ADVANCED_COLOR_ENABLED_BIT) != 0
    }
}

pub(super) fn query_active_display_paths() -> Result<Vec<DisplayPath>, DisplayError> {
    let mut path_count: u32 = 0;
    let mut mode_count: u32 = 0;

    let result = unsafe {
        GetDisplayConfigBufferSizes(QDC_ONLY_ACTIVE_PATHS, &mut path_count, &mut mode_count)
    };
    if result != windows::Win32::Foundation::WIN32_ERROR(0) {
        return Err(DisplayError::api_failed(format!(
            "GetDisplayConfigBufferSizes failed: {:#?}",
            result
        )));
    }

    if path_count == 0 {
        return Err(DisplayError::no_display_paths());
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
        return Err(DisplayError::api_failed(format!(
            "QueryDisplayConfig failed: {:#?}",
            result
        )));
    }

    Ok(paths
        .iter()
        .take(path_count as usize)
        .map(DisplayPath::from_path)
        .collect())
}

pub(super) fn get_display_name(path: DisplayPath) -> String {
    let mut target_name = DISPLAYCONFIG_TARGET_DEVICE_NAME {
        header: windows::Win32::Devices::Display::DISPLAYCONFIG_DEVICE_INFO_HEADER {
            r#type: DISPLAYCONFIG_DEVICE_INFO_GET_TARGET_NAME,
            size: std::mem::size_of::<DISPLAYCONFIG_TARGET_DEVICE_NAME>() as u32,
            adapterId: path.adapter_id,
            id: path.target_id,
        },
        ..Default::default()
    };

    unsafe {
        if DisplayConfigGetDeviceInfo(&mut target_name.header as *mut _ as *mut _) == 0 {
            let name = wide_array_to_string(&target_name.monitorFriendlyDeviceName);
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

pub(super) fn get_display_device_path(path: DisplayPath) -> Option<String> {
    let mut target_name = DISPLAYCONFIG_TARGET_DEVICE_NAME {
        header: windows::Win32::Devices::Display::DISPLAYCONFIG_DEVICE_INFO_HEADER {
            r#type: DISPLAYCONFIG_DEVICE_INFO_GET_TARGET_NAME,
            size: std::mem::size_of::<DISPLAYCONFIG_TARGET_DEVICE_NAME>() as u32,
            adapterId: path.adapter_id,
            id: path.target_id,
        },
        ..Default::default()
    };

    unsafe {
        if DisplayConfigGetDeviceInfo(&mut target_name.header as *mut _ as *mut _) != 0 {
            return None;
        }
    }

    let path = wide_array_to_string(&target_name.monitorDevicePath);
    if path.is_empty() {
        None
    } else {
        Some(path)
    }
}

fn wide_array_to_string(value: &[u16]) -> String {
    let len = value
        .iter()
        .position(|character| *character == 0)
        .unwrap_or(value.len());

    String::from_utf16_lossy(&value[..len])
}

pub(super) fn get_advanced_color_info(path: DisplayPath) -> AdvancedColorState {
    let mut advanced_color = DISPLAYCONFIG_GET_ADVANCED_COLOR_INFO {
        header: windows::Win32::Devices::Display::DISPLAYCONFIG_DEVICE_INFO_HEADER {
            r#type: DISPLAYCONFIG_DEVICE_INFO_GET_ADVANCED_COLOR_INFO,
            size: std::mem::size_of::<DISPLAYCONFIG_GET_ADVANCED_COLOR_INFO>() as u32,
            adapterId: path.adapter_id,
            id: path.target_id,
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

pub(super) fn get_sdr_white_level_raw(
    adapter_id: LUID,
    target_id: u32,
) -> Result<u32, DisplayError> {
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
            Err(DisplayError::sdr_white_level_failed(format!(
                "DisplayConfigGetDeviceInfo(GET_SDR_WHITE_LEVEL) failed: {}",
                result
            )))
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
) -> Result<(), DisplayError> {
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
            Err(DisplayError::sdr_white_level_failed(format!(
                "DisplayConfigSetDeviceInfo(SET_SDR_WHITE_LEVEL) failed: {}",
                result
            )))
        }
    }
}

pub(super) fn set_advanced_color_state(
    adapter_id: LUID,
    target_id: u32,
    enabled: bool,
) -> Result<(), DisplayError> {
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
            Err(DisplayError::hdr_toggle_failed(format!(
                "DisplayConfigSetDeviceInfo(SET_ADVANCED_COLOR_STATE) failed: {}",
                result
            )))
        }
    }
}

#[cfg(test)]
mod tests {
    use super::AdvancedColorState;

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
        let enabled_only = AdvancedColorState { value: 0x2 };
        assert!(!enabled_only.is_supported());
        assert!(enabled_only.is_enabled());

        let with_extra_bits = AdvancedColorState { value: 0xF };
        assert!(with_extra_bits.is_supported());
        assert!(with_extra_bits.is_enabled());
    }
}
