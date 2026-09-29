import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it, vi } from "vitest";
import { dirname, join } from "pathe";
import { importUserModuleDefault } from "./user-module";

// jiti reads real file paths, so these tests need the real filesystem rather
// than the memfs volume the global setup installs.
vi.unmock("node:fs");
vi.unmock("node:fs/promises");

const temporaryDirectories: string[] = [];

afterEach(async () => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

async function createProject(files: Record<string, string>): Promise<string> {
  const cwd = await mkdtemp(join(tmpdir(), "storyblok-user-module-"));
  temporaryDirectories.push(cwd);

  for (const [relativePath, contents] of Object.entries(files)) {
    const absolutePath = join(cwd, relativePath);
    await mkdir(dirname(absolutePath), { recursive: true });
    await writeFile(absolutePath, contents);
  }

  return cwd;
}

const OPTIONS = { additionalProperties: false };

describe("importUserModuleDefault", () => {
  it.each([
    [
      "TypeScript",
      "options.ts",
      `const options: { additionalProperties: boolean } = { additionalProperties: false };
export default options;
`,
    ],
    ["ES module", "options.mjs", `export default { additionalProperties: false };\n`],
    ["CommonJS", "options.cjs", `module.exports = { additionalProperties: false };\n`],
    ["CommonJS TypeScript", "options.cts", `module.exports = { additionalProperties: false };\n`],
    ["JSON", "options.json", `{ "additionalProperties": false }\n`],
  ])("should return the default export of a %s file", async (_format, fileName, contents) => {
    const cwd = await createProject({ [fileName]: contents });

    await expect(importUserModuleDefault(join(cwd, fileName), "Options file")).resolves.toEqual(
      OPTIONS,
    );
  });

  it("should return a default-exported function", async () => {
    const cwd = await createProject({
      "parser.ts": `export default function parse(key: string) {
  return { [key]: { tsType: "string" } };
}
`,
    });

    const parser = await importUserModuleDefault(join(cwd, "parser.ts"), "Parser file");

    expect(typeof parser === "function" && parser("color")).toEqual({
      color: { tsType: "string" },
    });
  });

  it("should return a JSON document whose top-level value is not an object", async () => {
    const cwd = await createProject({ "options.json": "null\n" });

    await expect(
      importUserModuleDefault(join(cwd, "options.json"), "Options file"),
    ).resolves.toBeNull();
  });

  it("should name the file when its JSON is invalid", async () => {
    const cwd = await createProject({ "options.json": "{ additionalProperties: false }\n" });

    await expect(
      importUserModuleDefault(join(cwd, "options.json"), "Options file"),
    ).rejects.toThrow(`Options file at "${join(cwd, "options.json")}" is not valid JSON`);
  });

  it("should return undefined when the file has only named exports", async () => {
    const cwd = await createProject({
      "options.ts": `export const additionalProperties = false;\n`,
    });

    await expect(
      importUserModuleDefault(join(cwd, "options.ts"), "Options file"),
    ).resolves.toBeUndefined();
  });

  it("should resolve a relative path against the working directory", async () => {
    const cwd = await createProject({
      "config/options.ts": `export default { additionalProperties: false };\n`,
    });
    vi.spyOn(process, "cwd").mockReturnValue(cwd);

    await expect(importUserModuleDefault("./config/options.ts", "Options file")).resolves.toEqual(
      OPTIONS,
    );
  });

  it("should resolve imports that use a tsconfig path alias", async () => {
    const cwd = await createProject({
      "tsconfig.json": JSON.stringify({
        compilerOptions: { baseUrl: ".", paths: { "@/*": ["./src/*"] } },
      }),
      "src/shared.ts": `export const additionalProperties = false;\n`,
      "options.ts": `import { additionalProperties } from "@/shared";
export default { additionalProperties };
`,
    });

    await expect(importUserModuleDefault(join(cwd, "options.ts"), "Options file")).resolves.toEqual(
      OPTIONS,
    );
  });

  it("should skip alias resolution when JITI_TSCONFIG_PATHS is false", async () => {
    // A tsconfig that extends an uninstalled package throws while being read,
    // which otherwise blocks a file that uses no aliases at all.
    const project = {
      "tsconfig.json": JSON.stringify({ extends: "@tsconfig/node20/tsconfig.json" }),
      "options.ts": `export default { additionalProperties: false };\n`,
    };
    const brokenCwd = await createProject(project);
    await expect(
      importUserModuleDefault(join(brokenCwd, "options.ts"), "Options file"),
    ).rejects.toThrow("File '@tsconfig/node20/tsconfig.json' not found.");

    vi.stubEnv("JITI_TSCONFIG_PATHS", "false");
    const cwd = await createProject(project);

    await expect(importUserModuleDefault(join(cwd, "options.ts"), "Options file")).resolves.toEqual(
      OPTIONS,
    );
  });

  it("should name the file and path when the file does not exist", async () => {
    await expect(
      importUserModuleDefault("./does-not-exist/options.ts", "Compiler options file"),
    ).rejects.toThrow('Compiler options file not found at "./does-not-exist/options.ts".');
  });

  it("should report a missing import as such rather than as a missing file", async () => {
    const cwd = await createProject({
      "options.ts": `import { value } from "./missing";
export default { value };
`,
    });

    await expect(importUserModuleDefault(join(cwd, "options.ts"), "Options file")).rejects.toThrow(
      /Cannot find module '\.\/missing'/,
    );
  });
});
