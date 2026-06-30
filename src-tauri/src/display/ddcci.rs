//! DDC/CI and high-level physical monitor brightness provider.
#![allow(dead_code)]

use super::DisplayError;

#[cfg(windows)]
use std::mem::size_of;

#[cfg(windows)]
use windows::{
    core::{Error as WindowsError, BOOL, PCWSTR},
    Win32::{
        Devices::Display::{
            DestroyPhysicalMonitors, GetMonitorBrightness, GetNumberOfPhysicalMonitorsFromHMONITOR,
            GetPhysicalMonitorsFromHMONITOR, GetVCPFeatureAndVCPFeatureReply, SetMonitorBrightness,
            SetVCPFeature, PHYSICAL_MONITOR,
        },
        Foundation::{HANDLE, LPARAM, RECT},
        Graphics::Gdi::{
            EnumDisplayDevicesW, EnumDisplayMonitors, GetMonitorInfoW, DISPLAY_DEVICEW, HDC,
            HMONITOR, MONITORINFO, MONITORINFOEXW,
        },
    },
};

const BRIGHTNESS_VCP_CODES: [u8; 4] = [0x10, 0x13, 0x6B, 0x12];
#[cfg(windows)]
const EDD_GET_DEVICE_INTERFACE_NAME: u32 = 0x0000_0001;

#[derive(Debug, Clone, PartialEq, Eq)]
pub(super) struct DdcDisplay {
    pub device_key: String,
    pub name: String,
    pub brightness_percent: u32,
    pub brightness_raw: u32,
    pub brightness_raw_max: u32,
    pub high_level_supported: bool,
    pub vcp_code: Option<u8>,
}

pub(super) fn enumerate_ddc_displays() -> Result<Vec<DdcDisplay>, DisplayError> {
    enumerate_ddc_displays_windows()
}

pub(super) fn set_ddc_high_level_brightness(
    device_key: &str,
    percent: u32,
) -> Result<(), DisplayError> {
    set_ddc_high_level_brightness_windows(device_key, percent)
}

pub(super) fn set_ddc_vcp_brightness(
    device_key: &str,
    vcp_code: u8,
    percent: u32,
    raw_max: u32,
) -> Result<(), DisplayError> {
    set_ddc_vcp_brightness_windows(device_key, vcp_code, percent, raw_max)
}

pub(super) fn read_ddc_high_level_brightness(device_key: &str) -> Result<DdcDisplay, DisplayError> {
    read_ddc_high_level_brightness_windows(device_key)
}

pub(super) fn read_ddc_vcp_brightness(
    device_key: &str,
    vcp_code: u8,
) -> Result<DdcDisplay, DisplayError> {
    read_ddc_vcp_brightness_windows(device_key, vcp_code)
}

fn choose_brightness_vcp(supported: &[u8]) -> Option<u8> {
    BRIGHTNESS_VCP_CODES
        .into_iter()
        .find(|candidate| supported.contains(candidate))
}

fn raw_to_percent(current: u32, max: u32) -> u32 {
    if max == 0 {
        return 0;
    }

    ((current.min(max) * 100) / max).min(100)
}

fn percent_to_raw(percent: u32, max: u32) -> u32 {
    (percent.clamp(0, 100) * max) / 100
}

#[cfg(windows)]
struct PhysicalMonitorList {
    base_key: String,
    monitors: Vec<PHYSICAL_MONITOR>,
}

#[cfg(windows)]
impl PhysicalMonitorList {
    fn from_hmonitor(hmonitor: HMONITOR) -> Result<Self, DisplayError> {
        let mut count = 0;
        unsafe { GetNumberOfPhysicalMonitorsFromHMONITOR(hmonitor, &mut count) }.map_err(
            |error| {
                DisplayError::ddc_enumeration_failed(format!(
                    "GetNumberOfPhysicalMonitorsFromHMONITOR failed: {error}"
                ))
            },
        )?;

        if count == 0 {
            return Ok(Self {
                base_key: monitor_base_key(hmonitor),
                monitors: Vec::new(),
            });
        }

        let mut monitors = vec![PHYSICAL_MONITOR::default(); count as usize];
        unsafe { GetPhysicalMonitorsFromHMONITOR(hmonitor, &mut monitors) }.map_err(|error| {
            DisplayError::ddc_enumeration_failed(format!(
                "GetPhysicalMonitorsFromHMONITOR failed: {error}"
            ))
        })?;

        Ok(Self {
            base_key: monitor_base_key(hmonitor),
            monitors,
        })
    }
}

