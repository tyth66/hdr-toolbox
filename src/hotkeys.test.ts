import test from "node:test";
import assert from "node:assert/strict";
import {
  formatHotkeyLabel,
  formatHotkeyFromEvent,
  normalizeHotkeyShortcut,
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
    "CommandOrControl+Alt+Up"
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

test("normalizeHotkeyShortcut upgrades legacy ctrl labels to accelerator format", () => {
  assert.equal(
    normalizeHotkeyShortcut("Ctrl+Alt+q"),
    "CommandOrControl+Alt+Q"
  );
});

test("formatHotkeyLabel keeps accelerators user-friendly", () => {
  assert.equal(
    formatHotkeyLabel("CommandOrControl+Alt+Q"),
    "Ctrl+Alt+Q"
  );
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
