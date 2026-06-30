import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
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
import type { StructuredDisplayError } from "./errors.ts";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const errorsPath = path.resolve(__dirname, "errors.ts");
const rustErrorPath = path.resolve(__dirname, "..", "src-tauri", "src", "display", "error.rs");

function readFile(filePath: string): string {
  return readFileSync(filePath, "utf8");
}

function extractBlock(source: string, pattern: RegExp): string {
  const match = source.match(pattern);
  assert.ok(match?.[1], `Could not locate block for pattern ${pattern}`);
  return match[1];
}

function extractTsDisplayErrorCodes(source: string): string[] {
  const block = extractBlock(source, /export type DisplayErrorCode\s*=([\s\S]*?);/);
  return [...block.matchAll(/"([a-z_]+)"/g)].map((match) => match[1]);
}

function extractRustDisplayErrorCodes(source: string): string[] {
  const block = extractBlock(source, /pub enum DisplayErrorCode\s*\{([\s\S]*?)\n\}/);
  return block
    .split("\n")
    .map((line) => line.trim().replace(/,$/, ""))
    .filter((line) => /^[A-Z]/.test(line))
    .map((variant) =>
      variant.replace(/[A-Z]/g, (char, index) => `${index ? "_" : ""}${char.toLowerCase()}`)
    );
}

test("TypeScript DisplayErrorCode matches Rust DisplayErrorCode contract", () => {
  assert.deepEqual(
    extractTsDisplayErrorCodes(readFile(errorsPath)),
    extractRustDisplayErrorCodes(readFile(rustErrorPath))
  );
});

test("DisplayErrorCode contract includes DDC and WMI provider failures", () => {
  const tsCodes = extractTsDisplayErrorCodes(readFile(errorsPath));
  for (const code of [
    "ddc_enumeration_failed",
    "ddc_brightness_failed",
    "wmi_enumeration_failed",
    "wmi_brightness_failed",
  ]) {
    assert.ok(tsCodes.includes(code), `Missing DisplayErrorCode ${code}`);
  }
});

test("mapInitialLoadError recognizes supported display empty-state errors", () => {
  assert.equal(
    mapInitialLoadError(
      "No supported displays found. Ensure your monitor exposes a supported brightness path and the display driver is working correctly."
    ),
    "No supported displays found. Check your display connection or Windows display settings, then refresh and try again."
  );
});

test("mapInitialLoadError handles lowercase variant", () => {
  assert.equal(
    mapInitialLoadError("no supported displays found"),
    "No supported displays found. Check your display connection or Windows display settings, then refresh and try again."
  );
});

test("mapInitialLoadError handles generic errors", () => {
  const genericError = "Something went wrong";
  assert.equal(
    mapInitialLoadError(genericError),
    "BrightBox couldn't load the current display state. Check your display connection and Windows display settings, then try again."
  );
});

test("mapInitialLoadError handles Error objects", () => {
  const error = new Error("No supported displays found");
  assert.equal(
    mapInitialLoadError(error),
    "No supported displays found. Check your display connection or Windows display settings, then refresh and try again."
  );
});

test("mapRefreshError uses the no-display messaging for supported display empty state", () => {
  assert.deepEqual(
    mapRefreshError("No supported displays found.", false),
    {
      title: "No supported displays found",
      message: "Check your display connection or Windows display settings, then refresh and try again.",
    }
  );
});

test("mapRefreshError silent mode uses different title", () => {
  assert.deepEqual(
    mapRefreshError("No supported displays found.", true),
    {
      title: "Display state unavailable",
      message: "BrightBox couldn't confirm the latest display state, so the last known values are still shown.",
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
    message: "BrightBox couldn't update SDR brightness for the selected display.",
  });
});

test("maps DDC brightness errors to specific notices", () => {
  const error: StructuredDisplayError = {
    code: "ddc_brightness_failed",
    message: "DDC/CI brightness update failed: monitor not responding",
  };

  assert.deepEqual(mapBrightnessError(error), {
    title: "Brightness update failed",
    message: "DDC/CI brightness update failed: monitor not responding",
  });
});

test("maps WMI brightness errors to specific notices", () => {
  const error: StructuredDisplayError = {
    code: "wmi_brightness_failed",
    message: "WMI brightness update failed: access denied",
  };

  assert.deepEqual(mapBrightnessError(error), {
    title: "Brightness update failed",
    message: "WMI brightness update failed: access denied",
  });
});

test("mapHdrToggleError returns correct notice", () => {
  assert.deepEqual(mapHdrToggleError(), {
    title: "HDR toggle failed",
    message: "BrightBox couldn't change the HDR setting for the selected display.",
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
    message: "BrightBox couldn't close cleanly. Try again from the tray menu.",
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
