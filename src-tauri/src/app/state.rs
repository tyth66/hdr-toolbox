use crate::display::DisplayInfo;
use std::sync::Mutex;

#[derive(Debug, Clone, Default)]
pub struct TrayDisplaySummary {
    pub name: String,
    pub nits: u32,
}

#[derive(Debug, Clone, Default)]
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
                    nits: display.nits,
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
    use crate::display::DisplayInfo;

    #[test]
    fn tray_state_keeps_only_tray_relevant_display_fields() {
        let displays = vec![DisplayInfo {
            name: "Display A".to_string(),
            nits: 280,
            min_percentage: 0,
            max_percentage: 100,
            hdr_supported: true,
            hdr_enabled: true,
            adapter_id_low: 1,
            adapter_id_high: 2,
            target_id: 3,
            min_nits: Some(80),
            max_nits: Some(480),
        }];

        let tray_state = TrayState::from_displays(&displays);

        assert_eq!(tray_state.displays.len(), 1);
        assert_eq!(tray_state.displays[0].name, "Display A");
        assert_eq!(tray_state.displays[0].nits, 280);
    }
}
