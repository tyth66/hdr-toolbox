export type AppNotice = {
  title: string;
  message: string;
};

/**
 * Structured error code from Rust DisplayError enum.
 * These are snake_case strings matching the Rust enum variants.
 */
export type DisplayErrorCode =
  | "no_hdr_displays"
  | "no_display_paths"
  | "api_failed"
  | "display_not_found"
  | "sdr_white_level_failed"
  | "hdr_toggle_failed"
  | "hdr_polling_timeout"
  | "brightness_failed"
  | "invalid_adapter";

/**
 * Structured error from Rust backend.
 */
export interface StructuredDisplayError {
  code: DisplayErrorCode;
  message: string;
}

/**
 * Check if an error is a structured DisplayError from Rust.
 */
function isStructuredError(error: unknown): error is StructuredDisplayError {
  if (typeof error !== "object" || error === null) {
    return false;
  }
  const e = error as Record<string, unknown>;
  return typeof e.code === "string" && typeof e.message === "string";
}

function getErrorText(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === "string") {
    return error;
  }

  if (isStructuredError(error)) {
    return error.message;
  }

  return String(error);
}

function isNoHdrDisplaysError(error: unknown): boolean {
  if (isStructuredError(error)) {
    return error.code === "no_hdr_displays";
  }
  const message = getErrorText(error).toLowerCase();
  return message.includes("no hdr displays found") || message.includes("no hdr-capable displays found");
}

export function mapInitialLoadError(error: unknown): string {
  if (isNoHdrDisplaysError(error)) {
    return "No HDR-capable displays found. Check your display connection or Windows display settings, then refresh and try again.";
  }

  // For structured errors, include the specific message
  if (isStructuredError(error)) {
    return error.message;
  }

  return "HDR Toolbox couldn't load the current display state. Check your display connection and Windows display settings, then try again.";
}

export function mapRefreshError(error: unknown, silent = false): AppNotice {
  if (isNoHdrDisplaysError(error)) {
    return {
      title: silent ? "Display state unavailable" : "No HDR-capable displays found",
      message: silent
        ? "HDR Toolbox couldn't confirm the latest display state, so the last known values are still shown."
        : "Check your display connection or Windows display settings, then refresh and try again.",
    };
  }

  // For structured errors, use their message
  if (isStructuredError(error)) {
    return {
      title: silent ? "Refresh failed" : "Could not refresh displays",
      message: error.message,
    };
  }

  return {
    title: silent ? "Refresh failed" : "Could not refresh displays",
    message: silent
      ? "The background refresh failed, so the window is still showing the last known values."
      : "The current values are still shown. Try refreshing again in a moment.",
  };
}

export function mapBrightnessError(error: unknown = null): AppNotice {
  // For structured errors, use the specific message
  if (isStructuredError(error)) {
    return {
      title: "Brightness update failed",
      message: error.message,
    };
  }

  return {
    title: "Brightness update failed",
    message: "HDR Toolbox couldn't update SDR brightness for the selected display.",
  };
}

export function mapHdrToggleError(error: unknown = null): AppNotice {
  // For structured errors, use the specific message
  if (isStructuredError(error)) {
    return {
      title: "HDR toggle failed",
      message: error.message,
    };
  }

  return {
    title: "HDR toggle failed",
    message: "HDR Toolbox couldn't change the HDR setting for the selected display.",
  };
}

export function mapAutostartError(): AppNotice {
  return {
    title: "Auto-start update failed",
    message: "The launch-at-sign-in setting couldn't be updated.",
  };
}

export function mapQuitError(): AppNotice {
  return {
    title: "Quit failed",
    message: "HDR Toolbox couldn't close cleanly. Try again from the tray menu.",
  };
}

export function mapHotkeyValidationError(message: string): AppNotice {
  return {
    title: "Shortcut update failed",
    message,
  };
}

export function mapHotkeyRegistrationError(): AppNotice {
  return {
    title: "Shortcut registration failed",
    message: "That shortcut may be unavailable or already in use by another app.",
  };
}
