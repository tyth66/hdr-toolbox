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

test("Tauri global API injection remains disabled", () => {
  const config = JSON.parse(readFile(tauriConfigPath)) as {
    app?: { withGlobalTauri?: boolean };
  };

  assert.equal(config.app?.withGlobalTauri, false);
});
