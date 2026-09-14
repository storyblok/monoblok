import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it, vi } from "vitest";
import { dirname, join } from "pathe";
import { loadConfig } from "./loader";

// The loader hands real file paths to jiti, so these tests need the real
// filesystem rather than the memfs volume the global setup installs.
vi.unmock("node:fs");
vi.unmock("node:fs/promises");

const temporaryDirectories: string[] = [];

afterEach(async () => {
  vi.unstubAllEnvs();
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

async function createProject(files: Record<string, string>): Promise<string> {
  const cwd = await mkdtemp(join(tmpdir(), "storyblok-config-"));
  temporaryDirectories.push(cwd);

  for (const [relativePath, contents] of Object.entries(files)) {
    const absolutePath = join(cwd, relativePath);
    await mkdir(dirname(absolutePath), { recursive: true });
    await writeFile(absolutePath, contents);
  }

  return cwd;
}

function loadProjectConfig(cwd: string) {
  return loadConfig({ name: "storyblok", cwd, configFile: "storyblok.config" });
}

const CONFIG_FILE = (specifier: string) => `
import { STORYBLOK_SPACE_ID } from '${specifier}';

export default { space: STORYBLOK_SPACE_ID };
`;

const SPACE_FILE = (space: string) => `export const STORYBLOK_SPACE_ID = '${space}';\n`;

describe("loadConfig", () => {
  it("should resolve imports that use a tsconfig path alias", async () => {
    const cwd = await createProject({
      "tsconfig.json": JSON.stringify({
        compilerOptions: { baseUrl: ".", paths: { "@/*": ["./src/*"] } },
      }),
      "src/services/storyblok.env.ts": SPACE_FILE("12345"),
      "storyblok.config.ts": CONFIG_FILE("@/services/storyblok.env"),
    });

    const { config } = await loadProjectConfig(cwd);

    expect(config).toMatchObject({ space: "12345" });
  });

  it("should fall back to the next target when the first one does not exist", async () => {
    const cwd = await createProject({
      "tsconfig.json": JSON.stringify({
        compilerOptions: { paths: { "@/*": ["./dist/*", "./src/*"] } },
      }),
      "src/storyblok.env.ts": SPACE_FILE("23456"),
      "storyblok.config.ts": CONFIG_FILE("@/storyblok.env"),
    });

    const { config } = await loadProjectConfig(cwd);

    expect(config).toMatchObject({ space: "23456" });
  });

  it("should resolve an alias whose wildcard is not at the end of the pattern", async () => {
    const cwd = await createProject({
      "tsconfig.json": JSON.stringify({
        compilerOptions: { paths: { "@app/*/env": ["./src/*/storyblok.env.ts"] } },
      }),
      "src/services/storyblok.env.ts": SPACE_FILE("34567"),
      "storyblok.config.ts": CONFIG_FILE("@app/services/env"),
    });

    const { config } = await loadProjectConfig(cwd);

    expect(config).toMatchObject({ space: "34567" });
  });

  it("should resolve aliases inherited from an extended tsconfig", async () => {
    const cwd = await createProject({
      "tsconfig.base.json": JSON.stringify({
        compilerOptions: { baseUrl: ".", paths: { "@/*": ["./src/*"] } },
      }),
      "tsconfig.json": JSON.stringify({ extends: "./tsconfig.base.json" }),
      "src/storyblok.env.ts": SPACE_FILE("45678"),
      "storyblok.config.ts": CONFIG_FILE("@/storyblok.env"),
    });

    const { config } = await loadProjectConfig(cwd);

    expect(config).toMatchObject({ space: "45678" });
  });

  it("should skip alias resolution when JITI_TSCONFIG_PATHS is false", async () => {
    // A tsconfig that extends an uninstalled package throws while being read,
    // which otherwise blocks a config file that uses no aliases at all.
    const project = {
      "tsconfig.json": JSON.stringify({ extends: "@tsconfig/node20/tsconfig.json" }),
      "storyblok.config.ts": `export default { space: '67890' };\n`,
    };
    await expect(loadProjectConfig(await createProject(project))).rejects.toThrow(
      "File '@tsconfig/node20/tsconfig.json' not found.",
    );

    vi.stubEnv("JITI_TSCONFIG_PATHS", "false");
    const { config } = await loadProjectConfig(await createProject(project));

    expect(config).toMatchObject({ space: "67890" });
  });

  it("should load a config file when the project has no tsconfig", async () => {
    const cwd = await createProject({
      "storyblok.config.ts": `export default { space: '56789' };\n`,
    });

    const { config } = await loadProjectConfig(cwd);

    expect(config).toMatchObject({ space: "56789" });
  });

  it("should load a config file that imports defineConfig from the CLI's own package", async () => {
    const cwd = await createProject({
      "storyblok.config.ts": `
import { defineConfig } from 'storyblok/config';

export default defineConfig({ space: '78901' });
`,
    });

    const { config } = await loadProjectConfig(cwd);

    expect(config).toMatchObject({ space: "78901" });
  });
});
