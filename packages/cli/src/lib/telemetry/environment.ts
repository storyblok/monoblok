import { existsSync } from "node:fs";
import { arch, platform } from "node:process";
import { detectAgent, detectProvider } from "std-env";

const KNOWN_PACKAGE_MANAGERS = new Set(["npm", "pnpm", "yarn", "bun", "deno"]);

/** `AI_AGENT` is free-form, so only a first word that looks like a name is sent. */
const AGENT_NAME_PATTERN = /^[a-z][a-z0-9]{0,19}$/;

/** Docker and Podman create these in every container. */
const CONTAINER_MARKER_FILES = ["/.dockerenv", "/run/.containerenv"];

/** Values from the OpenTelemetry `host.arch` semantic convention. */
const HOST_ARCH: Partial<Record<NodeJS.Architecture, string>> = {
  x64: "amd64",
  arm64: "arm64",
  ia32: "x86",
  arm: "arm32",
  ppc64: "ppc64",
  s390x: "s390x",
};

/** Values from the OpenTelemetry `os.type` semantic convention. */
const OS_TYPE: Partial<Record<NodeJS.Platform, string>> = {
  win32: "windows",
  darwin: "darwin",
  linux: "linux",
  freebsd: "freebsd",
  openbsd: "openbsd",
  sunos: "solaris",
  aix: "aix",
};

export function isTruthyEnv(value: string | undefined): boolean {
  return value !== undefined && value !== "" && value !== "0" && value.toLowerCase() !== "false";
}

/** Azure Pipelines sets `TF_BUILD` but not `CI`. */
export function isCi(): boolean {
  if (isTruthyEnv(process.env.CI) || isTruthyEnv(process.env.TF_BUILD)) {
    return true;
  }
  const provider = detectProvider();
  return provider.name !== "" && provider.ci !== false;
}

/**
 * Reduced to the first word, so `claude-code_2-1-322_agent` from `AI_AGENT` and `claude` from
 * `CLAUDECODE` count as one agent.
 */
export function getAgent(): string | undefined {
  const name = detectAgent().name?.toLowerCase();
  if (!name) {
    return undefined;
  }
  const [firstWord = ""] = name.split(/[^a-z0-9]/);
  return AGENT_NAME_PATTERN.test(firstWord) ? firstWord : "other";
}

export function isInteractive(): boolean {
  return process.stdin.isTTY === true && process.stderr.isTTY === true;
}

export function isContainer(): boolean {
  return CONTAINER_MARKER_FILES.some((file) => existsSync(file));
}

/** Package managers set `npm_config_user_agent` to e.g. `pnpm/9.1.0 npm/? node/v22.0.0`. */
export function getPackageManager(): string {
  const name = process.env.npm_config_user_agent?.split("/")[0];
  return name && KNOWN_PACKAGE_MANAGERS.has(name) ? name : "unknown";
}

export function getOsType(): string {
  return OS_TYPE[platform] ?? "other";
}

export function getHostArch(): string {
  return HOST_ARCH[arch] ?? "other";
}
