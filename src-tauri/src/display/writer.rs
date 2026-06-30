use windows::Win32::Foundation::LUID;

use super::{
    ddcci,
    ffi::set_sdr_white_level_raw,
    model::{BrightnessSource, DisplayInfo},
    wmi, DisplayError,
};

pub(super) fn set_display_brightness(
    display: &DisplayInfo,
    percentage: u32,
) -> Result<(), DisplayError> {
    let percentage = percentage.clamp(0, 100);

    match display.brightness_source {
        BrightnessSource::HdrSdr => {
            let adapter_id = LUID {
                LowPart: display.adapter_id_low as u32,
                HighPart: display.adapter_id_high,
            };
            let nits = super::brightness::percent_to_sdr_nits(percentage);
            set_sdr_white_level_raw(adapter_id, display.target_id, nits)
        }
        BrightnessSource::DdcHighLevel => {
            ddcci::set_ddc_high_level_brightness(&display.brightness_device_id, percentage)
        }
        BrightnessSource::DdcVcp => {
            let vcp_code = display.brightness_vcp_code.ok_or_else(|| {
                DisplayError::ddc_brightness_failed(format!(
                    "Missing DDC VCP code for {}",
                    display.brightness_device_id
                ))
            })?;
            let vcp_code = u8::try_from(vcp_code).map_err(|_| {
                DisplayError::ddc_brightness_failed(format!(
                    "Invalid DDC VCP code {vcp_code} for {}",
                    display.brightness_device_id
                ))
            })?;
            ddcci::set_ddc_vcp_brightness(
                &display.brightness_device_id,
                vcp_code,
                percentage,
                display.brightness_raw_max.unwrap_or(100),
            )
        }
        BrightnessSource::Wmi => wmi::set_wmi_brightness(&display.brightness_device_id, percentage),
    }
}

pub(super) fn set_brightness_all(
    displays: Vec<DisplayInfo>,
    percentage: u32,
) -> Vec<Result<(), DisplayError>> {
    displays
        .iter()
        .map(|display| set_display_brightness(display, percentage))
        .collect()
}
