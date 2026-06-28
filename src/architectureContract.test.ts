import test from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const srcDir = path.dirname(__filename);
const repoRoot = path.resolve(srcDir, "..");
const tauriSrcDir = path.resolve(repoRoot, "src-tauri", "src");
const tauriConfigPath = path.resolve(repoRoot, "src-tauri", "tauri.conf.json");

function listFiles(root: string, extensions: string[]): string[] {
  const entries = readdirSync(root, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const entryPath = path.join(root, entry.name);
    if (entry.isDirectory()) {
      files.push(...listFiles(entryPath, extensions));
      continue;
    }

    if (entry.isFile() && extensions.some((extension) => entry.name.endsWith(extension))) {
      files.push(entryPath);
    }
  }

  return files;
}

function readFile(filePath: string): string {
  return readFileSync(filePath, "utf8");
}

function relativePath(filePath: string): string {
  return path.relative(repoRoot, filePath).replace(/\\/g, "/");
}

test("frontend Tauri invoke calls stay inside services/tauriApi.ts", () => {
  const allowedPath = "src/services/tauriApi.ts";
  const violations = listFiles(srcDir, [".ts", ".tsx"])
    .filter((filePath) => !filePath.endsWith(".test.ts"))
    .filter((filePath) => relativePath(filePath) !== allowedPath)
    .filter((filePath) => readFile(filePath).includes("invoke("))
    .map(relativePath);

  assert.deepEqual(violations, []);
});

test("display device actions use the display command client instead of Tauri services", () => {
  const actionsSource = readFile(
    path.resolve(srcDir, "hooks", "useDisplayDeviceActions.ts")
  );

  assert.equal(actionsSource.includes("../services/tauriApi"), false);
  assert.match(actionsSource, /DisplayCommandClient/);
});

test("useDisplays composes explicit display state, feedback, and command boundaries", () => {
  const useDisplaysSource = readFile(path.resolve(srcDir, "hooks", "useDisplays.ts"));

  assert.match(useDisplaysSource, /useDisplayStateStore/);
  assert.match(useDisplaysSource, /useDisplayFeedbackState/);
  assert.match(useDisplaysSource, /useDisplayCommandClient/);
  assert.equal(useDisplaysSource.includes("useDisplaySelection"), false);
});

test("DisplayConfig API calls stay inside display/ffi.rs", () => {
  const allowedPath = "src-tauri/src/display/ffi.rs";
  const displayConfigPattern =
    /windows::Win32::Devices::Display|DisplayConfig(Get|Set)|QueryDisplayConfig|GetDisplayConfigBufferSizes|DISPLAYCONFIG_/;
  const violations = listFiles(tauriSrcDir, [".rs"])
    .filter((filePath) => relativePath(filePath) !== allowedPath)
    .filter((filePath) => displayConfigPattern.test(readFile(filePath)))
    .map(relativePath);

  assert.deepEqual(violations, []);
});

test("display command boundary delegates cache and tray synchronization", () => {
  const commandsSource = readFile(
    path.resolve(tauriSrcDir, "display", "commands.rs")
  );
  const directStateSyncPatterns = [
    /\bTrayState::from_displays\b/,
    /\btray::update_tray_(tooltip|menu)\b/,
    /\brefresh_tray\b/,
    /\bstate\.displays\.lock\(/,
    /\bstate\.tray_state\.lock\(/,
  ];

  const violations = directStateSyncPatterns
    .filter((pattern) => pattern.test(commandsSource))
    .map((pattern) => pattern.source);

  assert.deepEqual(violations, []);
});

test("sync brightness uses Rust-owned display state instead of frontend snapshots", () => {
  const tauriApiSource = readFile(path.resolve(srcDir, "services", "tauriApi.ts"));
  const commandClientSource = readFile(
    path.resolve(srcDir, "hooks", "useDisplayCommandClient.ts")
  );
  const deviceActionsSource = readFile(
    path.resolve(srcDir, "hooks", "useDisplayDeviceActions.ts")
  );
  const commandsSource = readFile(
    path.resolve(tauriSrcDir, "display", "commands.rs")
  );

  assert.equal(/export async function setBrightnessAll\(\s*displays/.test(tauriApiSource), false);
  assert.equal(tauriApiSource.includes('"set_brightness_all", { displays,'), false);
  assert.equal(/setBrightnessAll:\s*\(\s*displays/.test(commandClientSource), false);
  assert.equal(deviceActionsSource.includes("commands.setBrightnessAll(\n            displaysRef.current"), false);
  const setBrightnessAllSignature = commandsSource.match(
    /pub fn set_brightness_all\(([\s\S]*?)\)\s*->/
  );
  assert.ok(setBrightnessAllSignature?.[1], "Could not locate set_brightness_all signature");
  assert.equal(setBrightnessAllSignature[1].includes("Vec<DisplayInfo>"), false);
});

test("display service and ffi return structured display errors instead of String errors", () => {
  const checkedFiles = [
    path.resolve(tauriSrcDir, "display", "service.rs"),
    path.resolve(tauriSrcDir, "display", "ffi.rs"),
  ];

  const violations = checkedFiles
    .filter((filePath) => /Result<[^>]*,\s*String>|Vec<Result<[^>]*,\s*String>>/.test(readFile(filePath)))
    .map(relativePath);

  assert.deepEqual(violations, []);
});

test("display command boundary does not classify errors with string matching", () => {
  const commandsSource = readFile(
    path.resolve(tauriSrcDir, "display", "commands.rs")
  );

  assert.equal(commandsSource.includes("map_string_to_display_error"), false);
  assert.equal(commandsSource.includes(".to_lowercase()"), false);
});

test("Tauri global API injection remains disabled", () => {
  const config = JSON.parse(readFile(tauriConfigPath)) as {
    app?: { withGlobalTauri?: boolean };
  };

  assert.equal(config.app?.withGlobalTauri, false);
});
