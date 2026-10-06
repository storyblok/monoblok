import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";
import { bugCase, testCommand } from "../src/cases.ts";
import { addCheck } from "../src/grade.ts";
import type { Check } from "../src/grade.ts";
import { defaultMirror, shellRunner } from "./check-mutation.ts";
import type { CheckContext } from "./check-mutation.ts";

export function checkHiddenTests(ctx: CheckContext): Check {
  for (const file of [...ctx.case.testSetupFiles, ...ctx.case.testFiles]) {
    const content = execFileSync("git", ["show", `${ctx.case.fixRef}:${file}`], {
      cwd: ctx.mirror,
      encoding: "utf8",
    });
    fs.mkdirSync(path.dirname(path.join(ctx.workspace, file)), { recursive: true });
    fs.writeFileSync(path.join(ctx.workspace, file), content);
  }
  const command = (ctx.commandFor ?? ((f: string[]) => testCommand(ctx.case, f)))(
    ctx.case.testFiles,
  );
  const exit = ctx.run(command);
  return { name: "hidden-tests", pass: exit === 0, detail: `exit ${exit}` };
}

if (import.meta.main) {
  const { values } = parseArgs({ options: { case: { type: "string" } } });
  const workspace = process.cwd();
  addCheck(
    workspace,
    checkHiddenTests({
      workspace,
      mirror: defaultMirror(),
      case: bugCase(values.case ?? ""),
      run: shellRunner(workspace),
    }),
  );
}
