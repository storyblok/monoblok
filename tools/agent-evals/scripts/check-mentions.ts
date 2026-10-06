import fs from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";
import { bugCase } from "../src/cases.ts";
import type { BugCase } from "../src/cases.ts";
import { addCheck } from "../src/grade.ts";
import type { Check } from "../src/grade.ts";

export function checkMentions(ctx: { workspace: string; case: BugCase; file: string }): Check {
  const report = path.join(ctx.workspace, ctx.file);
  if (!fs.existsSync(report)) {
    return { name: "names-fix-location", pass: false, detail: `${ctx.file} missing` };
  }
  const text = fs.readFileSync(report, "utf8");
  const names = ctx.case.sourceFiles.map((f) => path.basename(f).replace(/\.[^.]+$/, ""));
  const hit = names.find((n) => text.includes(n));
  return {
    name: "names-fix-location",
    pass: hit !== undefined,
    detail: hit ?? `none of ${names.join(", ")}`,
  };
}

if (import.meta.main) {
  const { values } = parseArgs({ options: { case: { type: "string" }, file: { type: "string" } } });
  const workspace = process.cwd();
  addCheck(
    workspace,
    checkMentions({ workspace, case: bugCase(values.case ?? ""), file: values.file ?? "" }),
  );
}
