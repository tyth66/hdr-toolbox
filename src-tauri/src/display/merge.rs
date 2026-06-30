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

    if let Some(existing) = displays
        .iter_mut()
        .find(|existing| matches_ddc_display(existing, &display))
    {
        inject_provider_fallback(
            existing,
            fallback_source,
            display.device_key,
            display.brightness_percent,
            display.brightness_raw,
            display.brightness_raw_max,
            display.vcp_code.map(u32::from),
        );
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
        inject_provider_fallback(
            existing,
            BrightnessSource::Wmi,
            display.key,
            display.brightness_percent,
            display.brightness_percent,
            100,
            None,
        );
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

fn matches_ddc_display(existing: &DisplayInfo, display: &DdcDisplay) -> bool {
    existing.brightness_source == BrightnessSource::HdrSdr
        && (monitor_identity_matches(&existing.brightness_device_id, &display.device_key)
            || existing.name == display.name)
}

fn inject_provider_fallback(
    existing: &mut DisplayInfo,
    fallback_source: BrightnessSource,
    device_key: String,
    brightness_percent: u32,
    brightness_raw: u32,
    brightness_raw_max: u32,
    vcp_code: Option<u32>,
) {
    existing.brightness_device_id = device_key;
    existing.brightness_vcp_code = vcp_code;
    existing.brightness_raw = Some(brightness_raw);
    existing.brightness_raw_max = Some(brightness_raw_max);

    if existing.hdr_enabled {
        existing.fallback_source = Some(fallback_source);
        return;
    }

    existing.brightness_source = fallback_source;
    existing.fallback_source = Some(BrightnessSource::HdrSdr);
    existing.brightness = brightness_percent;
}

fn monitor_identity_matches(hdr_device_id: &str, ddc_device_key: &str) -> bool {
    let ddc_match_key = ddc_device_key
        .rsplit_once('#')
        .filter(|(_, suffix)| suffix.chars().all(|character| character.is_ascii_digit()))
        .map(|(base, _)| base)
        .unwrap_or(ddc_device_key);

    normalize_monitor_identity(hdr_device_id) == normalize_monitor_identity(ddc_match_key)
}

fn normalize_monitor_identity(value: &str) -> String {
    value.trim().to_ascii_lowercase()
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

    #[test]
    fn merge_ddc_uses_monitor_identity_when_names_differ() {
        let monitor_path =
            r"\\?\DISPLAY#SKG2512#5&eb5a9cc&0&UID532#{e6f07b5f-ee97-4a90-b076-33f57bf4eaa7}";
        let mut displays = Vec::new();
        push_hdr_display_for_test(&mut displays, "H25T7-3", 1, 2, 532, 280, true);
        displays[0].brightness_device_id = monitor_path.to_string();

        merge_ddc_display(
            &mut displays,
            DdcDisplay {
                device_key: format!("{monitor_path}#0"),
                name: "Generic PnP Monitor".to_string(),
                brightness_percent: 64,
                brightness_raw: 163,
                brightness_raw_max: 254,
                high_level_supported: false,
                vcp_code: Some(0x10),
            },
        );

        assert_eq!(displays.len(), 1);
        assert_eq!(displays[0].name, "H25T7-3");
        assert_eq!(displays[0].brightness_source, BrightnessSource::HdrSdr);
        assert_eq!(displays[0].fallback_source, Some(BrightnessSource::DdcVcp));
        assert_eq!(
            displays[0].brightness_device_id,
            format!("{monitor_path}#0")
        );
        assert_eq!(displays[0].brightness_vcp_code, Some(0x10));
        assert_eq!(displays[0].brightness_raw, Some(163));
        assert_eq!(displays[0].brightness_raw_max, Some(254));
    }

    #[test]
    fn merge_ddc_activates_fallback_brightness_when_hdr_is_off() {
        let monitor_path =
            r"\\?\DISPLAY#SKG2512#5&eb5a9cc&0&UID532#{e6f07b5f-ee97-4a90-b076-33f57bf4eaa7}";
        let mut displays = Vec::new();
        push_hdr_display_for_test(&mut displays, "H25T7-3", 1, 2, 532, 280, false);
        displays[0].brightness_device_id = monitor_path.to_string();

        merge_ddc_display(
            &mut displays,
            DdcDisplay {
                device_key: format!("{monitor_path}#0"),
                name: "Generic PnP Monitor".to_string(),
                brightness_percent: 64,
                brightness_raw: 163,
                brightness_raw_max: 254,
                high_level_supported: false,
                vcp_code: Some(0x10),
            },
        );

        assert_eq!(displays.len(), 1);
        assert_eq!(displays[0].brightness_source, BrightnessSource::DdcVcp);
        assert_eq!(displays[0].fallback_source, Some(BrightnessSource::HdrSdr));
        assert_eq!(displays[0].brightness, 64);
        assert_eq!(
            displays[0].brightness_device_id,
            format!("{monitor_path}#0")
        );
    }
}
