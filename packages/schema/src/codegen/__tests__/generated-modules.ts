import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

/**
 * Writes generated modules inside the package, so `@storyblok/schema` resolves
 * to this package the way it resolves to the installed one in a project.
 */
export async function writeModules(files: Record<string, string>): Promise<{
  directory: string;
  typeErrors: () => string[];
  cleanup: () => Promise<void>;
}> {
  const parent = path.join(packageRoot, "node_modules", ".tmp");
  await mkdir(parent, { recursive: true });
  const directory = await mkdtemp(path.join(parent, "codegen-"));
  await Promise.all(
    Object.entries(files).map(([name, source]) => writeFile(path.join(directory, name), source)),
  );

  const typeErrors = (): string[] => {
    const program = ts.createProgram(
      Object.keys(files).map((name) => path.join(directory, name)),
      {
        module: ts.ModuleKind.ESNext,
        moduleResolution: ts.ModuleResolutionKind.Bundler,
        target: ts.ScriptTarget.ESNext,
        strict: true,
        noEmit: true,
        noUnusedLocals: true,
        skipLibCheck: true,
      },
    );
    return ts
      .getPreEmitDiagnostics(program)
      .map((d) => ts.flattenDiagnosticMessageText(d.messageText, "\n"));
  };

  return { directory, typeErrors, cleanup: () => rm(directory, { recursive: true, force: true }) };
}
