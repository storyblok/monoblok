import path from "node:path";

export const ARM_NAMES = ["bare", "monoblok", "superpowers", "monoblok-superpowers"] as const;
export type ArmName = (typeof ARM_NAMES)[number];

export const EVAL_MODEL = "claude-opus-5-5";
export const SIMULATOR_MODEL = "claude-sonnet-5-5";

export const EVALS_DIR = path.resolve(import.meta.dirname, "..");
export const REPO_ROOT = path.resolve(EVALS_DIR, "../..");

export const SUPERPOWERS_REPO = "https://github.com/obra/superpowers";
export const SUPERPOWERS_REF = "v6.4.1";
export const SUPERPOWERS_DIR = path.join(EVALS_DIR, ".cache", `superpowers-${SUPERPOWERS_REF}`);

const ARM_CONTENTS: Record<ArmName, { monoblok: boolean; superpowers: boolean }> = {
  bare: { monoblok: false, superpowers: false },
  monoblok: { monoblok: true, superpowers: false },
  superpowers: { monoblok: false, superpowers: true },
  "monoblok-superpowers": { monoblok: true, superpowers: true },
};

export function isArmName(value: string): value is ArmName {
  return (ARM_NAMES as readonly string[]).includes(value);
}

export function armHasMonoblok(name: ArmName): boolean {
  return ARM_CONTENTS[name].monoblok;
}

export function armDir(name: ArmName, root: string = EVALS_DIR): string {
  return path.join(root, "arms", name);
}

export function armPlugins(name: ArmName): string[] {
  return ARM_CONTENTS[name].superpowers ? [SUPERPOWERS_DIR] : [];
}
