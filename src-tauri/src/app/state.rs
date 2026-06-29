use crate::display::{model::BrightnessSource, DisplayInfo};
use std::sync::Mutex;

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct TrayDisplaySummary {
    pub name: String,
    pub brightness: u32,
    pub brightness_source: BrightnessSource,
}

#[derive(Debug, Clone, Default, PartialEq, Eq)]
pub struct TrayState {
    pub displays: Vec<TrayDisplaySummary>,
}

impl TrayState {
    pub fn from_displays(displays: &[DisplayInfo]) -> Self {
        Self {
            displays: displays
                .iter()
                .map(|display| TrayDisplaySummary {
                    name: display.name.clone(),
                    brightness: display.brightness,
                    brightness_source: display.brightness_source,
                })
                .collect(),
        }
    }
}

/// Shared app state holding current display list for tray menu access.
pub struct AppState {
    pub displays: Mutex<Vec<DisplayInfo>>,
    pub tray_state: Mutex<TrayState>,
    /// Whether startup info overlay is showing - prevents blur-to-hide
    pub startup_info_active: Mutex<bool>,
    /// Whether window is being dragged - prevents blur-to-hide during drag
    pub is_dragging: Mutex<bool>,
}

impl Default for AppState {
    fn default() -> Self {
        Self {
            displays: Mutex::new(Vec::new()),
            tray_state: Mutex::new(TrayState::default()),
            startup_info_active: Mutex::new(false),
            is_dragging: Mutex::new(false),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::TrayState;
    use crate::display::{model::BrightnessSource, DisplayInfo};

    #[test]
    fn tray_state_keeps_generic_brightness_fields() {
        let displays = vec![DisplayInfo {
            name: "External DDC".to_string(),
            brightness: 64,
            brightness_source: BrightnessSource::DdcVcp,
            brightness_raw: Some(163),
            brightness_raw_max: Some(100),
            brightness_device_id: "MONITOR#DDC#1".to_string(),
            brightness_vcp_code: Some(0x10),
            fallback_source: None,
            nits: 280,
            min_percentage: 0,
            max_percentage: 100,
            hdr_supported: false,
            hdr_enabled: false,
            adapter_id_low: 1,
            adapter_id_high: 2,
            target_id: 3,
            min_nits: Some(80),
            max_nits: Some(480),
        }];

        let tray_state = TrayState::from_displays(&displays);

        assert_eq!(tray_state.displays.len(), 1);
        assert_eq!(tray_state.displays[0].name, "External DDC");
        assert_eq!(tray_state.displays[0].brightness, 64);
        assert_eq!(
            tray_state.displays[0].brightness_source,
            BrightnessSource::DdcVcp
        );
    }
}
