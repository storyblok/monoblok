import { execFileSync, spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import vm from "node:vm";

import { build } from "vite-plus/pack";
import { describe, expect, it } from "vitest";

import {
  CJS_DEPRECATION_CODE,
  CJS_DEPRECATION_SILENCE_ENV,
  cjsDeprecation,
  createCjsDeprecationSnippet,
} from "./cjs-deprecation-plugin.ts";

const PACKAGE = "@storyblok/example";

/** The environment of a developer or CI job must not change whether the warning is emitted. */
const cleanEnv = (extra: Record<string, string> = {}): NodeJS.ProcessEnv => {
  const env = { ...process.env, ...extra };
  delete env.NODE_OPTIONS;
  if (!(CJS_DEPRECATION_SILENCE_ENV in extra)) {
    delete env[CJS_DEPRECATION_SILENCE_ENV];
  }
  return env;
};

/** Runs a CJS chunk in a fresh Node process and returns the warnings it emitted. */
const run = (chunk: string, env: Record<string, string> = {}): string[] => {
  const script = `process.on("warning", (w) => console.log(JSON.stringify([w.name, w.code, w.message])));${chunk}`;
  const out = execFileSync(process.execPath, ["-e", script], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    env: cleanEnv(env),
  });
  return out.split("\n").filter(Boolean);
};

/** Runs the snippet in a context that has only the globals it is given. */
const runInContext = (globals: object): void => {
  vm.runInContext(createCjsDeprecationSnippet(PACKAGE), vm.createContext(globals));
};

describe("the snippet", () => {
  it("should emit a DeprecationWarning with a stable code naming the package", () => {
    const [warning] = run(createCjsDeprecationSnippet(PACKAGE));

    expect(JSON.parse(warning)).toEqual([
      "DeprecationWarning",
      CJS_DEPRECATION_CODE,
      expect.stringContaining(`"${PACKAGE}"`),
    ]);
  });

  it("should emit once per realm however many chunks load", () => {
    const chunk = createCjsDeprecationSnippet(PACKAGE);

    expect(run(chunk + chunk)).toHaveLength(1);
  });

  it("should emit once across different packages, naming the first", () => {
    const warnings = run(createCjsDeprecationSnippet("a") + createCjsDeprecationSnippet("b"));

    expect(warnings).toHaveLength(1);
    expect(JSON.parse(warnings[0])[2]).toContain('"a"');
  });

  it("should not emit when the silence environment variable is set", () => {
    expect(
      run(createCjsDeprecationSnippet(PACKAGE), { [CJS_DEPRECATION_SILENCE_ENV]: "1" }),
    ).toEqual([]);
  });

  it("should keep a package name that contains quotes intact", () => {
    const [warning] = run(createCjsDeprecationSnippet('we"ird'));

    expect(JSON.parse(warning)[2]).toContain('"we"ird"');
  });
});

describe("the snippet in other runtimes", () => {
  it("should not throw without a process", () => {
    expect(() => runInContext({})).not.toThrow();
  });

  it("should not throw without emitWarning", () => {
    expect(() => runInContext({ process: { env: {} } })).not.toThrow();
  });

  it("should still warn when process.env is missing", () => {
    const calls: unknown[] = [];

    runInContext({ process: { emitWarning: (...args: unknown[]) => calls.push(args) } });

    expect(calls).toHaveLength(1);
  });

  it("should not throw when reading process.env throws", () => {
    const process = {
      emitWarning: () => {},
      get env(): never {
        throw new Error("env access denied");
      },
    };

    expect(() => runInContext({ process })).not.toThrow();
  });

  it("should not throw when emitting the warning throws", () => {
    const process = {
      emitWarning: () => {
        throw new Error("nope");
      },
      env: {},
    };

    expect(() => runInContext({ process })).not.toThrow();
  });

  it("should not read the silence variable under Deno without the permission", () => {
    let reads = 0;
    const calls: unknown[] = [];
    const process = {
      emitWarning: (...args: unknown[]) => calls.push(args),
      get env(): Record<string, string> {
        reads += 1;
        return {};
      },
    };
    const Deno = { permissions: { querySync: () => ({ state: "prompt" }) } };

    runInContext({ process, Deno });

    expect(reads).toBe(0);
    expect(calls).toEqual([]);
  });

  it("should warn under Deno once the environment permission is granted", () => {
    const calls: unknown[] = [];
    const process = { emitWarning: (...args: unknown[]) => calls.push(args), env: {} };
    const Deno = { permissions: { querySync: () => ({ state: "granted" }) } };

    runInContext({ process, Deno });

    expect(calls).toHaveLength(1);
  });

  it("should stay silent under Deno when the environment permission is granted and the variable is set", () => {
    const calls: unknown[] = [];
    const process = {
      emitWarning: (...args: unknown[]) => calls.push(args),
      env: { [CJS_DEPRECATION_SILENCE_ENV]: "1" },
    };
    const Deno = { permissions: { querySync: () => ({ state: "granted" }) } };

    runInContext({ process, Deno });

    expect(calls).toEqual([]);
  });

  it("should not throw when the Deno permission query throws", () => {
    const process = { emitWarning: () => {}, env: {} };
    const Deno = {
      permissions: {
        querySync: () => {
          throw new Error("nope");
        },
      },
    };

    expect(() => runInContext({ process, Deno })).not.toThrow();
  });

  it("should emit once per realm, so a second context warns again", () => {
    const calls: unknown[] = [];
    const process = { emitWarning: (...args: unknown[]) => calls.push(args), env: {} };

    runInContext({ process });
    runInContext({ process });

    expect(calls).toHaveLength(2);
  });
});

