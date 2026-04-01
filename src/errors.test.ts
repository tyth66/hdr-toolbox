import test from "node:test";
import assert from "node:assert/strict";
import {
  mapInitialLoadError,
  mapRefreshError,
  mapBrightnessError,
  mapHdrToggleError,
  mapAutostartError,
  mapQuitError,
  mapHotkeyValidationError,
  mapHotkeyRegistrationError,
} from "./errors.ts";

test("mapInitialLoadError recognizes HDR-capable display empty-state errors", () => {
  assert.equal(
    mapInitialLoadError(
      "No HDR-capable displays found. Ensure your monitor supports HDR and the display driver is working correctly."
    ),
    "No HDR-capable displays found. Check your display connection or Windows display settings, then refresh and try again."
  );
});

test("mapInitialLoadError handles lowercase variant", () => {
  assert.equal(
    mapInitialLoadError("no hdr displays found"),
    "No HDR-capable displays found. Check your display connection or Windows display settings, then refresh and try again."
  );
});

test("mapInitialLoadError handles generic errors", () => {
  const genericError = "Something went wrong";
  assert.equal(
    mapInitialLoadError(genericError),
    "HDR Toolbox couldn't load the current display state. Check your display connection and Windows display settings, then try again."
  );
});

test("mapInitialLoadError handles Error objects", () => {
  const error = new Error("No HDR-capable displays found");
  assert.equal(
    mapInitialLoadError(error),
    "No HDR-capable displays found. Check your display connection or Windows display settings, then refresh and try again."
  );
});

test("mapRefreshError uses the no-display messaging for HDR-capable display empty state", () => {
  assert.deepEqual(
    mapRefreshError("No HDR-capable displays found.", false),
    {
      title: "No HDR-capable displays found",
      message: "Check your display connection or Windows display settings, then refresh and try again.",
    }
  );
});

test("mapRefreshError silent mode uses different title", () => {
  assert.deepEqual(
    mapRefreshError("No HDR-capable displays found.", true),
    {
      title: "Display state unavailable",
      message: "HDR Toolbox couldn't confirm the latest display state, so the last known values are still shown.",
    }
  );
});

test("mapRefreshError generic error non-silent", () => {
  assert.deepEqual(
    mapRefreshError("QueryDisplayConfig failed", false),
    {
      title: "Could not refresh displays",
      message: "The current values are still shown. Try refreshing again in a moment.",
    }
  );
});

test("mapRefreshError generic error silent", () => {
  assert.deepEqual(
    mapRefreshError("QueryDisplayConfig failed", true),
    {
      title: "Refresh failed",
      message: "The background refresh failed, so the window is still showing the last known values.",
    }
  );
});

test("mapBrightnessError returns correct notice", () => {
  assert.deepEqual(mapBrightnessError(), {
    title: "Brightness update failed",
    message: "HDR Toolbox couldn't update SDR brightness for the selected display.",
  });
});

test("mapHdrToggleError returns correct notice", () => {
  assert.deepEqual(mapHdrToggleError(), {
    title: "HDR toggle failed",
    message: "HDR Toolbox couldn't change the HDR setting for the selected display.",
  });
});

test("mapAutostartError returns correct notice", () => {
  assert.deepEqual(mapAutostartError(), {
    title: "Auto-start update failed",
    message: "The launch-at-sign-in setting couldn't be updated.",
  });
});

test("mapQuitError returns correct notice", () => {
  assert.deepEqual(mapQuitError(), {
    title: "Quit failed",
    message: "HDR Toolbox couldn't close cleanly. Try again from the tray menu.",
  });
});

test("mapHotkeyValidationError forwards message", () => {
  const customMessage = "Custom validation error";
  assert.deepEqual(mapHotkeyValidationError(customMessage), {
    title: "Shortcut update failed",
    message: customMessage,
  });
});

test("mapHotkeyRegistrationError returns correct notice", () => {
  assert.deepEqual(mapHotkeyRegistrationError(), {
    title: "Shortcut registration failed",
    message: "That shortcut may be unavailable or already in use by another app.",
  });
});
