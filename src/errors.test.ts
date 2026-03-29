import test from "node:test";
import assert from "node:assert/strict";
import {
  mapBrightnessError,
  mapInitialLoadError,
  mapRefreshError,
} from "./errors.ts";

test("mapInitialLoadError returns a product message for missing HDR displays", () => {
  assert.equal(
    mapInitialLoadError("No HDR displays found. Ensure HDR is enabled in Windows Settings."),
    "No HDR displays detected. Turn on HDR in Windows Settings, then try Refresh Displays."
  );
});

test("mapRefreshError keeps silent refresh messaging non-blocking", () => {
  assert.deepEqual(mapRefreshError(new Error("transport failed"), true), {
    title: "Refresh failed",
    message:
      "The window is showing the last known display values because the background refresh failed.",
  });
});

test("mapBrightnessError returns a stable user-facing message", () => {
  assert.deepEqual(mapBrightnessError(), {
    title: "Brightness update failed",
    message:
      "HDR Toolbox could not update SDR brightness for the selected display.",
  });
});
