import { execFileSync } from "node:child_process";

/** A workspace project as `pnpm ls -r --json` reports it. */
export type WorkspacePackage = {
  name: string;
  version: string;
  private?: boolean;
};

const DEPENDENCY_SECTIONS = [
  "dependencies",
  "devDependencies",
  "peerDependencies",
  "optionalDependencies",
] as const;

/** Every project in the monorepo's pnpm workspace. Reads manifests only, no install needed. */
export function listWorkspacePackages(cwd: string): WorkspacePackage[] {
  const output = execFileSync("pnpm", ["ls", "--recursive", "--depth", "-1", "--json"], {
    cwd,
    encoding: "utf8",
  });
  const packages: WorkspacePackage[] = JSON.parse(output);
  return packages;
}

/**
 * Rewrites `workspace:^` to a caret range of the workspace version, as `pnpm pack` does, so a
 * blueprint installs from npm. Only `workspace:^` is accepted (ADR-0014): users install every
 * section of a template, so an exact pin would freeze them in any of them.
 */
export function resolveWorkspaceDependencies(
  manifestText: string,
  workspace: WorkspacePackage[],
): string {
  const manifest = JSON.parse(manifestText);
  const versions = new Map(workspace.map((pkg) => [pkg.name, pkg]));
  const problems: string[] = [];

  for (const section of DEPENDENCY_SECTIONS) {
    const dependencies: Record<string, string> = manifest[section] ?? {};
    for (const [name, specifier] of Object.entries(dependencies)) {
      if (!specifier.startsWith("workspace:")) {
        continue;
      }
      const pkg = versions.get(name);
      if (specifier !== "workspace:^") {
        problems.push(`${section}.${name} is "${specifier}", use "workspace:^"`);
      } else if (!pkg) {
        problems.push(`${section}.${name} is not a package in this workspace`);
      } else if (pkg.private) {
        problems.push(`${section}.${name} is private, so it cannot be installed from npm`);
      } else {
        dependencies[name] = `^${pkg.version}`;
      }
    }
  }

  if (problems.length > 0) {
    throw new Error(`Cannot resolve workspace dependencies:\n- ${problems.join("\n- ")}`);
  }

  // Keep the blueprint's own indentation, so the target's package.json diff stays readable.
  const indent = manifestText.match(/^[ \t]+(?=")/m)?.[0] ?? "  ";
  return `${JSON.stringify(manifest, null, indent)}\n`;
}
