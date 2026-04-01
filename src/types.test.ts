import test from "node:test";
import assert from "node:assert/strict";
import {
  LUMINANCE,
  nitsToPercentage,
  percentageToNits,
  WINDOW_CONFIG,
  HOTKEYS,
  SLIDER,
} from "./types.ts";

test("nitsToPercentage maps the luminance bounds to slider bounds", () => {
  assert.equal(nitsToPercentage(LUMINANCE.MIN_NITS), 0);
  assert.equal(nitsToPercentage(LUMINANCE.MAX_NITS), 100);
});

test("percentageToNits maps slider bounds to luminance bounds", () => {
  assert.equal(percentageToNits(0), LUMINANCE.MIN_NITS);
  assert.equal(percentageToNits(100), LUMINANCE.MAX_NITS);
});

test("midpoint conversions stay stable around 50 percent", () => {
  assert.equal(percentageToNits(50), 280);
  assert.equal(nitsToPercentage(280), 50);
});

test("nitsToPercentage computes correctly below minimum", () => {
  // nitsToPercentage does NOT clamp - it computes raw values
  // (nits - 80) / 400 * 100
  assert.equal(nitsToPercentage(0), Math.round(((0 - 80) / 400) * 100)); // -20
  assert.equal(nitsToPercentage(40), Math.round(((40 - 80) / 400) * 100)); // -10
});

test("nitsToPercentage computes correctly above maximum", () => {
  // (1000 - 80) / 400 * 100 = 230
  assert.equal(nitsToPercentage(480), 100);
  assert.equal(nitsToPercentage(1000), Math.round(((1000 - 80) / 400) * 100)); // 230
});

test("percentageToNits computes correctly below minimum", () => {
  // percentageToNits does NOT clamp - it computes raw values
  // (pct / 100) * 400 + 80
  assert.equal(percentageToNits(0), 80);
  assert.equal(percentageToNits(-50), Math.round((-50 / 100) * 400 + 80)); // -120
});

test("percentageToNits computes correctly above maximum", () => {
  // (150 / 100) * 400 + 80 = 680
  assert.equal(percentageToNits(100), 480);
  assert.equal(percentageToNits(150), Math.round((150 / 100) * 400 + 80)); // 680
});

test("roundtrip conversions are stable", () => {
  for (let pct = 0; pct <= 100; pct += 10) {
    const nits = percentageToNits(pct);
    const back = nitsToPercentage(nits);
    // Allow 1% rounding tolerance
    assert.ok(
      Math.abs(back - pct) <= 1,
      `Roundtrip failed for ${pct}%: got ${back}%`
    );
  }
});

test("LUMINANCE constants are correct", () => {
  assert.equal(LUMINANCE.MIN_NITS, 80);
  assert.equal(LUMINANCE.MAX_NITS, 480);
  assert.equal(LUMINANCE.DEFAULT_MIN_NITS, 80);
  assert.equal(LUMINANCE.DEFAULT_MAX_NITS, 480);
});

test("WINDOW_CONFIG constants are correct", () => {
  assert.equal(WINDOW_CONFIG.WIDTH, 300);
  assert.equal(WINDOW_CONFIG.HEIGHT, 200);
  assert.equal(WINDOW_CONFIG.POSITION_KEY, "hdr-toolbox-window-position");
});

test("HOTKEYS constants are correct", () => {
  assert.equal(HOTKEYS.STEP, 4);
  assert.equal(HOTKEYS.increase, "CommandOrControl+Alt+Up");
  assert.equal(HOTKEYS.decrease, "CommandOrControl+Alt+Down");
});

test("SLIDER constants are correct", () => {
  assert.equal(SLIDER.MIN, 0);
  assert.equal(SLIDER.MAX, 100);
  assert.equal(SLIDER.WHEEL_STEP, 2);
});
