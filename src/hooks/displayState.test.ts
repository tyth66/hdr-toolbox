import test from "node:test";
import assert from "node:assert/strict";
import {
  buildBrightnessUpdate,
  findMatchingDisplayIndex,
  getSelectedDisplaySnapshot,
} from "./displayState.ts";
import type { DisplayInfo } from "../types.ts";

const displays: DisplayInfo[] = [
  {
    name: "Display A",
    nits: 80,
    min_percentage: 0,
    max_percentage: 100,
    hdr_enabled: true,
    adapter_id_low: 1,
    adapter_id_high: 2,
    target_id: 3,
    min_nits: 80,
    max_nits: 480,
  },
  {
    name: "Display B",
    nits: 280,
    min_percentage: 0,
    max_percentage: 100,
    hdr_enabled: false,
    adapter_id_low: 4,
    adapter_id_high: 5,
    target_id: 6,
    min_nits: 80,
    max_nits: 480,
  },
];

test("getSelectedDisplaySnapshot returns derived state for a valid display", () => {
  assert.deepEqual(getSelectedDisplaySnapshot(displays, 1), {
    selectedIndex: 1,
    currentPercentage: 50,
    hdrActive: false,
  });
});

test("getSelectedDisplaySnapshot returns null for an invalid index", () => {
  assert.equal(getSelectedDisplaySnapshot(displays, -1), null);
  assert.equal(getSelectedDisplaySnapshot(displays, 5), null);
});

test("buildBrightnessUpdate only updates the targeted display", () => {
  const updated = buildBrightnessUpdate(displays, 1, 100);
  assert.equal(updated[0].nits, 80);
  assert.equal(updated[1].nits, 480);
  assert.equal(updated[0], displays[0]);
  assert.notEqual(updated[1], displays[1]);
});

test("findMatchingDisplayIndex restores the previously selected display when it still exists", () => {
  assert.equal(findMatchingDisplayIndex(displays, displays[1]), 1);
});

test("findMatchingDisplayIndex falls back to no selection when the display is gone", () => {
  assert.equal(
    findMatchingDisplayIndex(displays, {
      ...displays[0],
      adapter_id_low: 99,
    }),
    -1
  );
});
