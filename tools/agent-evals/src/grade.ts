import fs from "node:fs";
import path from "node:path";

export const GRADE_PATH = ".agent-evals/grade.json";
export type Check = { name: string; pass: boolean; detail: string };
export type Grade = { checks: Check[] };

function isGrade(value: unknown): value is Grade {
  return (
    typeof value === "object" && value !== null && "checks" in value && Array.isArray(value.checks)
  );
}

export function readGrade(file: string): Grade | null {
  try {
    const parsed: unknown = JSON.parse(fs.readFileSync(file, "utf8"));
    return isGrade(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function addCheck(workspace: string, check: Check): void {
  const file = path.join(workspace, GRADE_PATH);
  const grade = readGrade(file) ?? { checks: [] };
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify({ checks: [...grade.checks, check] }, null, 2));
}

export function gradePasses(grade: Grade | null): boolean {
  return grade !== null && grade.checks.length > 0 && grade.checks.every((c) => c.pass);
}
