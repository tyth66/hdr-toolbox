use super::model::{luminance, BrightnessSource};

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
#[allow(dead_code)]
pub(super) enum BrightnessHardwareValue {
    Percent(u32),
    Raw(u32),
    Nits(u32),
}

pub(super) fn percent_to_sdr_nits(percent: u32) -> u32 {
    let range = luminance::MAX_NITS - luminance::MIN_NITS;
    luminance::MIN_NITS + ((percent.clamp(0, 100) * range) / 100)
}

pub(super) fn sdr_nits_to_percent(nits: u32) -> u32 {
    let clamped = nits.clamp(luminance::MIN_NITS, luminance::MAX_NITS);
    ((clamped - luminance::MIN_NITS) * 100) / (luminance::MAX_NITS - luminance::MIN_NITS)
}

#[allow(dead_code)]
pub(super) fn hardware_value_for_source(
    source: BrightnessSource,
    percent: u32,
    raw_max: Option<u32>,
    _raw_min: Option<u32>,
) -> BrightnessHardwareValue {
    let percent = percent.clamp(0, 100);
    match source {
        BrightnessSource::HdrSdr => BrightnessHardwareValue::Nits(percent_to_sdr_nits(percent)),
        BrightnessSource::DdcVcp => {
            let max = raw_max.unwrap_or(100);
            BrightnessHardwareValue::Raw((percent * max) / 100)
        }
        BrightnessSource::DdcHighLevel | BrightnessSource::Wmi => {
            BrightnessHardwareValue::Percent(percent)
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::display::model::BrightnessSource;

    #[test]
    fn hdr_sdr_percent_maps_to_nits() {
        assert_eq!(percent_to_sdr_nits(0), 80);
        assert_eq!(percent_to_sdr_nits(50), 280);
        assert_eq!(percent_to_sdr_nits(100), 480);
    }

    #[test]
    fn hdr_sdr_nits_maps_to_percent() {
        assert_eq!(sdr_nits_to_percent(80), 0);
        assert_eq!(sdr_nits_to_percent(280), 50);
        assert_eq!(sdr_nits_to_percent(480), 100);
    }

    #[test]
    fn source_update_value_uses_raw_scale_for_ddc_vcp() {
        let value = hardware_value_for_source(BrightnessSource::DdcVcp, 50, Some(254), None);
        assert_eq!(value, BrightnessHardwareValue::Raw(127));
    }

    #[test]
    fn source_update_value_keeps_percent_for_wmi() {
        let value = hardware_value_for_source(BrightnessSource::Wmi, 42, None, None);
        assert_eq!(value, BrightnessHardwareValue::Percent(42));
    }

    #[test]
    fn source_update_value_uses_nits_for_hdr_sdr() {
        let value = hardware_value_for_source(BrightnessSource::HdrSdr, 25, None, None);
        assert_eq!(value, BrightnessHardwareValue::Nits(180));
    }
}
