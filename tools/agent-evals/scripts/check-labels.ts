import fs from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";
import { bugCase } from "../src/cases.ts";
import type { BugCase } from "../src/cases.ts";
import { addCheck } from "../src/grade.ts";
import type { Check } from "../src/grade.ts";

const JUDGED_PREFIXES = ["pkg:", "type:"];

function parseLabels(file: string): string[] | null {
  try {
    const parsed: unknown = JSON.parse(fs.readFileSync(file, "utf8"));
    if (typeof parsed !== "object" || parsed === null || !("labels" in parsed)) return null;
    const labels = parsed.labels;
    return Array.isArray(labels) ? labels.filter((l): l is string => typeof l === "string") : null;
  } catch {
    return null;
  }
}

export function checkLabels(ctx: { workspace: string; case: BugCase; file: string }): Check {
  const given = parseLabels(path.join(ctx.workspace, ctx.file));
  if (!given)
    return { name: "labels-match", pass: false, detail: `${ctx.file} missing or invalid` };
  const expected = ctx.case.issueLabels.filter((l) => JUDGED_PREFIXES.some((p) => l.startsWith(p)));
  const missing = expected.filter((l) => !given.includes(l));
  return {
    name: "labels-match",
    pass: missing.length === 0,
    detail: missing.length ? `missing ${missing.join(", ")}` : given.join(", "),
  };
}

if (import.meta.main) {
  const { values } = parseArgs({ options: { case: { type: "string" }, file: { type: "string" } } });
  const workspace = process.cwd();
  addCheck(
    workspace,
    checkLabels({ workspace, case: bugCase(values.case ?? ""), file: values.file ?? "" }),
  );
}
