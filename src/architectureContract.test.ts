import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync } from "node:fs";
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

test("app surfaces stay split between state shells and the main shell", () => {
  const appSurfacesPath = path.resolve(srcDir, "components", "AppSurfaces.tsx");
  const appStateSurfacesPath = path.resolve(srcDir, "components", "AppStateSurfaces.tsx");
  const mainSurfacePath = path.resolve(srcDir, "components", "MainSurface.tsx");
  const appSurfacesSource = readFile(appSurfacesPath);
  const mainSurfaceSource = readFile(mainSurfacePath);

  assert.equal(existsSync(appStateSurfacesPath), true);
  assert.equal(existsSync(mainSurfacePath), true);
  assert.doesNotMatch(appSurfacesSource, /function\s+(LoadingSurface|ErrorSurface|EmptySurface|MainSurface)/);
  assert.match(appSurfacesSource, /export \{[^}]*LoadingSurface[^}]*\} from "\.\/AppStateSurfaces"/s);
  assert.match(appSurfacesSource, /export \{[^}]*MainSurface[^}]*\} from "\.\/MainSurface"/s);
  assert.match(mainSurfaceSource, /type MainSurfaceDisplayProps/);
  assert.match(mainSurfaceSource, /type MainSurfaceSettingsProps/);
  assert.match(mainSurfaceSource, /type MainSurfaceBrightnessProps/);
  assert.match(mainSurfaceSource, /type MainSurfaceActions/);
});

