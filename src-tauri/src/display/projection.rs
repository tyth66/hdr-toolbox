use super::model::{BrightnessSource, DisplayInfo};

pub(super) fn apply_brightness_projection(display: &mut DisplayInfo, percentage: u32) {
    let percentage = percentage.clamp(0, 100);
    display.brightness = percentage;
    display.brightness_raw = Some(match display.brightness_source {
        BrightnessSource::DdcVcp => (percentage * display.brightness_raw_max.unwrap_or(100)) / 100,
        BrightnessSource::HdrSdr | BrightnessSource::DdcHighLevel | BrightnessSource::Wmi => {
            percentage
        }
    });

    if display.brightness_source == BrightnessSource::HdrSdr {
        display.nits = super::brightness::percent_to_sdr_nits(percentage);
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::display::model::luminance;

    fn display_with_source(
        brightness: u32,
        source: BrightnessSource,
        raw_max: Option<u32>,
    ) -> DisplayInfo {
        DisplayInfo {
            name: "Display".to_string(),
            brightness,
            brightness_source: source,
            brightness_raw: Some(brightness),
            brightness_raw_max: raw_max,
            brightness_device_id: "device".to_string(),
            brightness_vcp_code: (source == BrightnessSource::DdcVcp).then_some(0x10),
            fallback_source: None,
            nits: if source == BrightnessSource::HdrSdr {
                super::super::brightness::percent_to_sdr_nits(brightness)
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
    fn projection_updates_hdr_sdr_nits() {
        let mut display = display_with_source(20, BrightnessSource::HdrSdr, Some(100));

        apply_brightness_projection(&mut display, 75);

        assert_eq!(display.brightness, 75);
        assert_eq!(display.brightness_raw, Some(75));
        assert_eq!(display.nits, 380);
    }

    #[test]
    fn projection_uses_raw_scale_for_ddc_vcp() {
        let mut display = display_with_source(20, BrightnessSource::DdcVcp, Some(254));

        apply_brightness_projection(&mut display, 50);

        assert_eq!(display.brightness, 50);
        assert_eq!(display.brightness_raw, Some(127));
        assert_eq!(display.nits, luminance::DEFAULT_NITS);
    }

    #[test]
    fn projection_keeps_percent_for_wmi() {
        let mut display = display_with_source(20, BrightnessSource::Wmi, Some(100));

        apply_brightness_projection(&mut display, 150);

        assert_eq!(display.brightness, 100);
        assert_eq!(display.brightness_raw, Some(100));
        assert_eq!(display.nits, luminance::DEFAULT_NITS);
    }
}