/** Builds `files` (path to source) with the plugin and returns the output directory. */
const buildPackage = async (name: string, files: Record<string, string>): Promise<string> => {
  const cwd = mkdtempSync(join(tmpdir(), "cjs-deprecation-build-"));
  writeFileSync(join(cwd, "package.json"), JSON.stringify({ name, type: "module" }));
  mkdirSync(join(cwd, "src"));
  for (const [file, source] of Object.entries(files)) {
    writeFileSync(join(cwd, "src", file), source);
  }
  await build({
    config: false,
    cwd,
    entry: Object.keys(files)
      .filter((file) => file.startsWith("entry"))
      .map((f) => `src/${f}`),
    format: ["cjs", "esm"],
    dts: false,
    outDir: "dist",
    platform: "node",
    logLevel: "silent",
    plugins: [cjsDeprecation()],
  });
  return join(cwd, "dist");
};

const countWarnings = (dir: string, extension: string): number =>
  readdirSync(dir)
    .filter((file) => file.endsWith(extension))
    .reduce(
      (count, file) =>
        count + (readFileSync(join(dir, file), "utf8").split(CJS_DEPRECATION_CODE).length - 1),
      0,
    );

describe("cjsDeprecation", () => {
  it("should warn from the CJS build with the name of the package being built", async () => {
    const dist = await buildPackage("@storyblok/built", { "entry.ts": "export const x = 1;" });

    const [warning] = run(`require(${JSON.stringify(join(dist, "entry.cjs"))});`);

    expect(JSON.parse(warning)).toEqual([
      "DeprecationWarning",
      CJS_DEPRECATION_CODE,
      expect.stringContaining('"@storyblok/built"'),
    ]);
  });

  it("should leave the ESM build alone", async () => {
    const dist = await buildPackage("@storyblok/built", { "entry.ts": "export const x = 1;" });

    expect(countWarnings(dist, ".mjs")).toBe(0);
  });

  it("should add the warning to each entry and not to the chunks they share", async () => {
    const dist = await buildPackage("@storyblok/built", {
      "entry-a.ts": 'import { shared } from "./shared.ts"; export const a = shared;',
      "entry-b.ts": 'import { shared } from "./shared.ts"; export const b = shared;',
      "shared.ts": "export const shared = 1;",
    });

    expect(countWarnings(dist, ".cjs")).toBe(2);
  });

  it.each([
    ["a directive", '"use strict";\nconsole.log("ran");'],
    ["a directive without a semicolon", '"use strict"\nconsole.log("ran");'],
    ["a hashbang and a directive", '#!/usr/bin/env node\n"use strict"\nconsole.log("ran");'],
    ["a hashbang", '#!/usr/bin/env node\nconsole.log("ran");'],
  ])("should still run a CJS entry that starts with %s", async (_, source) => {
    const dist = await buildPackage("@storyblok/built", { "entry.ts": source });
    const file = join(dist, "entry.cjs");

    const result = spawnSync(process.execPath, [file], { encoding: "utf8", env: cleanEnv() });

    expect(result.stdout.trim()).toBe("ran");
    expect(result.stderr).toContain(CJS_DEPRECATION_CODE);
  });
});