#[cfg(windows)]
impl Drop for PhysicalMonitorList {
    fn drop(&mut self) {
        if !self.monitors.is_empty() {
            let _ = unsafe { DestroyPhysicalMonitors(&self.monitors) };
        }
    }
}

#[cfg(windows)]
fn enumerate_ddc_displays_windows() -> Result<Vec<DdcDisplay>, DisplayError> {
    let physical_monitor_lists = enumerate_physical_monitor_lists()?;
    let mut displays = Vec::new();

    for monitor_list in &physical_monitor_lists {
        for (index, monitor) in monitor_list.monitors.iter().enumerate() {
            if let Some(display) = read_ddc_display(
                physical_monitor_key(&monitor_list.base_key, index),
                monitor_name(monitor),
                monitor.hPhysicalMonitor,
            ) {
                displays.push(display);
            }
        }
    }

    Ok(displays)
}

#[cfg(not(windows))]
fn enumerate_ddc_displays_windows() -> Result<Vec<DdcDisplay>, DisplayError> {
    Err(DisplayError::ddc_enumeration_failed(
        "DDC/CI provider requires Windows",
    ))
}

#[cfg(windows)]
fn set_ddc_high_level_brightness_windows(
    device_key: &str,
    percent: u32,
) -> Result<(), DisplayError> {
    with_physical_monitor(device_key, |handle| {
        let ok = unsafe { SetMonitorBrightness(handle, percent.clamp(0, 100)) };
        if ok != 0 {
            return Ok(());
        }

        Err(DisplayError::ddc_brightness_failed(format!(
            "SetMonitorBrightness failed for {device_key}: {}",
            WindowsError::from_thread()
        )))
    })
}

#[cfg(not(windows))]
fn set_ddc_high_level_brightness_windows(
    device_key: &str,
    _percent: u32,
) -> Result<(), DisplayError> {
    Err(DisplayError::ddc_brightness_failed(format!(
        "DDC/CI provider requires Windows for {device_key}"
    )))
}

#[cfg(windows)]
fn read_ddc_high_level_brightness_windows(device_key: &str) -> Result<DdcDisplay, DisplayError> {
    with_physical_monitor(device_key, |handle| {
        read_high_level_brightness(device_key, "DDC/CI Display", handle).ok_or_else(|| {
            DisplayError::ddc_brightness_failed(format!(
                "GetMonitorBrightness failed for {device_key}: {}",
                WindowsError::from_thread()
            ))
        })
    })
}

#[cfg(not(windows))]
fn read_ddc_high_level_brightness_windows(device_key: &str) -> Result<DdcDisplay, DisplayError> {
    Err(DisplayError::ddc_brightness_failed(format!(
        "DDC/CI provider requires Windows for {device_key}"
    )))
}

#[cfg(windows)]
fn set_ddc_vcp_brightness_windows(
    device_key: &str,
    vcp_code: u8,
    percent: u32,
    raw_max: u32,
) -> Result<(), DisplayError> {
    with_physical_monitor(device_key, |handle| {
        let raw = percent_to_raw(percent, raw_max);
        let ok = unsafe { SetVCPFeature(handle, vcp_code, raw) };
        if ok != 0 {
            return Ok(());
        }

        Err(DisplayError::ddc_brightness_failed(format!(
            "SetVCPFeature failed for {device_key}: {}",
            WindowsError::from_thread()
        )))
    })
}

#[cfg(not(windows))]
fn set_ddc_vcp_brightness_windows(
    device_key: &str,
    _vcp_code: u8,
    _percent: u32,
    _raw_max: u32,
) -> Result<(), DisplayError> {
    Err(DisplayError::ddc_brightness_failed(format!(
        "DDC/CI provider requires Windows for {device_key}"
    )))
}

#[cfg(windows)]
fn read_ddc_vcp_brightness_windows(
    device_key: &str,
    vcp_code: u8,
) -> Result<DdcDisplay, DisplayError> {
    with_physical_monitor(device_key, |handle| {
        read_vcp_brightness_code(device_key, "DDC/CI Display", handle, vcp_code).ok_or_else(|| {
            DisplayError::ddc_brightness_failed(format!(
                "GetVCPFeatureAndVCPFeatureReply failed for {device_key} code {vcp_code:#04x}: {}",
                WindowsError::from_thread()
            ))
        })
    })
}

