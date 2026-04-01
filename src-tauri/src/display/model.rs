/// Luminance range constants for HDR10 standard (80-480 nits).
/// Centralized here to avoid hardcoding across multiple places.
pub mod luminance {
    /// Minimum SDR white level in nits (HDR10 standard)
    pub const MIN_NITS: u32 = 80;
    /// Maximum SDR white level in nits (HDR10 standard)
    pub const MAX_NITS: u32 = 480;
    /// Safe in-range fallback when SDR white level cannot be read
    pub const DEFAULT_NITS: u32 = (MIN_NITS + MAX_NITS) / 2;
}

/// SDR white level in nits (not the internal API value)
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct DisplayInfo {
    pub name: String,
    pub nits: u32,
    pub min_percentage: u32,
    pub max_percentage: u32,
    pub hdr_supported: bool,
    pub hdr_enabled: bool,
    pub adapter_id_low: i32,
    pub adapter_id_high: i32,
    pub target_id: u32,
    pub min_nits: Option<u32>,
    pub max_nits: Option<u32>,
}

impl DisplayInfo {
    pub(crate) fn nits_to_api_value(nits: u32) -> u32 {
        nits.saturating_mul(1000) / 80
    }

    pub(crate) fn api_value_to_nits(value: u32) -> u32 {
        value.saturating_mul(80) / 1000
    }
}

#[cfg(test)]
mod tests {
    use super::luminance::{MAX_NITS, MIN_NITS, DEFAULT_NITS};
    use super::DisplayInfo;

    #[test]
    fn nits_to_api_value_maps_min_nits() {
        assert_eq!(DisplayInfo::nits_to_api_value(MIN_NITS), 1000);
    }

    #[test]
    fn nits_to_api_value_maps_max_nits() {
        assert_eq!(DisplayInfo::nits_to_api_value(MAX_NITS), 6000);
    }

    #[test]
    fn nits_to_api_value_maps_midpoint() {
        assert_eq!(DisplayInfo::nits_to_api_value(280), 3500);
    }

    #[test]
    fn nits_to_api_value_clamps_zero() {
        assert_eq!(DisplayInfo::nits_to_api_value(0), 0);
    }

    #[test]
    fn nits_to_api_value_does_not_clamp_above_max() {
        // The function uses saturating_mul but does not clamp to MAX_NITS
        // 1000 * 1000 / 80 = 12500
        assert_eq!(DisplayInfo::nits_to_api_value(1000), 12500);
    }

    #[test]
    fn api_value_to_nits_maps_min_nits() {
        assert_eq!(DisplayInfo::api_value_to_nits(1000), MIN_NITS);
    }

    #[test]
    fn api_value_to_nits_maps_max_nits() {
        assert_eq!(DisplayInfo::api_value_to_nits(6000), MAX_NITS);
    }

    #[test]
    fn api_value_to_nits_maps_midpoint() {
        assert_eq!(DisplayInfo::api_value_to_nits(3500), 280);
    }

    #[test]
    fn api_value_to_nits_clamps_zero() {
        assert_eq!(DisplayInfo::api_value_to_nits(0), 0);
    }

    #[test]
    fn api_value_to_nits_clamps_below_min() {
        assert_eq!(DisplayInfo::api_value_to_nits(500), 40);
    }

    #[test]
    fn roundtrip_nits_to_api_and_back() {
        for nits in [MIN_NITS, 160, 240, 280, 320, 400, MAX_NITS] {
            let api = DisplayInfo::nits_to_api_value(nits);
            let back = DisplayInfo::api_value_to_nits(api);
            assert_eq!(back, nits, "Round-trip failed for {} nits", nits);
        }
    }

    #[test]
    fn luminance_constants_are_aligned_with_service() {
        assert_eq!(MIN_NITS, 80);
        assert_eq!(MAX_NITS, 480);
        assert_eq!(DEFAULT_NITS, 280);
    }
}
