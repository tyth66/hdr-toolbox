import test from "node:test";
import assert from "node:assert/strict";
import { getWheelBrightnessPercentage } from "./brightnessInteraction.ts";

test("wheel brightness increases on upward wheel input", () => {
  assert.equal(getWheelBrightnessPercentage(50, -100), 52);
});

test("wheel brightness decreases on downward wheel input", () => {
  assert.equal(getWheelBrightnessPercentage(50, 100), 48);
});

test("wheel brightness stays within slider bounds", () => {
  assert.equal(getWheelBrightnessPercentage(99, -100), 100);
  assert.equal(getWheelBrightnessPercentage(1, 100), 0);
});

test("wheel brightness returns the current value at bounds", () => {
  assert.equal(getWheelBrightnessPercentage(100, -100), 100);
  assert.equal(getWheelBrightnessPercentage(0, 100), 0);
});