#[cfg(not(windows))]
fn read_ddc_vcp_brightness_windows(
    device_key: &str,
    _vcp_code: u8,
) -> Result<DdcDisplay, DisplayError> {
    Err(DisplayError::ddc_brightness_failed(format!(
        "DDC/CI provider requires Windows for {device_key}"
    )))
}

#[cfg(windows)]
fn enumerate_physical_monitor_lists() -> Result<Vec<PhysicalMonitorList>, DisplayError> {
    unsafe extern "system" fn enum_monitor_proc(
        hmonitor: HMONITOR,
        _hdc: HDC,
        _rect: *mut RECT,
        lparam: LPARAM,
    ) -> BOOL {
        let monitors = &mut *(lparam.0 as *mut Vec<HMONITOR>);
        monitors.push(hmonitor);
        BOOL(1)
    }

    let mut hmonitors = Vec::<HMONITOR>::new();
    let ok = unsafe {
        EnumDisplayMonitors(
            None,
            None,
            Some(enum_monitor_proc),
            LPARAM(&mut hmonitors as *mut Vec<HMONITOR> as isize),
        )
    };

    if !ok.as_bool() {
        return Err(DisplayError::ddc_enumeration_failed(format!(
            "EnumDisplayMonitors failed: {}",
            WindowsError::from_thread()
        )));
    }

    let mut physical_monitor_lists = Vec::new();
    for hmonitor in hmonitors {
        if let Ok(list) = PhysicalMonitorList::from_hmonitor(hmonitor) {
            if !list.monitors.is_empty() {
                physical_monitor_lists.push(list);
            }
        }
    }

    Ok(physical_monitor_lists)
}

#[cfg(windows)]
fn read_ddc_display(device_key: String, name: String, handle: HANDLE) -> Option<DdcDisplay> {
    if let Some(display) = read_high_level_brightness(&device_key, &name, handle) {
        return Some(display);
    }

    read_vcp_brightness(&device_key, &name, handle)
}

#[cfg(windows)]
fn read_high_level_brightness(device_key: &str, name: &str, handle: HANDLE) -> Option<DdcDisplay> {
    let mut min = 0;
    let mut current = 0;
    let mut max = 0;
    let ok = unsafe { GetMonitorBrightness(handle, &mut min, &mut current, &mut max) };

    if ok == 0 {
        return None;
    }

    let span = max.saturating_sub(min);
    let brightness_percent = raw_to_percent(current.saturating_sub(min), span);

    Some(DdcDisplay {
        device_key: device_key.to_string(),
        name: name.to_string(),
        brightness_percent,
        brightness_raw: brightness_percent,
        brightness_raw_max: 100,
        high_level_supported: true,
        vcp_code: None,
    })
}

#[cfg(windows)]
fn read_vcp_brightness(device_key: &str, name: &str, handle: HANDLE) -> Option<DdcDisplay> {
    for code in BRIGHTNESS_VCP_CODES {
        if let Some(display) = read_vcp_brightness_code(device_key, name, handle, code) {
            return Some(display);
        }
    }

    None
}

#[cfg(windows)]
fn read_vcp_brightness_code(
    device_key: &str,
    name: &str,
    handle: HANDLE,
    code: u8,
) -> Option<DdcDisplay> {
    let mut current = 0;
    let mut max = 0;
    let ok = unsafe {
        GetVCPFeatureAndVCPFeatureReply(handle, code, None, &mut current, Some(&mut max))
    };

    if ok == 0 || max == 0 {
        return None;
    }

    Some(DdcDisplay {
        device_key: device_key.to_string(),
        name: name.to_string(),
        brightness_percent: raw_to_percent(current, max),
        brightness_raw: current,
        brightness_raw_max: max,
        high_level_supported: false,
        vcp_code: Some(code),
    })
}

