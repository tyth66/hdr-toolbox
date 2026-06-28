import test from "node:test";
import assert from "node:assert/strict";
import {
  loadThemePreference,
  saveThemePreference,
} from "./themePreference.ts";

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

test("theme preference defaults to system", () => {
  store.clear();

  assert.equal(loadThemePreference(), "system");
});

test("theme preference persists light and dark overrides", () => {
  store.clear();

  saveThemePreference("light");
  assert.equal(loadThemePreference(), "light");

  saveThemePreference("dark");
  assert.equal(loadThemePreference(), "dark");
});

test("theme preference can return to system", () => {
  store.clear();

  saveThemePreference("system");

  assert.equal(loadThemePreference(), "system");
});

test("theme preference ignores invalid stored values", () => {
  store.set("hdr-toolbox-theme-preference", "blue");

  assert.equal(loadThemePreference(), "system");
});
