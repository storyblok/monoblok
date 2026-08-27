import { describe, expect, it, vi } from "vitest";
import type { ProgressBar, UI } from "../ui";
import { createPhaseTracker, formatMark, toPhaseSummary } from "./phases";

/** Records what each bar was told, so the tracker's arithmetic is observable. */
function fakeUI() {
  const bars = new Map<string, { totals: number[]; increments: number[] }>();
  const ui = {
    createProgressBar: ({ title }: { title: string }): ProgressBar => {
      const bar = { totals: [] as number[], increments: [] as number[] };
      bars.set(title.trimEnd(), bar);
      return {
        increment: (count = 1) => bar.increments.push(count),
        setTotal: (total: number) => bar.totals.push(total),
        stop: () => {},
      };
    },
    stopAllProgressBars: vi.fn(),
  } as unknown as UI;
  return { ui, bars };
}

/** The shape `stories find` declares: each phase loses something to the next. */
const phasesOf = ({ capi, skipContent }: { capi: boolean; skipContent: boolean }) => [
  {
    key: "list",
    label: "Fetching stories",
    counters: ["succeeded", "skipped"],
    outflow: (counts: { total: number; skipped: number }) => counts.total - counts.skipped,
  },
  {
    key: "capiFilter",
    label: "Filtering via CAPI",
    enabled: capi,
    counters: ["pruned"],
    outflow: (counts: { total: number; pruned: number }) => counts.total - counts.pruned,
  },
  {
    key: "content",
    label: "Fetching stories content",
    enabled: !skipContent,
    counters: ["failed"],
    outflow: (counts: { total: number; failed: number }) => counts.total - counts.failed,
  },
  { key: "process", label: "Applying client-side filters", counters: ["succeeded"] },
];

describe("createPhaseTracker", () => {
  it("should derive every downstream total from what the phase above it loses", () => {
    const { ui } = fakeUI();
    const tracker = createPhaseTracker({
      ui,
      phases: phasesOf({ capi: true, skipContent: false }),
    });

    tracker.phase("list").setTotal(100);
    tracker.phase("list").count("skipped", 10);
    tracker.phase("capiFilter").count("pruned", 40);
    tracker.phase("content").count("failed", 5);

    expect(tracker.counts("capiFilter").total).toBe(90);
    expect(tracker.counts("content").total).toBe(50);
    expect(tracker.counts("process").total).toBe(45);
  });

  // The page total arrives again with every page, so assigning downstream totals
  // instead of re-deriving them would un-subtract everything already dropped.
  it("should keep the totals right when the head total is set repeatedly", () => {
    const { ui } = fakeUI();
    const tracker = createPhaseTracker({
      ui,
      phases: phasesOf({ capi: false, skipContent: false }),
    });

    tracker.phase("list").setTotal(100);
    tracker.phase("list").count("skipped", 30);
    tracker.phase("list").setTotal(100);

    expect(tracker.counts("content").total).toBe(70);
  });

  it("should pass a disabled phase's intake straight through", () => {
    const { ui, bars } = fakeUI();
    const tracker = createPhaseTracker({ ui, phases: phasesOf({ capi: true, skipContent: true }) });

    tracker.phase("list").setTotal(100);
    tracker.phase("capiFilter").count("pruned", 60);

    expect(bars.has("Fetching stories content")).toBe(false);
    expect(tracker.phase("content").enabled).toBe(false);
    // Straight from the CAPI filter to the last phase, with no content fetch in
    // between to subtract anything.
    expect(tracker.counts("process").total).toBe(40);
  });

  it("should never report a negative total", () => {
    const { ui } = fakeUI();
    const tracker = createPhaseTracker({
      ui,
      phases: phasesOf({ capi: false, skipContent: true }),
    });

    tracker.phase("list").setTotal(5);
    tracker.phase("list").count("skipped", 9);

    expect(tracker.counts("process").total).toBe(0);
  });

  it("should pad every bar title to the widest enabled label", () => {
    const { ui, bars } = fakeUI();
    createPhaseTracker({ ui, phases: phasesOf({ capi: true, skipContent: false }) });

    // Trimmed keys, so the assertion is about the padding itself.
    expect([...bars.keys()]).toEqual([
      "Fetching stories",
      "Filtering via CAPI",
      "Fetching stories content",
      "Applying client-side filters",
    ]);
  });

  it("should reject a counter the phase does not declare", () => {
    const { ui } = fakeUI();
    const tracker = createPhaseTracker({
      ui,
      phases: phasesOf({ capi: false, skipContent: true }),
    });

    expect(() => tracker.phase("list").count("suceeded")).toThrow(/does not declare a counter/);
  });

  it("should reject an unknown phase", () => {
    const { ui } = fakeUI();
    const tracker = createPhaseTracker({
      ui,
      phases: phasesOf({ capi: false, skipContent: true }),
    });

    expect(() => tracker.phase("nope")).toThrow(/Unknown phase/);
  });

  it("should advance the bar of the phase that ticked", () => {
    const { ui, bars } = fakeUI();
    const tracker = createPhaseTracker({
      ui,
      phases: phasesOf({ capi: false, skipContent: true }),
    });

    tracker.phase("list").tick();
    tracker.phase("list").tick(25);

    expect(bars.get("Fetching stories")?.increments).toEqual([1, 25]);
  });

  it("should report a mark only for the phases that ran", () => {
    const { ui } = fakeUI();
    const tracker = createPhaseTracker({
      ui,
      phases: phasesOf({ capi: false, skipContent: true }),
    });

    tracker.phase("list").tick();

    expect(Object.keys(tracker.timings())).toEqual(["list", "process"]);
    expect(tracker.phase("list").mark()).toMatch(/^done @\d+\.\ds$/);
  });
});

describe("formatMark", () => {
  it("should read as an elapsed-since-start mark, not a duration", () => {
    expect(formatMark(12_340)).toBe("done @12.3s");
  });
});

describe("toPhaseSummary", () => {
  it("should project the counters the report expects", () => {
    expect(toPhaseSummary({ total: 10, succeeded: 7, skipped: 2, failed: 1 })).toEqual({
      total: 10,
      succeeded: 7,
      skipped: 2,
      failed: 1,
    });
  });

  it("should default the counters a phase does not keep", () => {
    expect(toPhaseSummary({ total: 3 })).toEqual({
      total: 3,
      succeeded: 0,
      skipped: undefined,
      failed: 0,
    });
  });
});
