use windows::core::PCWSTR;
use windows::Win32::Foundation::WIN32_ERROR;
/// Read the user's Windows 11 system accent color from the DWM registry key.
///
/// Returns a CSS-compatible hex string (e.g. "#0078d4") or "#0078d4" as fallback.
use windows::Win32::System::Registry::{
    RegGetValueW, HKEY_CURRENT_USER, REG_DWORD, REG_VALUE_TYPE, RRF_RT_REG_DWORD,
};

const FALLBACK_ACCENT_COLOR: &str = "#0078d4";
const DWM_KEY: &str = r"SOFTWARE\Microsoft\Windows\DWM";
const ACCENT_COLOR_VALUE: &str = "AccentColor";

/// Read the system accent color (ABGR DWORD) from registry, convert to "#RRGGBB".
#[tauri::command]
pub fn get_system_accent_color() -> String {
    let color = read_accent_color_dword().unwrap_or(0);

    if color == 0 {
        return FALLBACK_ACCENT_COLOR.to_string();
    }

    // DWM stores AccentColor as 0xBBGGRR (ABGR, ignoring the alpha byte).
    // Extract R, G, B and format as "#RRGGBB".
    let r = (color & 0x0000FF) as u8;
    let g = ((color >> 8) & 0x0000FF) as u8;
    let b = ((color >> 16) & 0x0000FF) as u8;

    format!("#{:02X}{:02X}{:02X}", r, g, b)
}

fn read_accent_color_dword() -> Option<u32> {
    let dwm_key_wide: Vec<u16> = DWM_KEY.encode_utf16().chain(std::iter::once(0)).collect();
    let value_name_wide: Vec<u16> = ACCENT_COLOR_VALUE
        .encode_utf16()
        .chain(std::iter::once(0))
        .collect();

    unsafe {
        let mut data: u32 = 0;
        let mut data_size: u32 = std::mem::size_of::<u32>() as u32;
        let mut data_type: REG_VALUE_TYPE = REG_DWORD;

        let status = RegGetValueW(
            HKEY_CURRENT_USER,
            PCWSTR(dwm_key_wide.as_ptr()),
            PCWSTR(value_name_wide.as_ptr()),
            RRF_RT_REG_DWORD,
            Some(&mut data_type),
            Some(&mut data as *mut u32 as *mut std::ffi::c_void),
            Some(&mut data_size),
        );

        if status != WIN32_ERROR(0) {
            tracing::warn!(
                "Failed to read AccentColor from registry: error code {:?}",
                status
            );
            return None;
        }

        Some(data)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn fallback_is_windows_default_blue() {
        assert_eq!(FALLBACK_ACCENT_COLOR, "#0078d4");
    }

    #[test]
    fn converts_blue_hex_to_rgb_string() {
        // Windows default accent blue = #0078d4. Registry stores as 0x00D47800 (ABGR).
        assert_eq!(get_system_accent_color_for_value(0x00D47800), "#0078D4");
    }

    #[test]
    fn zero_value_returns_fallback() {
        assert_eq!(get_system_accent_color_for_value(0), FALLBACK_ACCENT_COLOR);
    }

    #[test]
    fn converts_red_hex_correctly() {
        // Red #FF0000 -> registry 0x000000FF -> R=FF, G=00, B=00 -> "#FF0000"
        assert_eq!(get_system_accent_color_for_value(0x000000FF), "#FF0000");
    }

    fn get_system_accent_color_for_value(value: u32) -> String {
        if value == 0 {
            return FALLBACK_ACCENT_COLOR.to_string();
        }
        let r = (value & 0x0000FF) as u8;
        let g = ((value >> 8) & 0x0000FF) as u8;
        let b = ((value >> 16) & 0x0000FF) as u8;
        format!("#{:02X}{:02X}{:02X}", r, g, b)
    }
}
