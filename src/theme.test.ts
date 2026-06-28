import test from "node:test";
import assert from "node:assert/strict";
import {
  buildFluentBrandRamp,
  createSystemAccentTheme,
  resolveEffectiveThemePreference,
} from "./theme.ts";

test("system theme preference follows the OS color scheme", () => {
  assert.equal(resolveEffectiveThemePreference("system", true), "dark");
  assert.equal(resolveEffectiveThemePreference("system", false), "light");
});

test("explicit theme preference overrides the OS color scheme", () => {
  assert.equal(resolveEffectiveThemePreference("dark", false), "dark");
  assert.equal(resolveEffectiveThemePreference("light", true), "light");
});

test("Fluent brand ramp is generated from the Windows accent color", () => {
  const ramp = buildFluentBrandRamp("#336699");

  assert.equal(ramp[80], "#336699");
  assert.equal(ramp[10], "#f6fafe");
  assert.equal(ramp[160], "#0d1926");
});

test("invalid accent colors fall back to Windows blue", () => {
  const ramp = buildFluentBrandRamp("not-a-color");

  assert.equal(ramp[80], "#0078d4");
});

test("system accent theme preserves base theme and overrides Fluent brand tokens", () => {
  const theme = createSystemAccentTheme(
    {
      colorNeutralBackground1: "#111111",
      colorBrandBackground: "#old",
    },
    "#336699"
  );

  assert.equal(theme.colorNeutralBackground1, "#111111");
  assert.equal(theme.colorBrandBackground, "#336699");
  assert.equal(theme.colorBrandBackgroundHover, "#2b5782");
  assert.equal(theme.colorCompoundBrandStrokePressed, "#24476b");
});
