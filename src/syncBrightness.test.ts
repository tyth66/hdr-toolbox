import test from "node:test";
import assert from "node:assert/strict";
import {
  loadSyncBrightnessEnabled,
  saveSyncBrightnessEnabled,
} from "./syncBrightness.ts";

const store = new Map<string, string>();

Object.defineProperty(globalThis, "window", {
  configurable: true,
  value: {
    localStorage: {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => {
        store.set(key, value);
      },
      clear: () => {
        store.clear();
      },
    },
  },
});

test("sync brightness defaults to disabled", () => {
  store.clear();

  assert.equal(loadSyncBrightnessEnabled(), false);
});

test("sync brightness persists enabled state", () => {
  store.clear();

  saveSyncBrightnessEnabled(true);

  assert.equal(loadSyncBrightnessEnabled(), true);
});

test("sync brightness falls back to disabled for invalid stored values", () => {
  store.set("brightbox-sync-brightness", "not-json");

  assert.equal(loadSyncBrightnessEnabled(), false);
});
