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
