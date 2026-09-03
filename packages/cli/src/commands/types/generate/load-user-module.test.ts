import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it, vi } from "vitest";
import { dirname, join } from "pathe";
import { loadUserModule } from "./load-user-module";

// jiti reads real file paths, so these tests need the real filesystem rather
// than the memfs volume the global setup installs.
vi.unmock("node:fs");
vi.unmock("node:fs/promises");

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

async function createFile(name: string, contents: string): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), "storyblok-user-module-"));
  temporaryDirectories.push(directory);

  const absolutePath = join(directory, name);
  await mkdir(dirname(absolutePath), { recursive: true });
  await writeFile(absolutePath, contents);

  return absolutePath;
}

describe("loadUserModule", () => {
  it("should load compiler options from a TypeScript file", async () => {
    const path = await createFile(
      "compiler-options.ts",
      `const options: { additionalProperties: boolean } = { additionalProperties: false };
export default options;
`,
    );

    await expect(loadUserModule(path)).resolves.toEqual({ additionalProperties: false });
  });

  it("should load compiler options from a JSON file", async () => {
    const path = await createFile("compiler-options.json", `{ "additionalProperties": false }\n`);

    await expect(loadUserModule(path)).resolves.toEqual({ additionalProperties: false });
  });

  it("should load compiler options from a JavaScript file", async () => {
    const path = await createFile(
      "compiler-options.mjs",
      `export default { additionalProperties: false };\n`,
    );

    await expect(loadUserModule(path)).resolves.toEqual({ additionalProperties: false });
  });

  it("should load compiler options from a CommonJS file", async () => {
    const path = await createFile(
      "compiler-options.cjs",
      `module.exports = { additionalProperties: false };\n`,
    );

    await expect(loadUserModule(path)).resolves.toEqual({ additionalProperties: false });
  });

  it("should load a custom fields parser function from a TypeScript file", async () => {
    const path = await createFile(
      "custom-fields-parser.ts",
      `export default function parse(key: string, value: Record<string, unknown>) {
  return { [key]: value };
}
`,
    );

    const parser =
      await loadUserModule<
        (key: string, value: Record<string, unknown>) => Record<string, unknown>
      >(path);

    expect(parser("color", { type: "string" })).toEqual({ color: { type: "string" } });
  });

  it("should reject when the file does not exist", async () => {
    await expect(loadUserModule("/does/not/exist/compiler-options.ts")).rejects.toThrow();
  });
});
