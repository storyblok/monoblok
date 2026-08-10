const MAX_REASONS = 10;
const MAX_EXAMPLES = 3;
const OVERFLOW_SUFFIX = "more failure reason(s)";

/**
 * Accumulates per-item failures keyed by their human-readable reason string
 * and produces a compact grouped summary for terminal output.
 *
 * Mirrors the grouping convention in `assets/transfer/index.ts` so all
 * asset-push/transfer/pipeline failure displays are consistent: one line per
 * unique cause instead of one line per failed item.
 *
 * Usage:
 * ```ts
 * const failures = new FailureReasonGroup();
 * // …during processing:
 * failures.record(toError(error).message, asset.short_filename);
 * // …after processing, before/after stopping progress bars:
 * for (const line of failures.toListLines()) {
 *   ui.warn(line);        // or ui.list(failures.toListLines())
 * }
 * ```
 */
export class FailureReasonGroup {
  private readonly groups = new Map<string, { count: number; examples: string[] }>();

  /** Record one failure. `example` is an optional item label (filename, id…). */
  record(reason: string, example?: string): void {
    const entry = this.groups.get(reason) ?? { count: 0, examples: [] };
    entry.count += 1;
    if (example !== undefined && entry.examples.length < MAX_EXAMPLES) {
      entry.examples.push(example);
    }
    this.groups.set(reason, entry);
  }

  get isEmpty(): boolean {
    return this.groups.size === 0;
  }

  get size(): number {
    return this.groups.size;
  }

  /**
   * Returns all groups sorted by count descending.
   * Each entry includes the reason string, total count, and up to `MAX_EXAMPLES` example labels.
   */
  entries(): Array<{ reason: string; count: number; examples: string[] }> {
    return [...this.groups.entries()]
      .sort((a, b) => b[1].count - a[1].count)
      .map(([reason, { count, examples }]) => ({ reason, count, examples }));
  }

  /**
   * Produces ready-to-display lines for use with `ui.list()` or `ui.warn()`.
   *
   * Format (one line per unique reason, capped at MAX_REASONS):
   * - Single failure with label:  `Failed to push "filename": reason`
   * - Single failure no label:    `Failed to push 1 asset — reason`
   * - Multiple:                   `Failed to push N assets — reason (e.g. "a", "b")`
   * - Overflow:                   `… and N more failure reason(s)`
   *
   * Pass `verb` to customise the opening word ("push", "read", "transfer", …).
   */
  toListLines(verb = "push"): string[] {
    const all = this.entries();
    const visible = all.slice(0, MAX_REASONS);

    const lines = visible.map(({ reason, count, examples }) => {
      if (count === 1 && examples.length > 0) {
        return `Failed to ${verb} "${examples[0]}": ${reason}`;
      }
      const noun = count === 1 ? "asset" : "assets";
      const exampleStr =
        examples.length > 0 ? ` (e.g. ${examples.map((e) => `"${e}"`).join(", ")})` : "";
      return `Failed to ${verb} ${count} ${noun} — ${reason}${exampleStr}`;
    });

    if (all.length > MAX_REASONS) {
      lines.push(`… and ${all.length - MAX_REASONS} ${OVERFLOW_SUFFIX}`);
    }

    return lines;
  }
}
