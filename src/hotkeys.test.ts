import test from "node:test";
import assert from "node:assert/strict";
import {
  formatHotkeyFromEvent,
  normalizeHotkeyKey,
  validateHotkeys,
} from "./hotkeys.ts";

test("formatHotkeyFromEvent captures modifier combinations", () => {
  assert.equal(
    formatHotkeyFromEvent({
      key: "ArrowUp",
      ctrlKey: true,
      altKey: true,
      shiftKey: false,
      metaKey: false,
    }),
    "Ctrl+Alt+Up"
  );
});

test("formatHotkeyFromEvent rejects modifier-only input", () => {
  assert.equal(
    formatHotkeyFromEvent({
      key: "Control",
      ctrlKey: true,
      altKey: false,
      shiftKey: false,
      metaKey: false,
    }),
    null
  );
});

test("normalizeHotkeyKey normalizes supported special keys", () => {
  assert.equal(normalizeHotkeyKey(" "), "Space");
  assert.equal(normalizeHotkeyKey("F8"), "F8");
  assert.equal(normalizeHotkeyKey("q"), "Q");
});

test("validateHotkeys rejects duplicate bindings", () => {
  assert.equal(
    validateHotkeys({
      increase: "Ctrl+Alt+Up",
      decrease: "Ctrl+Alt+Up",
    }),
    "Brightness up and down shortcuts must be different."
  );
});
