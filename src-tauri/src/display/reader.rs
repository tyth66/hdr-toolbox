use windows::Win32::Foundation::LUID;

use super::{
    brightness::sdr_nits_to_percent,
    ddcci,
    ffi::{get_advanced_color_info, get_sdr_white_level_raw, DisplayPath},
    model::{BrightnessSource, DisplayInfo},
    source_state::transition_brightness_source,
    wmi, DisplayError,
};

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum KnownBrightnessReading {
    HdrSdrNits(u32),
    Ddc {
        percent: u32,
        raw: u32,
        raw_max: u32,
    },
    WmiPercent(u32),
}

pub(super) fn read_known_display_state(display: &DisplayInfo) -> Result<DisplayInfo, DisplayError> {
    let mut refreshed = display.clone();
    refresh_hdr_state(&mut refreshed);

    let reading = match refreshed.brightness_source {
        BrightnessSource::HdrSdr => {
            let path = display_path_from_display(&refreshed);
            KnownBrightnessReading::HdrSdrNits(get_sdr_white_level_raw(
                path.adapter_id,
                path.target_id,
            )?)
        }
        BrightnessSource::DdcHighLevel => {
            let ddc = ddcci::read_ddc_high_level_brightness(&refreshed.brightness_device_id)?;
            KnownBrightnessReading::Ddc {
                percent: ddc.brightness_percent,
                raw: ddc.brightness_raw,
                raw_max: ddc.brightness_raw_max,
            }
        }
        BrightnessSource::DdcVcp => {
            let vcp_code = refreshed.brightness_vcp_code.ok_or_else(|| {
                DisplayError::ddc_brightness_failed(format!(
                    "Missing DDC VCP code for {}",
                    refreshed.brightness_device_id
                ))
            })?;
            let vcp_code = u8::try_from(vcp_code).map_err(|_| {
                DisplayError::ddc_brightness_failed(format!(
                    "Invalid DDC VCP code {vcp_code} for {}",
                    refreshed.brightness_device_id
                ))
            })?;
            let ddc = ddcci::read_ddc_vcp_brightness(&refreshed.brightness_device_id, vcp_code)?;
            KnownBrightnessReading::Ddc {
                percent: ddc.brightness_percent,
                raw: ddc.brightness_raw,
                raw_max: ddc.brightness_raw_max,
            }
        }
        BrightnessSource::Wmi => {
            let wmi = wmi::read_wmi_brightness(&refreshed.brightness_device_id)?;
            KnownBrightnessReading::WmiPercent(wmi.brightness_percent)
        }
    };

    apply_known_brightness_reading(&mut refreshed, reading);
    Ok(refreshed)
}

fn refresh_hdr_state(display: &mut DisplayInfo) {
    if !display.hdr_supported {
        return;
    }

    let path = display_path_from_display(display);
    let hdr_enabled = get_advanced_color_info(path).is_enabled();
    transition_brightness_source(display, hdr_enabled);
}

fn display_path_from_display(display: &DisplayInfo) -> DisplayPath {
    DisplayPath {
        adapter_id: LUID {
            LowPart: display.adapter_id_low as u32,
            HighPart: display.adapter_id_high,
        },
        adapter_id_low: display.adapter_id_low,
        adapter_id_high: display.adapter_id_high,
        target_id: display.target_id,
    }
}

fn apply_known_brightness_reading(display: &mut DisplayInfo, reading: KnownBrightnessReading) {
    match reading {
        KnownBrightnessReading::HdrSdrNits(nits) => {
            let brightness = sdr_nits_to_percent(nits);
            display.brightness = brightness;
            display.brightness_raw = Some(brightness);
            display.brightness_raw_max = Some(100);
            display.nits = nits;
        }
        KnownBrightnessReading::Ddc {
            percent,
            raw,
            raw_max,
        } => {
            display.brightness = percent.min(100);
            display.brightness_raw = Some(raw.min(raw_max));
            display.brightness_raw_max = Some(raw_max);
        }
        KnownBrightnessReading::WmiPercent(percent) => {
            let brightness = percent.min(100);
            display.brightness = brightness;
            display.brightness_raw = Some(brightness);
            display.brightness_raw_max = Some(100);
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::display::model::luminance;

    fn display(source: BrightnessSource) -> DisplayInfo {
        DisplayInfo {
            name: "Display".to_string(),
            brightness: 20,
            brightness_source: source,
            brightness_raw: Some(20),
            brightness_raw_max: Some(100),
            brightness_device_id: "device".to_string(),
            brightness_vcp_code: (source == BrightnessSource::DdcVcp).then_some(0x10),
            fallback_source: None,
            nits: if source == BrightnessSource::HdrSdr {
                super::super::brightness::percent_to_sdr_nits(20)
            } else {
                luminance::DEFAULT_NITS
            },
            min_percentage: 0,
            max_percentage: 100,
            hdr_supported: source == BrightnessSource::HdrSdr,
            hdr_enabled: source == BrightnessSource::HdrSdr,
            adapter_id_low: 1,
            adapter_id_high: 2,
            target_id: 3,
            min_nits: (source == BrightnessSource::HdrSdr).then_some(luminance::MIN_NITS),
            max_nits: (source == BrightnessSource::HdrSdr).then_some(luminance::MAX_NITS),
        }
    }

    #[test]
    fn known_hdr_sdr_reading_updates_percent_and_nits() {
        let mut display = display(BrightnessSource::HdrSdr);

        apply_known_brightness_reading(&mut display, KnownBrightnessReading::HdrSdrNits(280));

        assert_eq!(display.brightness, 50);
        assert_eq!(display.brightness_raw, Some(50));
        assert_eq!(display.brightness_raw_max, Some(100));
        assert_eq!(display.nits, 280);
    }

    #[test]
    fn known_ddc_reading_updates_raw_scale_without_changing_nits() {
        let mut display = display(BrightnessSource::DdcVcp);

        apply_known_brightness_reading(
            &mut display,
            KnownBrightnessReading::Ddc {
                percent: 45,
                raw: 114,
                raw_max: 254,
            },
        );

        assert_eq!(display.brightness, 45);
        assert_eq!(display.brightness_raw, Some(114));
        assert_eq!(display.brightness_raw_max, Some(254));
        assert_eq!(display.nits, luminance::DEFAULT_NITS);
    }

    #[test]
    fn known_wmi_reading_updates_percent_scale() {
        let mut display = display(BrightnessSource::Wmi);

        apply_known_brightness_reading(&mut display, KnownBrightnessReading::WmiPercent(140));

        assert_eq!(display.brightness, 100);
        assert_eq!(display.brightness_raw, Some(100));
        assert_eq!(display.brightness_raw_max, Some(100));
        assert_eq!(display.nits, luminance::DEFAULT_NITS);
    }
}
