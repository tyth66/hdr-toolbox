import test from "node:test";
import assert from "node:assert/strict";
import { buildSyncBrightnessOutcomeUpdate } from "./syncBrightnessOutcome.ts";
import type { BrightnessAllOutcome } from "../services/tauriApi.ts";
import type { DisplayInfo } from "../types.ts";

const displays: DisplayInfo[] = [
  {
    name: "Display A",
    nits: 80,
    min_percentage: 0,
    max_percentage: 100,
    hdr_supported: true,
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
    hdr_supported: true,
    hdr_enabled: true,
    adapter_id_low: 4,
    adapter_id_high: 5,
    target_id: 6,
    min_nits: 80,
    max_nits: 480,
  },
];

function outcomeWithFailures(failureCount: number): BrightnessAllOutcome {
  return {
    displays: displays.map((display) => ({ ...display, nits: 480 })),
    failures: Array.from({ length: failureCount }, (_, index) => ({
      adapter_id_low: 10 + index,
      adapter_id_high: 20 + index,
      target_id: 30 + index,
      name: `Failed ${index + 1}`,
      error: {
        code: "SetSdrWhiteLevelFailed",
        message: "failed",
      },
    })),
  };
}

test("sync brightness outcome preserves selection and clears notice on full success", () => {
  const update = buildSyncBrightnessOutcomeUpdate(
    displays[1],
    outcomeWithFailures(0)
  );

  assert.equal(update.selectedIndex, 1);
  assert.equal(update.notice, null);
  assert.equal(update.displays[0].nits, 480);
  assert.equal(update.displays[1].nits, 480);
});

test("sync brightness outcome reports a singular partial failure notice", () => {
  const update = buildSyncBrightnessOutcomeUpdate(
    displays[0],
    outcomeWithFailures(1)
  );

  assert.equal(update.selectedIndex, 0);
  assert.deepEqual(update.notice, {
    title: "Some displays were not updated",
    message: "1 display could not apply the synced brightness.",
  });
});

test("sync brightness outcome reports plural partial failures", () => {
  const update = buildSyncBrightnessOutcomeUpdate(
    displays[0],
    outcomeWithFailures(2)
  );

  assert.equal(update.selectedIndex, 0);
  assert.deepEqual(update.notice, {
    title: "Some displays were not updated",
    message: "2 displays could not apply the synced brightness.",
  });
});
