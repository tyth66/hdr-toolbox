export type AppNotice = {
  title: string;
  message: string;
};

function getErrorText(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === "string") {
    return error;
  }

  return String(error);
}

function isNoHdrDisplaysError(error: unknown): boolean {
  return getErrorText(error).toLowerCase().includes("no hdr displays found");
}

export function mapInitialLoadError(error: unknown): string {
  if (isNoHdrDisplaysError(error)) {
    return "No HDR displays detected. Turn on HDR in Windows Settings, then try Refresh Displays.";
  }

  return "HDR Toolbox could not load display state. Check that HDR is enabled in Windows Settings and try again.";
}

export function mapRefreshError(error: unknown, silent = false): AppNotice {
  if (isNoHdrDisplaysError(error)) {
    return {
      title: silent ? "Display state unavailable" : "No HDR displays detected",
      message: silent
        ? "HDR Toolbox could not confirm current display state. The last known values are still shown."
        : "Turn on HDR in Windows Settings, then try Refresh Displays again.",
    };
  }

  return {
    title: silent ? "Refresh failed" : "Could not refresh displays",
    message: silent
      ? "The window is showing the last known display values because the background refresh failed."
      : "Your current values are still shown. Try Refresh Displays again in a moment.",
  };
}

export function mapBrightnessError(): AppNotice {
  return {
    title: "Brightness update failed",
    message: "HDR Toolbox could not update SDR brightness for the selected display.",
  };
}

export function mapAutostartError(): AppNotice {
  return {
    title: "Auto-start update failed",
    message: "Windows auto-start setting could not be changed.",
  };
}

export function mapQuitError(): AppNotice {
  return {
    title: "Quit failed",
    message: "HDR Toolbox could not close cleanly. Try again from the tray menu.",
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
    message: "The selected shortcut may be unavailable or already in use by another app.",
  };
}
