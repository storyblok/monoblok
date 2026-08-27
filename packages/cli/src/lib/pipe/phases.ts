import type { ProgressBar, UI } from "../ui";

/** Everything a phase counts. `total` is what its bar is measured against. */
export interface PhaseCounts {
  total: number;
  [counter: string]: number;
}

export interface PhaseDefinition {
  key: string;
  /** Bar title. Padding is applied for you, so every bar's `[` lines up. */
  label: string;
  /**
   * Left out of the run: no bar, no timing mark, and its intake passes straight
   * through to the phase below it. `--skip-content` is what it exists for — the
   * phases a run has follow the work it is actually doing.
   */
  enabled?: boolean;
  /** Counters this phase keeps besides `total`, each starting at 0. */
  counters?: readonly string[];
  /**
   * How many of this phase's intake can still reach the phase below it.
   *
   * This is the whole of the totals bookkeeping: each subtrahend is a record that
   * can never arrive downstream — dropped, pruned, or lost to a failure — so the
   * bars below land on 100% instead of stalling short. Defaults to the full
   * intake, for a phase that loses nothing.
   */
  outflow?: (counts: PhaseCounts) => number;
}

export interface Phase {
  readonly key: string;
  readonly enabled: boolean;
  readonly counts: PhaseCounts;
  /** Advances the bar and stamps this phase's "last made progress" mark. */
  tick: (count?: number) => void;
  /** Adds to a named counter, and re-derives every total below this phase. */
  count: (counter: string, amount?: number) => void;
  /** Sets the head phase's total; every phase below follows from `outflow`. */
  setTotal: (total: number) => void;
  /** This phase's mark, as an elapsed-since-start reading. */
  mark: () => string;
}

export interface PhaseTracker {
  phase: (key: string) => Phase;
  /** Convenience for `phase(key).counts`. */
  counts: (key: string) => PhaseCounts;
  /** Re-derives every phase's total from the phase above it. */
  syncTotals: () => void;
  stop: () => void;
  /** Milliseconds since the run started. */
  elapsedMs: () => number;
  /** Each enabled phase's mark, keyed by phase, for the run report. */
  timings: () => Record<string, number>;
}

/**
 * Renders a phase mark as an elapsed-since-start reading.
 *
 * Written as `done @12.3s` rather than a bare duration because the phases
 * overlap on purpose — content fetches begin while later pages are still
 * listing. A bare duration would read as three figures that add up to the total,
 * and listing would look "slow" whenever backpressure held the pager back
 * waiting on the stage below, which is the pipeline working, not stalling.
 */
export const formatMark = (ms: number): string => `done @${(ms / 1000).toFixed(1)}s`;

/**
 * Projects a phase's counts into the shape the run report uses.
 *
 * Only for a phase whose counters are named for it. One that counts something
 * else — the CAPI filter's `pruned` and `unresolved` — has to say for itself
 * which of its counters mean what, because only the command knows whether a
 * pruned record is a success or a loss.
 */
export const toPhaseSummary = (
  counts: PhaseCounts,
): { total: number; succeeded: number; skipped?: number; failed: number } => ({
  total: counts.total,
  succeeded: counts.succeeded ?? 0,
  skipped: counts.skipped,
  failed: counts.failed ?? 0,
});

interface PhaseEntry {
  definition: PhaseDefinition;
  counts: PhaseCounts;
  bar: ProgressBar | undefined;
  mark: number;
}

/**
 * Owns the progress bars, counters and timing marks of one staged run.
 *
 * A command declares its phases and what each one loses, and gets the bars, the
 * `done @Xs` marks, the report timings and — the part that is easy to get subtly
 * wrong by hand — totals that stay consistent as records are dropped along the
 * way. Every total below the head is re-derived from the counts rather than
 * adjusted in place, because a page total arrives again with every page:
 * assigning would reset the totals to the full count and un-subtract everything
 * already dropped.
 */
export function createPhaseTracker({
  ui,
  phases,
}: {
  ui: UI;
  phases: PhaseDefinition[];
}): PhaseTracker {
  const startedAt = Date.now();
  const active = phases.filter((definition) => definition.enabled !== false);
  const width = Math.max(0, ...active.map((definition) => definition.label.length));

  const entries = new Map<string, PhaseEntry>();
  const order: PhaseEntry[] = [];

  for (const definition of phases) {
    const counts: PhaseCounts = { total: 0 };
    for (const counter of definition.counters ?? []) {
      counts[counter] = 0;
    }
    const enabled = definition.enabled !== false;
    const entry: PhaseEntry = {
      definition,
      counts,
      bar: enabled ? ui.createProgressBar({ title: definition.label.padEnd(width) }) : undefined,
      mark: 0,
    };
    entries.set(definition.key, entry);
    if (enabled) {
      order.push(entry);
    }
  }

  const outflowOf = (entry: PhaseEntry): number =>
    entry.definition.outflow ? entry.definition.outflow(entry.counts) : entry.counts.total;

  const syncTotals = (): void => {
    let intake: number | undefined;
    for (const entry of order) {
      // The head phase's total is the one nobody can derive: it comes from the
      // source itself, via `setTotal`.
      if (intake !== undefined) {
        const next = Math.max(intake, 0);
        // Guarded because this runs on every counter change: re-rendering a bar
        // whose total has not moved is the one cost of syncing eagerly, and
        // syncing eagerly is what removes "did I remember to sync?" from every
        // caller.
        if (next !== entry.counts.total) {
          entry.counts.total = next;
          entry.bar?.setTotal(next);
        }
      }
      intake = outflowOf(entry);
    }
  };

  const get = (key: string): PhaseEntry => {
    const entry = entries.get(key);
    if (!entry) {
      throw new Error(`Unknown phase "${key}".`);
    }
    return entry;
  };

  const phase = (key: string): Phase => {
    const entry = get(key);
    return {
      key,
      enabled: entry.bar !== undefined,
      counts: entry.counts,
      tick: (count = 1) => {
        entry.mark = Date.now() - startedAt;
        entry.bar?.increment(count);
      },
      count: (counter, amount = 1) => {
        if (!(counter in entry.counts)) {
          throw new Error(`Phase "${key}" does not declare a counter named "${counter}".`);
        }
        entry.counts[counter] += amount;
        syncTotals();
      },
      setTotal: (total) => {
        entry.counts.total = total;
        entry.bar?.setTotal(total);
        syncTotals();
      },
      mark: () => formatMark(entry.mark),
    };
  };

  return {
    phase,
    counts: (key) => get(key).counts,
    syncTotals,
    stop: () => ui.stopAllProgressBars(),
    elapsedMs: () => Date.now() - startedAt,
    timings: () =>
      Object.fromEntries(order.map((entry) => [entry.definition.key, entry.mark])) as Record<
        string,
        number
      >,
  };
}
