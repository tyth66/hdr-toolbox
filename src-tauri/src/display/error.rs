//! Structured error types for HDR Toolbox commands.
//!
//! These errors are serialized as JSON and sent to the frontend,
//! allowing precise error handling based on error codes.

use serde::Serialize;
use std::fmt;

/// Structured error codes for display operations.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum DisplayErrorCode {
    /// No HDR-capable displays found
    NoHdrDisplays,
    /// Display path enumeration failed
    NoDisplayPaths,
    /// DisplayConfig API call failed
    ApiFailed,
    /// The specified display was not found
    DisplayNotFound,
    /// SDR white level read/write failed
    SdrWhiteLevelFailed,
    /// HDR state toggle failed
    HdrToggleFailed,
    /// Polling for HDR state timed out
    HdrPollingTimeout,
    /// Brightness setting failed
    BrightnessFailed,
    /// Invalid display adapter ID
    InvalidAdapter,
    /// DDC/CI display enumeration failed
    DdcEnumerationFailed,
    /// DDC/CI brightness write failed
    DdcBrightnessFailed,
    /// WMI display enumeration failed
    WmiEnumerationFailed,
    /// WMI brightness write failed
    WmiBrightnessFailed,
}

/// A structured error with code and message.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct DisplayError {
    pub code: DisplayErrorCode,
    pub message: String,
}

impl DisplayError {
    pub fn new(code: DisplayErrorCode, message: impl Into<String>) -> Self {
        Self {
            code,
            message: message.into(),
        }
    }

    pub fn no_hdr_displays() -> Self {
        Self::new(
            DisplayErrorCode::NoHdrDisplays,
            "No HDR-capable displays found. Ensure your monitor supports HDR and the display driver is working correctly.",
        )
    }

    pub fn no_display_paths() -> Self {
        Self::new(DisplayErrorCode::NoDisplayPaths, "No display paths found.")
    }

    pub fn api_failed(detail: impl Into<String>) -> Self {
        Self::new(
            DisplayErrorCode::ApiFailed,
            format!("DisplayConfig API call failed: {}", detail.into()),
        )
    }

    pub fn display_not_found() -> Self {
        Self::new(
            DisplayErrorCode::DisplayNotFound,
            "The specified display was not found.",
        )
    }

    pub fn sdr_white_level_failed(detail: impl Into<String>) -> Self {
        Self::new(
            DisplayErrorCode::SdrWhiteLevelFailed,
            format!("SDR white level operation failed: {}", detail.into()),
        )
    }

    pub fn hdr_toggle_failed(detail: impl Into<String>) -> Self {
        Self::new(
            DisplayErrorCode::HdrToggleFailed,
            format!("HDR toggle failed: {}", detail.into()),
        )
    }

    pub fn hdr_polling_timeout() -> Self {
        Self::new(
            DisplayErrorCode::HdrPollingTimeout,
            "HDR state polling timed out.",
        )
    }

    pub fn brightness_failed(detail: impl Into<String>) -> Self {
        Self::new(
            DisplayErrorCode::BrightnessFailed,
            format!("Brightness setting failed: {}", detail.into()),
        )
    }

    pub fn invalid_adapter() -> Self {
        Self::new(
            DisplayErrorCode::InvalidAdapter,
            "Invalid display adapter ID.",
        )
    }

    pub fn ddc_enumeration_failed(detail: impl Into<String>) -> Self {
        Self::new(
            DisplayErrorCode::DdcEnumerationFailed,
            format!("DDC/CI display enumeration failed: {}", detail.into()),
        )
    }

    pub fn ddc_brightness_failed(detail: impl Into<String>) -> Self {
        Self::new(
            DisplayErrorCode::DdcBrightnessFailed,
            format!("DDC/CI brightness update failed: {}", detail.into()),
        )
    }

    pub fn wmi_enumeration_failed(detail: impl Into<String>) -> Self {
        Self::new(
            DisplayErrorCode::WmiEnumerationFailed,
            format!("WMI display enumeration failed: {}", detail.into()),
        )
    }

    pub fn wmi_brightness_failed(detail: impl Into<String>) -> Self {
        Self::new(
            DisplayErrorCode::WmiBrightnessFailed,
            format!("WMI brightness update failed: {}", detail.into()),
        )
    }
}

impl fmt::Display for DisplayError {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        formatter.write_str(&self.message)
    }
}

impl std::error::Error for DisplayError {}

#[cfg(test)]
mod tests {
    use super::{DisplayError, DisplayErrorCode};

    #[test]
    fn ddc_enumeration_error_has_provider_code_and_message() {
        assert_eq!(
            DisplayError::ddc_enumeration_failed("capabilities unavailable"),
            DisplayError::new(
                DisplayErrorCode::DdcEnumerationFailed,
                "DDC/CI display enumeration failed: capabilities unavailable"
            )
        );
    }

    #[test]
    fn ddc_brightness_error_has_provider_code_and_message() {
        assert_eq!(
            DisplayError::ddc_brightness_failed("monitor not responding"),
            DisplayError::new(
                DisplayErrorCode::DdcBrightnessFailed,
                "DDC/CI brightness update failed: monitor not responding"
            )
        );
    }

    #[test]
    fn wmi_enumeration_error_has_provider_code_and_message() {
        assert_eq!(
            DisplayError::wmi_enumeration_failed("namespace unavailable"),
            DisplayError::new(
                DisplayErrorCode::WmiEnumerationFailed,
                "WMI display enumeration failed: namespace unavailable"
            )
        );
    }

    #[test]
    fn wmi_brightness_error_has_provider_code_and_message() {
        assert_eq!(
            DisplayError::wmi_brightness_failed("access denied"),
            DisplayError::new(
                DisplayErrorCode::WmiBrightnessFailed,
                "WMI brightness update failed: access denied"
            )
        );
    }
}
