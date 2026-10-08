import type { TableColumn } from "../../../lib/ui";
import type { Story } from "../constants";
import { ISSUE_TYPES } from "./references";
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

/**
 * Counts issues per type, always in the same order so rows can be scanned down
 * the column: `2 broken, 1 stale_url`.
 */
export function summarizeIssues(issues: RefIssue[]): string {
  return ISSUE_TYPES.flatMap((type) => {
    const count = issues.filter((issue) => issue.type === type).length;
    return count > 0 ? [`${count} ${type}`] : [];
  }).join(", ");
}

export const REF_ISSUE_COLUMNS: TableColumn<Story & { _ref_issues: RefIssue[] }>[] = [
  ...STORY_COLUMNS,
  { header: "issues", value: (story) => summarizeIssues(story._ref_issues) },
];
