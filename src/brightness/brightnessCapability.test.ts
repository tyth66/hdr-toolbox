import test from "node:test";
import assert from "node:assert/strict";
import { isBrightnessAdjustable } from "./brightnessCapability.ts";

test("HDR SDR brightness requires HDR to be active", () => {
  assert.equal(isBrightnessAdjustable("hdr_sdr", true, false), true);
  assert.equal(isBrightnessAdjustable("hdr_sdr", false, false), false);
});

test("provider brightness stays adjustable when HDR is inactive", () => {
  assert.equal(isBrightnessAdjustable("ddc_high_level", false, false), true);
  assert.equal(isBrightnessAdjustable("ddc_vcp", false, false), true);
  assert.equal(isBrightnessAdjustable("wmi", false, false), true);
});

test("pending HDR changes block all brightness sources", () => {
  assert.equal(isBrightnessAdjustable("hdr_sdr", true, true), false);
  assert.equal(isBrightnessAdjustable("ddc_high_level", false, true), false);
  assert.equal(isBrightnessAdjustable("ddc_vcp", false, true), false);
  assert.equal(isBrightnessAdjustable("wmi", false, true), false);
});
