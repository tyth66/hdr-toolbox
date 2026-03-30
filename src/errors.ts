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
  const message = getErrorText(error).toLowerCase();
  return message.includes("no hdr displays found") || message.includes("no hdr-capable displays found");
}

export function mapInitialLoadError(error: unknown): string {
  if (isNoHdrDisplaysError(error)) {
    return "No HDR-capable displays found. Check your display connection or Windows display settings, then refresh and try again.";
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

  return {
    title: silent ? "Refresh failed" : "Could not refresh displays",
    message: silent
      ? "The background refresh failed, so the window is still showing the last known values."
      : "The current values are still shown. Try refreshing again in a moment.",
  };
}

export function mapBrightnessError(): AppNotice {
  return {
    title: "Brightness update failed",
    message: "HDR Toolbox couldn't update SDR brightness for the selected display.",
  };
}

export function mapHdrToggleError(): AppNotice {
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