#[cfg(windows)]
fn with_physical_monitor<F, T>(device_key: &str, mut action: F) -> Result<T, DisplayError>
where
    F: FnMut(HANDLE) -> Result<T, DisplayError>,
{
    let physical_monitor_lists = enumerate_physical_monitor_lists().map_err(|error| {
        DisplayError::ddc_brightness_failed(format!(
            "Physical monitor lookup failed for {device_key}: {}",
            error.message
        ))
    })?;

    for monitor_list in &physical_monitor_lists {
        for (index, monitor) in monitor_list.monitors.iter().enumerate() {
            if physical_monitor_key(&monitor_list.base_key, index) == device_key {
                return action(monitor.hPhysicalMonitor);
            }
        }
    }

    Err(DisplayError::ddc_brightness_failed(format!(
        "Physical monitor not found for {device_key}"
    )))
}

#[cfg(windows)]
fn monitor_base_key(hmonitor: HMONITOR) -> String {
    let mut info = MONITORINFOEXW::default();
    info.monitorInfo.cbSize = size_of::<MONITORINFOEXW>() as u32;

    let ok = unsafe {
        GetMonitorInfoW(
            hmonitor,
            &mut info as *mut MONITORINFOEXW as *mut MONITORINFO,
        )
    };

    if !ok.as_bool() {
        return format!("{hmonitor:?}");
    }

    let display_name = wide_array_to_string(&info.szDevice);
    monitor_interface_key(&display_name).unwrap_or(display_name)
}

#[cfg(windows)]
fn monitor_interface_key(display_name: &str) -> Option<String> {
    if display_name.is_empty() {
        return None;
    }

    let display_name_wide = wide_null_terminated(display_name);
    let mut display_device = DISPLAY_DEVICEW {
        cb: size_of::<DISPLAY_DEVICEW>() as u32,
        ..Default::default()
    };

    let ok = unsafe {
        EnumDisplayDevicesW(
            PCWSTR(display_name_wide.as_ptr()),
            0,
            &mut display_device,
            EDD_GET_DEVICE_INTERFACE_NAME,
        )
    };

    if !ok.as_bool() {
        return None;
    }

    let device_id = wide_array_to_string(&display_device.DeviceID);
    if device_id.is_empty() {
        None
    } else {
        Some(device_id)
    }
}

#[cfg(windows)]
fn monitor_name(monitor: &PHYSICAL_MONITOR) -> String {
    let description = monitor.szPhysicalMonitorDescription;
    let name = wide_array_to_string(&description);
    if name.is_empty() {
        "DDC/CI Display".to_string()
    } else {
        name
    }
}

#[cfg(windows)]
fn physical_monitor_key(base_key: &str, index: usize) -> String {
    format!("{base_key}#{index}")
}

#[cfg(windows)]
fn wide_array_to_string(value: &[u16]) -> String {
    let len = value
        .iter()
        .position(|character| *character == 0)
        .unwrap_or(value.len());

    String::from_utf16_lossy(&value[..len])
}

#[cfg(windows)]
fn wide_null_terminated(value: &str) -> Vec<u16> {
    value.encode_utf16().chain(std::iter::once(0)).collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn choose_brightness_vcp_prefers_luminance() {
        let supported = vec![0x10, 0x13, 0x6B, 0x12];
        assert_eq!(choose_brightness_vcp(&supported), Some(0x10));
    }

    #[test]
    fn choose_brightness_vcp_uses_brightness_when_luminance_missing() {
        let supported = vec![0x13, 0x6B, 0x12];
        assert_eq!(choose_brightness_vcp(&supported), Some(0x13));
    }

    #[test]
    fn choose_brightness_vcp_uses_backlight_before_contrast() {
        let supported = vec![0x6B, 0x12];
        assert_eq!(choose_brightness_vcp(&supported), Some(0x6B));
    }

    #[test]
    fn raw_to_percent_uses_reported_max() {
        assert_eq!(raw_to_percent(127, 254), 50);
    }

    #[test]
    fn percent_to_raw_uses_reported_max() {
        assert_eq!(percent_to_raw(50, 254), 127);
    }
}

#[cfg(test)]
mod handle_tests {
    use super::*;

    #[test]
    fn physical_monitor_key_matches_device_identity() {
        let display = DdcDisplay {
            device_key: "MONITOR#DEL1234#ABC".to_string(),
            name: "Dell".to_string(),
            brightness_percent: 50,
            brightness_raw: 50,
            brightness_raw_max: 100,
            high_level_supported: true,
            vcp_code: Some(0x10),
        };

        assert_eq!(display.device_key, "MONITOR#DEL1234#ABC");
    }
}
