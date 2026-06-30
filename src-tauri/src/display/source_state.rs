use super::model::{BrightnessSource, DisplayInfo};

pub(super) fn transition_brightness_source(display: &mut DisplayInfo, hdr_enabled: bool) {
    if hdr_enabled {
        if display.brightness_source != BrightnessSource::HdrSdr {
            let current = display.brightness_source;
            display.brightness_source = BrightnessSource::HdrSdr;
            display.fallback_source = Some(current);
        }
    } else if display.brightness_source == BrightnessSource::HdrSdr {
        if let Some(fallback) = display.fallback_source {
            display.brightness_source = fallback;
            display.fallback_source = Some(BrightnessSource::HdrSdr);
        }
    }

    display.hdr_enabled = hdr_enabled;
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::display::model::luminance;

    fn display(source: BrightnessSource) -> DisplayInfo {
        DisplayInfo {
            name: "Display".to_string(),
            brightness: 50,
            brightness_source: source,
            brightness_raw: Some(50),
            brightness_raw_max: Some(100),
            brightness_device_id: "device".to_string(),
            brightness_vcp_code: (source == BrightnessSource::DdcVcp).then_some(0x10),
            fallback_source: None,
            nits: if source == BrightnessSource::HdrSdr {
                super::super::brightness::percent_to_sdr_nits(50)
            } else {
                luminance::DEFAULT_NITS
            },
            min_percentage: 0,
            max_percentage: 100,
            hdr_supported: true,
            hdr_enabled: source == BrightnessSource::HdrSdr,
            adapter_id_low: 1,
            adapter_id_high: 2,
            target_id: 3,
            min_nits: Some(luminance::MIN_NITS),
            max_nits: Some(luminance::MAX_NITS),
        }
    }

    #[test]
    fn transition_preserves_provider_fallback_when_hdr_stays_enabled() {
        let mut display = display(BrightnessSource::HdrSdr);
        display.fallback_source = Some(BrightnessSource::DdcVcp);

        transition_brightness_source(&mut display, true);

        assert_eq!(display.brightness_source, BrightnessSource::HdrSdr);
        assert_eq!(display.fallback_source, Some(BrightnessSource::DdcVcp));
        assert!(display.hdr_enabled);
    }

    #[test]
    fn transition_preserves_provider_source_when_hdr_stays_disabled() {
        let mut display = display(BrightnessSource::DdcVcp);
        display.fallback_source = Some(BrightnessSource::HdrSdr);
        display.hdr_enabled = false;

        transition_brightness_source(&mut display, false);

        assert_eq!(display.brightness_source, BrightnessSource::DdcVcp);
        assert_eq!(display.fallback_source, Some(BrightnessSource::HdrSdr));
        assert!(!display.hdr_enabled);
    }
}
