import { execFile } from "node:child_process";
import { tmpdir } from "node:os";
import { promisify } from "node:util";
import { resolve } from "pathe";
import { afterEach, describe, expect, it, vi } from "vitest";

const execFileAsync = promisify(execFile);
const temporaryDirectories: string[] = [];

const createCliWorkspace = async () => {
  const fs = await vi.importActual<typeof import("node:fs/promises")>("node:fs/promises");
  const directory = await fs.mkdtemp(resolve(tmpdir(), "storyblok-cli-types-"));
  const componentsDirectory = resolve(directory, "components", "12345");

  temporaryDirectories.push(directory);
  await fs.mkdir(componentsDirectory, { recursive: true });
  await fs.writeFile(
    resolve(componentsDirectory, "components.json"),
    JSON.stringify([
      {
        name: "hero",
        display_name: "Hero",
        id: 1,
        schema: {
          title: {
            type: "text",
            required: true,
          },
        },
        is_root: true,
        is_nestable: false,
      },
    ]),
  );

  return directory;
};

const runTypesGenerate = async (workspace: string) => {
  const fs = await vi.importActual<typeof import("node:fs/promises")>("node:fs/promises");
  // Resolved through `bin` rather than hardcoded: a build-output rename is exactly the
  // failure this test guards against, so the test must not restate the layout.
  const packageRoot = resolve(import.meta.dirname, "../../../..");
  const { bin } = JSON.parse(await fs.readFile(resolve(packageRoot, "package.json"), "utf8"));

  return execFileAsync(process.execPath, [
    resolve(packageRoot, bin.storyblok),
    "types",
    "generate",
    "--space",
    "12345",
    "--path",
    workspace,
    "--verbose",
  ]);
};

afterEach(async () => {
  const fs = await vi.importActual<typeof import("node:fs/promises")>("node:fs/promises");
  await Promise.all(
    temporaryDirectories.splice(0).map((directory) =>
      fs.rm(directory, {
        recursive: true,
        force: true,
      }),
    ),
  );
});

describe("types generate built package", () => {
  it("should generate declarations using the packaged CLI types", async () => {
    const fs = await vi.importActual<typeof import("node:fs/promises")>("node:fs/promises");
    const workspace = await createCliWorkspace();

    await runTypesGenerate(workspace);

    const storyblokTypes = await fs.readFile(resolve(workspace, "types/storyblok.d.ts"), "utf8");
    const componentTypes = await fs.readFile(
      resolve(workspace, "types/12345/storyblok-components.d.ts"),
      "utf8",
    );

    expect(storyblokTypes).toContain("interface StoryblokAsset");
    expect(storyblokTypes).toContain("export { StoryblokAsset");
    expect(componentTypes).toContain("export interface Hero");
    expect(componentTypes).toContain("title: string");
  });

  it("should generate a self-contained storyblok.d.ts", async () => {
    const fs = await vi.importActual<typeof import("node:fs/promises")>("node:fs/promises");
    const workspace = await createCliWorkspace();

    await runTypesGenerate(workspace);

    const storyblokTypes = await fs.readFile(resolve(workspace, "types/storyblok.d.ts"), "utf8");

    // The file lands in the user's project, where nothing the CLI bundle exposes is
    // resolvable. Enumerating the imports beats denying known offenders one by one:
    // it also covers whatever a future bundler decides to hoist.
    const imports = [
      ...storyblokTypes.matchAll(/^(?:import|export)\b[^;]*\bfrom\s*["']([^"']+)/gm),
    ];

    expect(imports.map(([, specifier]) => specifier)).toEqual(["@storyblok/js"]);
    expect(storyblokTypes).not.toMatch(/^import\s*["']/m);
    expect(storyblokTypes).not.toContain("sourceMappingURL");
    expect(storyblokTypes).not.toContain("//#region");
    expect(storyblokTypes).not.toContain("//#endregion");
  });

  it("should type the asset id as nullable in the shipped declarations", async () => {
    const fs = await vi.importActual<typeof import("node:fs/promises")>("node:fs/promises");
    const workspace = await createCliWorkspace();

    await runTypesGenerate(workspace);

    const storyblokTypes = await fs.readFile(resolve(workspace, "types/storyblok.d.ts"), "utf8");
    const storyblokAsset = storyblokTypes.slice(storyblokTypes.indexOf("interface StoryblokAsset"));

    // Assets that are not stored in Storyblok (external URLs) come back with a null id,
    // and the asset field value spec types it as nullable. Asserted on the generated
    // file rather than in a type test because tsconfig excludes *.test.ts from
    // `test:types`, so a type assertion in a test would never be checked.
    expect(storyblokAsset).toMatch(/^\s*id: number \| null;$/m);
  });
});
