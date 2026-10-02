import type { TableColumn } from "../../../lib/ui";
import type { Story } from "../constants";
import type { RefIssue } from "./references";

/**
 * What a terminal shows of each result. The full story only goes out as JSONL:
 * on a terminal, a reader is scanning for which stories matched, and `id` and
 * `full_slug` are what they would copy into the next command.
 */
export const STORY_COLUMNS: TableColumn<Story>[] = [
  { header: "id", value: (story) => String(story.id ?? "") },
  { header: "name", value: (story) => story.name ?? "", flexible: true },
  {
    header: "full slug",
    // A trailing slash tells a folder apart without a column of its own.
    value: (story) => `${story.full_slug ?? ""}${story.is_folder ? "/" : ""}`,
  },
];

/** Counts issues per type, in the order each type first appears: `2 broken, 1 stale_url`. */
function summarizeIssues(issues: RefIssue[]): string {
  const counts = new Map<string, number>();
  for (const issue of issues) {
    counts.set(issue.type, (counts.get(issue.type) ?? 0) + 1);
  }
  return [...counts].map(([type, count]) => `${count} ${type}`).join(", ");
}

export const REF_ISSUE_COLUMNS: TableColumn<Story & { _ref_issues: RefIssue[] }>[] = [
  ...STORY_COLUMNS,
  { header: "issues", value: (story) => summarizeIssues(story._ref_issues) },
];
