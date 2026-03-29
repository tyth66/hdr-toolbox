import test from "node:test";
import assert from "node:assert/strict";
import { LUMINANCE, nitsToPercentage, percentageToNits } from "./types.ts";

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