test("app controller composes focused controller hooks", () => {
  const useAppControllerSource = readFile(path.resolve(srcDir, "app", "useAppController.ts"));

  assert.match(useAppControllerSource, /useDialogController/);
  assert.match(useAppControllerSource, /useSettingsController/);
  assert.match(useAppControllerSource, /useHotkeyController/);
  assert.match(useAppControllerSource, /useTrayDisplayEvents/);
  assert.doesNotMatch(useAppControllerSource, /window\.addEventListener/);
  assert.doesNotMatch(useAppControllerSource, /\blisten\(/);
  assert.doesNotMatch(useAppControllerSource, /\bisEnabled\(/);
});

test("tray wake refresh reads known hardware state instead of full discovery", () => {
  const trayEventsSource = readFile(path.resolve(srcDir, "app", "useTrayDisplayEvents.ts"));
  const appControllerSource = readFile(path.resolve(srcDir, "app", "useAppController.ts"));

  assert.match(trayEventsSource, /refreshKnownDisplayState\(\{\s*silent:\s*true\s*\}\)/);
  assert.doesNotMatch(trayEventsSource, /refreshDisplays\(\{\s*silent:\s*true\s*\}\)/);
  assert.match(appControllerSource, /refreshKnownDisplayState/);
});

test("frontend exposes separate full discovery and known-state refresh commands", () => {
  const tauriApiSource = readFile(path.resolve(srcDir, "services", "tauriApi.ts"));
  const commandClientSource = readFile(
    path.resolve(srcDir, "hooks", "useDisplayCommandClient.ts")
  );
  const deviceActionsSource = readFile(
    path.resolve(srcDir, "hooks", "useDisplayDeviceActions.ts")
  );

  assert.match(tauriApiSource, /export async function getHdrDisplays/);
  assert.match(tauriApiSource, /export async function refreshCachedDisplays/);
  assert.match(tauriApiSource, /export async function refreshKnownDisplayState/);
  assert.match(tauriApiSource, /invoke<DisplayInfo\[\]>\("refresh_cached_displays"\)/);
  assert.match(tauriApiSource, /invoke<DisplayInfo\[\]>\("refresh_known_display_state"\)/);
  assert.match(commandClientSource, /getDisplays:\s*getHdrDisplays/);
  assert.match(commandClientSource, /refreshCachedDisplays/);
  assert.match(commandClientSource, /refreshKnownDisplayState/);
  assert.match(deviceActionsSource, /runDisplayRefresh\(commands\.getDisplays/);
  assert.match(deviceActionsSource, /runDisplayRefresh\(commands\.refreshCachedDisplays/);
  assert.match(deviceActionsSource, /runDisplayRefresh\(commands\.refreshKnownDisplayState/);
});

test("focused window state refresh uses known-device hardware reads", () => {
  const appControllerSource = readFile(path.resolve(srcDir, "app", "useAppController.ts"));

  assert.match(appControllerSource, /onFocusChanged/);
  assert.match(appControllerSource, /refreshKnownDisplayState\(\{\s*silent:\s*true\s*\}\)/);
});

test("silent known-state refresh does not drive visible refresh indicator", () => {
  const feedbackSource = readFile(
    path.resolve(srcDir, "hooks", "useDisplayFeedbackState.ts")
  );

  assert.match(
    feedbackSource,
    /beginRefresh\s*=\s*useCallback\(\(\{\s*initial,\s*silent\s*\}/
  );
  assert.match(
    feedbackSource,
    /finishRefresh\s*=\s*useCallback\(\(\{\s*initial,\s*silent\s*\}/
  );
  assert.match(feedbackSource, /if\s*\(\s*silent\s*\)\s*\{\s*return;\s*\}/);
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

test("physical monitor configuration calls stay inside display/ddcci.rs", () => {
  const allowedPath = "src-tauri/src/display/ddcci.rs";
  const allowedFile = path.resolve(repoRoot, allowedPath);
  const physicalMonitorPattern =
    /GetPhysicalMonitorsFromHMONITOR|DestroyPhysicalMonitors|GetMonitorBrightness|SetMonitorBrightness|GetVCPFeatureAndVCPFeatureReply|SetVCPFeature/;

  assert.equal(existsSync(allowedFile), true);

  const violations = listFiles(tauriSrcDir, [".rs"])
    .filter((filePath) => relativePath(filePath) !== allowedPath)
    .filter((filePath) => physicalMonitorPattern.test(readFile(filePath)))
    .map(relativePath);

  assert.deepEqual(violations, []);
});

test("WMI brightness calls stay inside display/wmi.rs", () => {
  const allowedPath = "src-tauri/src/display/wmi.rs";
  const allowedFile = path.resolve(repoRoot, allowedPath);
  const wmiBrightnessPattern =
    /WmiMonitorBrightness|WmiMonitorBrightnessMethods|IWbemServices|IWbemLocator|ROOT\\\\WMI|root\\\\wmi/i;

  assert.equal(existsSync(allowedFile), true);

  const violations = listFiles(tauriSrcDir, [".rs"])
    .filter((filePath) => relativePath(filePath) !== allowedPath)
    .filter((filePath) => wmiBrightnessPattern.test(readFile(filePath)))
    .map(relativePath);

  assert.deepEqual(violations, []);
});

test("display service delegates provider merge and writer routing to dedicated modules", () => {
  const mergePath = path.resolve(tauriSrcDir, "display", "merge.rs");
  const writerPath = path.resolve(tauriSrcDir, "display", "writer.rs");
  const serviceSource = readFile(path.resolve(tauriSrcDir, "display", "service.rs"));

  assert.equal(existsSync(mergePath), true);
  assert.equal(existsSync(writerPath), true);
  assert.equal(/fn\s+merge_ddc_display\b/.test(serviceSource), false);
  assert.equal(/fn\s+merge_wmi_display\b/.test(serviceSource), false);
  assert.equal(/match\s+display\.brightness_source/.test(serviceSource), false);
});

test("display brightness projection is centralized outside command and session boundaries", () => {
  const projectionPath = path.resolve(tauriSrcDir, "display", "projection.rs");
  const commandsSource = readFile(path.resolve(tauriSrcDir, "display", "commands.rs"));
  const sessionSource = readFile(path.resolve(tauriSrcDir, "display", "session.rs"));

  assert.equal(existsSync(projectionPath), true);
  assert.equal(/match\s+display\.brightness_source/.test(commandsSource), false);
  assert.equal(/match\s+display\.brightness_source/.test(sessionSource), false);
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

test("cached display refresh command does not run provider enumeration", () => {
  const commandsSource = readFile(
    path.resolve(tauriSrcDir, "display", "commands.rs")
  );
  const libSource = readFile(path.resolve(tauriSrcDir, "lib.rs"));
  const commandMatch = commandsSource.match(
    /pub fn refresh_cached_displays\([\s\S]*?\n\}/
  );

  assert.ok(commandMatch?.[0], "Could not locate refresh_cached_displays command");
  assert.match(commandMatch[0], /sync_cached_display_state/);
  assert.doesNotMatch(commandMatch[0], /get_hdr_displays_impl|enumerate_all_brightness_displays/);
  assert.match(libSource, /refresh_cached_displays/);
});

test("known display state refresh command updates cache and falls back through service discovery only on invalid identity", () => {
  const commandsSource = readFile(
    path.resolve(tauriSrcDir, "display", "commands.rs")
  );
  const serviceSource = readFile(path.resolve(tauriSrcDir, "display", "service.rs"));
  const libSource = readFile(path.resolve(tauriSrcDir, "lib.rs"));
  const commandMatch = commandsSource.match(
    /pub fn refresh_known_display_state\([\s\S]*?\n\}/
  );

  assert.ok(commandMatch?.[0], "Could not locate refresh_known_display_state command");
  assert.match(commandMatch[0], /refresh_known_display_state_impl/);
  assert.match(commandMatch[0], /sync_display_cache/);
  assert.doesNotMatch(commandMatch[0], /enumerate_all_brightness_displays/);
  assert.match(serviceSource, /read_known_display_state/);
  assert.match(serviceSource, /get_hdr_displays_impl\(\)/);
  assert.match(libSource, /refresh_known_display_state/);
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
