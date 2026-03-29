use super::model::DisplayInfo;
use super::service::{
    get_hdr_displays_impl, set_brightness_all_impl, set_brightness_impl,
};

#[tauri::command]
pub fn get_hdr_displays() -> Result<Vec<DisplayInfo>, String> {
    get_hdr_displays_impl()
}

#[tauri::command]
pub fn set_brightness(
    adapter_low: i32,
    adapter_high: i32,
    target_id: u32,
    percentage: u32,
    min_nits: u32,
    max_nits: u32,
) -> Result<(), String> {
    set_brightness_impl(
        adapter_low,
        adapter_high,
        target_id,
        percentage,
        min_nits,
        max_nits,
    )
}

#[tauri::command]
pub fn set_brightness_all(
    displays: Vec<DisplayInfo>,
    percentage: u32,
) -> Vec<Result<(), String>> {
    set_brightness_all_impl(displays, percentage)
}
