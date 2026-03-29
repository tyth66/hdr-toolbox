import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

type FieldContract = {
  name: string;
  type: string;
  optional: boolean;
};

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const typesPath = path.resolve(__dirname, "types.ts");
const rustModelPath = path.resolve(__dirname, "..", "src-tauri", "src", "display", "model.rs");

function readFile(filePath: string): string {
  return readFileSync(filePath, "utf8");
}

function extractBlock(source: string, startPattern: RegExp): string {
  const match = source.match(startPattern);
  assert.ok(match?.[1], `Could not locate block for pattern ${startPattern}`);
  return match[1];
}

function extractTsDisplayInfoFields(source: string): FieldContract[] {
  const block = extractBlock(source, /export interface DisplayInfo\s*\{([\s\S]*?)\n\}/);
  const fields: FieldContract[] = [];

  for (const line of block.split("\n")) {
    const match = line.match(/^\s*([a-zA-Z0-9_]+)(\?)?:\s*([^;]+);/);
    if (!match) {
      continue;
    }

    fields.push({
      name: match[1],
      optional: match[2] === "?",
      type: match[3].trim(),
    });
  }

  return fields;
}

function normalizeRustType(rustType: string): Omit<FieldContract, "name"> {
  const normalized = rustType.trim();

  if (normalized === "String") {
    return { type: "string", optional: false };
  }

  if (normalized === "bool") {
    return { type: "boolean", optional: false };
  }

  if (["u32", "i32"].includes(normalized)) {
    return { type: "number", optional: false };
  }

  const optionMatch = normalized.match(/^Option<(.+)>$/);
  if (optionMatch) {
    const inner = normalizeRustType(optionMatch[1]);
    return { ...inner, optional: true };
  }

  throw new Error(`Unsupported Rust field type in DisplayInfo contract test: ${normalized}`);
}

function extractRustDisplayInfoFields(source: string): FieldContract[] {
  const block = extractBlock(source, /pub struct DisplayInfo\s*\{([\s\S]*?)\n\}/);
  const fields: FieldContract[] = [];

  for (const line of block.split("\n")) {
    const match = line.match(/^\s*pub\s+([a-zA-Z0-9_]+):\s*([^,]+),/);
    if (!match) {
      continue;
    }

    fields.push({
      name: match[1],
      ...normalizeRustType(match[2]),
    });
  }

  return fields;
}

function extractRustConstValue(source: string, constantName: string): number {
  const match = source.match(new RegExp(`pub const ${constantName}: u32 = (\\d+);`));
  assert.ok(match?.[1], `Could not locate Rust constant ${constantName}`);
  return Number(match[1]);
}

test("TypeScript DisplayInfo matches Rust DisplayInfo contract", () => {
  const tsSource = readFile(typesPath);
  const rustSource = readFile(rustModelPath);

  const tsFields = extractTsDisplayInfoFields(tsSource);
  const rustFields = extractRustDisplayInfoFields(rustSource);

  assert.deepEqual(tsFields, rustFields);
});

test("TypeScript luminance constants match Rust luminance constants", async () => {
  const tsSource = await import("./types.ts");
  const rustSource = readFile(rustModelPath);

  assert.equal(
    tsSource.LUMINANCE.MIN_NITS,
    extractRustConstValue(rustSource, "MIN_NITS")
  );
  assert.equal(
    tsSource.LUMINANCE.MAX_NITS,
    extractRustConstValue(rustSource, "MAX_NITS")
  );
});
