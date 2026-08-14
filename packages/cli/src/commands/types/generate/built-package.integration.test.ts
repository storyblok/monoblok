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
    const cliPath = resolve(import.meta.dirname, "../../../../dist/index.mjs");

    await execFileAsync(process.execPath, [
      cliPath,
      "types",
      "generate",
      "--space",
      "12345",
      "--path",
      workspace,
      "--verbose",
    ]);

    const storyblokTypes = await fs.readFile(resolve(workspace, "types/storyblok.d.ts"), "utf8");
    const componentTypes = await fs.readFile(
      resolve(workspace, "types/12345/storyblok-components.d.ts"),
      "utf8",
    );

    expect(storyblokTypes).toContain("interface StoryblokAsset");
    expect(storyblokTypes).toContain("export { StoryblokAsset");
    expect(storyblokTypes).not.toContain('import "dotenv/config"');
    expect(storyblokTypes).not.toContain('from "commander"');
    expect(storyblokTypes).not.toContain("sourceMappingURL");
    expect(componentTypes).toContain("export interface Hero");
    expect(componentTypes).toContain("title: string");
  });
});
