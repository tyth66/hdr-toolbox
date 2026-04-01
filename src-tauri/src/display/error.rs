//! Structured error types for HDR Toolbox commands.
//!
//! These errors are serialized as JSON and sent to the frontend,
//! allowing precise error handling based on error codes.

use serde::Serialize;

/// Structured error codes for display operations.
#[derive(Debug, Clone, Serialize)]
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
}

/// A structured error with code and message.
#[derive(Debug, Clone, Serialize)]
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
        Self::new(
            DisplayErrorCode::NoDisplayPaths,
            "No display paths found.",
        )
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
}
