import { readFile, stat } from "node:fs/promises";
import { extname, resolve } from "pathe";
import { CommandError } from "./error/command-error";
import { isRecord } from "./object";

/**
 * A missing file is a bad invocation, so it surfaces as a {@link CommandError}
 * instead of Node's resolution failure with its `Require stack:` dump. The file
 * is checked before the import rather than by inspecting the failure: a module
 * the file itself imports and cannot resolve raises `Cannot find module
 * '<specifier>'` with a `Require stack:` naming the file, so matching the path
 * against the message reported a missing dependency as a missing file.
 */
async function resolveExistingFile(path: string, fileDescription: string): Promise<string> {
  const absolutePath = resolve(path);
  try {
    await stat(absolutePath);
  } catch {
    throw new CommandError(`${fileDescription} not found at "${path}".`);
  }
  return absolutePath;
}

/**
 * The path is resolved to an absolute path first, so jiti's base URL does not
 * affect which file is loaded; `tsconfigPaths` does read a tsconfig relative to
 * that base URL, but jiti evaluates each module through a child instance rooted
 * at the module itself, so the aliases applied to the file come from the user's
 * project and not from the CLI's own tsconfig.
 */
async function createUserModuleJiti(options: { interopDefault: boolean }) {
  const { createJiti } = await import("jiti");
  return createJiti(import.meta.url, {
    interopDefault: options.interopDefault,
    // Reading the tsconfig throws when it extends something unresolvable, which
    // would block every command that loads a user file in a project that does
    // not even use aliases. jiti's own JITI_TSCONFIG_PATHS default is overridden
    // by this explicit option, so honour it here to leave users a way out.
    tsconfigPaths: process.env.JITI_TSCONFIG_PATHS !== "false",
  });
}

/**
 * Loads a user-provided `.ts`, `.js`, `.mjs`, `.cjs`, or `.json` file and
 * returns all of its exports.
 */
export async function importUserModule(
  path: string,
  fileDescription: string,
): Promise<Record<string, unknown>> {
  const absolutePath = await resolveExistingFile(path, fileDescription);
  const jiti = await createUserModuleJiti({ interopDefault: true });
  return await jiti.import<Record<string, unknown>>(absolutePath);
}

/**
 * Loads a user-provided `.ts`, `.js`, `.mjs`, `.cjs`, or `.json` file and
 * returns its default export (`module.exports` for CommonJS, the parsed content
 * for JSON), or `undefined` when it has none. Named exports are never used in
 * its place, so a file without a default export can be reported as such.
 */
export async function importUserModuleDefault(
  path: string,
  fileDescription: string,
): Promise<unknown> {
  const absolutePath = await resolveExistingFile(path, fileDescription);
  // jiti's interop throws on a JSON document whose top-level value is a
  // primitive, so JSON is parsed here instead.
  if (extname(absolutePath) === ".json") {
    return parseJsonFile(absolutePath, path, fileDescription);
  }
  const jiti = await createUserModuleJiti({ interopDefault: false });
  const userModule = await jiti.import<unknown>(absolutePath);
  // CommonJS that Node loads natively (`.js`, `.cjs`) comes back as a namespace
  // whose default is `module.exports`, while CommonJS that jiti transpiles
  // (`.ts`, `.cts`) comes back as `module.exports` itself.
  return await (isEsModuleNamespace(userModule) ? userModule.default : userModule);
}

async function parseJsonFile(
  absolutePath: string,
  path: string,
  fileDescription: string,
): Promise<unknown> {
  try {
    return JSON.parse(await readFile(absolutePath, "utf8"));
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new CommandError(`${fileDescription} at "${path}" is not valid JSON: ${reason}`);
  }
}

function isEsModuleNamespace(value: unknown): value is { default?: unknown } {
  return (
    Object.prototype.toString.call(value) === "[object Module]" ||
    (isRecord(value) && value.__esModule === true)
  );
}
