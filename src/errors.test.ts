import test from "node:test";
import assert from "node:assert/strict";
import { mapInitialLoadError, mapRefreshError } from "./errors.ts";

test("mapInitialLoadError recognizes HDR-capable display empty-state errors", () => {
  assert.equal(
    mapInitialLoadError(
      "No HDR-capable displays found. Ensure your monitor supports HDR and the display driver is working correctly."
    ),
    "No HDR-capable displays found. Check your display connection or Windows display settings, then refresh and try again."
  );
});

test("mapRefreshError uses the no-display messaging for HDR-capable display empty state", () => {
  assert.deepEqual(
    mapRefreshError("No HDR-capable displays found.", false),
    {
      title: "No HDR-capable displays found",
      message: "Check your display connection or Windows display settings, then refresh and try again.",
    }
  );
});
