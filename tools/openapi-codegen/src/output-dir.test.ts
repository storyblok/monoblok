import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "pathe";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { clearGeneratedOutput, GENERATED_SUBDIRS } from "./output-dir.ts";

describe("clearGeneratedOutput", () => {
  let outDir: string;

  beforeEach(() => {
    outDir = resolve(mkdtempSync(resolve(tmpdir(), "openapi-codegen-test-")), "generated");
  });

  afterEach(() => {
    rmSync(resolve(outDir, ".."), { recursive: true, force: true });
  });

  it("should remove every subdirectory the generator owns", () => {
    for (const dir of GENERATED_SUBDIRS) {
      mkdirSync(resolve(outDir, dir), { recursive: true });
      writeFileSync(resolve(outDir, dir, "types.gen.ts"), "");
    }

    clearGeneratedOutput(outDir);

    for (const dir of GENERATED_SUBDIRS) {
      expect(existsSync(resolve(outDir, dir))).toBe(false);
    }
  });

  it("should keep files the generator doesn't own", () => {
    mkdirSync(resolve(outDir, "overlay"), { recursive: true });
    writeFileSync(resolve(outDir, "render-map.generated.ts"), "");

    clearGeneratedOutput(outDir);

    expect(existsSync(resolve(outDir, "render-map.generated.ts"))).toBe(true);
  });

  it("should create a missing outDir", () => {
    clearGeneratedOutput(outDir);

    expect(existsSync(outDir)).toBe(true);
  });
});
