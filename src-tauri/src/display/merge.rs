use super::{
    ddcci::DdcDisplay,
    model::{luminance, BrightnessSource, DisplayInfo},
    wmi::WmiDisplay,
};

pub(super) fn merge_ddc_display(displays: &mut Vec<DisplayInfo>, display: DdcDisplay) {
    let fallback_source = if display.high_level_supported {
        BrightnessSource::DdcHighLevel
    } else {
        BrightnessSource::DdcVcp
    };

    if let Some(existing) = displays.iter_mut().find(|existing| {
        existing.brightness_source == BrightnessSource::HdrSdr && existing.name == display.name
    }) {
        existing.fallback_source = Some(fallback_source);
        existing.brightness_device_id = display.device_key;
        existing.brightness_vcp_code = display.vcp_code.map(u32::from);
        existing.brightness_raw = Some(display.brightness_raw);
        existing.brightness_raw_max = Some(display.brightness_raw_max);
        return;
    }

    let target_id = next_provider_target_id(displays);

    displays.push(DisplayInfo {
        name: display.name,
        brightness: display.brightness_percent,
        brightness_source: fallback_source,
        brightness_raw: Some(display.brightness_raw),
        brightness_raw_max: Some(display.brightness_raw_max),
        brightness_device_id: display.device_key,
        brightness_vcp_code: display.vcp_code.map(u32::from),
        fallback_source: None,
        nits: luminance::DEFAULT_NITS,
        min_percentage: 0,
        max_percentage: 100,
        hdr_supported: false,
        hdr_enabled: false,
        adapter_id_low: -1000,
        adapter_id_high: 0,
        target_id,
        min_nits: None,
        max_nits: None,
    });
}

pub(super) fn merge_wmi_display(displays: &mut Vec<DisplayInfo>, display: WmiDisplay) {
    if let Some(existing) = displays.iter_mut().find(|existing| {
        existing.brightness_source == BrightnessSource::HdrSdr && existing.name == display.name
    }) {
        existing.fallback_source = Some(BrightnessSource::Wmi);
        existing.brightness_device_id = display.key;
        existing.brightness_raw = Some(display.brightness_percent);
        existing.brightness_raw_max = Some(100);
        existing.brightness_vcp_code = None;
        return;
    }

    let target_id = next_provider_target_id(displays);

    displays.push(DisplayInfo {
        name: display.name,
        brightness: display.brightness_percent,
        brightness_source: BrightnessSource::Wmi,
        brightness_raw: Some(display.brightness_percent),
        brightness_raw_max: Some(100),
        brightness_device_id: display.key,
        brightness_vcp_code: None,
        fallback_source: None,
        nits: luminance::DEFAULT_NITS,
        min_percentage: 0,
        max_percentage: 100,
        hdr_supported: false,
        hdr_enabled: false,
        adapter_id_low: -2000,
        adapter_id_high: 0,
        target_id,
        min_nits: None,
        max_nits: None,
    });
}

fn next_provider_target_id(displays: &[DisplayInfo]) -> u32 {
    displays
        .iter()
        .map(|display| display.target_id)
        .max()
        .unwrap_or(0)
        .saturating_add(1)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn push_hdr_display_for_test(
        displays: &mut Vec<DisplayInfo>,
        name: &str,
        adapter_id_low: i32,
        adapter_id_high: i32,
        target_id: u32,
        nits: u32,
        hdr_enabled: bool,
    ) {
        displays.push(DisplayInfo {
            name: name.to_string(),
            brightness: super::super::brightness::sdr_nits_to_percent(nits),
            brightness_source: BrightnessSource::HdrSdr,
            brightness_raw: Some(super::super::brightness::sdr_nits_to_percent(nits)),
            brightness_raw_max: Some(100),
            brightness_device_id: format!("{adapter_id_low}:{adapter_id_high}:{target_id}"),
            brightness_vcp_code: None,
            fallback_source: None,
            nits,
            min_percentage: 0,
            max_percentage: 100,
            hdr_supported: true,
            hdr_enabled,
            adapter_id_low,
            adapter_id_high,
            target_id,
            min_nits: Some(luminance::MIN_NITS),
            max_nits: Some(luminance::MAX_NITS),
        });
    }

    #[test]
    fn merge_injects_wmi_fallback_for_hdr_internal_display() {
        let mut displays = Vec::new();
        push_hdr_display_for_test(&mut displays, "Internal Display", 1, 2, 3, 280, true);

        merge_wmi_display(
            &mut displays,
            WmiDisplay {
                key: "WMI-1".to_string(),
                name: "Internal Display".to_string(),
                brightness_percent: 60,
            },
        );

        assert_eq!(displays.len(), 1);
        assert_eq!(displays[0].brightness_source, BrightnessSource::HdrSdr);
        assert_eq!(displays[0].fallback_source, Some(BrightnessSource::Wmi));
        assert_eq!(displays[0].brightness_device_id, "WMI-1");
        assert_eq!(displays[0].brightness_raw, Some(60));
    }

    #[test]
    fn merge_adds_standalone_wmi_display_when_no_hdr_match() {
        let mut displays = Vec::new();

        merge_wmi_display(
            &mut displays,
            WmiDisplay {
                key: "WMI-2".to_string(),
                name: "Laptop Panel".to_string(),
                brightness_percent: 42,
            },
        );

        assert_eq!(displays.len(), 1);
        assert_eq!(displays[0].brightness_source, BrightnessSource::Wmi);
        assert_eq!(displays[0].brightness, 42);
        assert_eq!(displays[0].fallback_source, None);
    }
}
