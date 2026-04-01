pub mod commands;
mod ffi;
pub mod model;
pub mod service;
pub mod error;

pub use commands::{get_hdr_displays, set_brightness, set_brightness_all, set_hdr_enabled};
pub use error::DisplayError;
pub use model::DisplayInfo;
