use super::model::{BrightnessSource, DisplayInfo};

pub(super) fn transition_brightness_source(display: &mut DisplayInfo, hdr_enabled: bool) {
    if hdr_enabled {
        if display.fallback_source.is_some()
            || display.brightness_source != BrightnessSource::HdrSdr
        {
            let current = display.brightness_source;
            display.brightness_source = BrightnessSource::HdrSdr;
            display.fallback_source = Some(current);
        }
    } else if let Some(fallback) = display.fallback_source.take() {
        display.brightness_source = fallback;
        display.fallback_source = Some(BrightnessSource::HdrSdr);
    }

    display.hdr_enabled = hdr_enabled;
}
