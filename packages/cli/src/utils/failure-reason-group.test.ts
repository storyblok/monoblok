import { describe, expect, it } from "vitest";
import { FailureReasonGroup } from "./failure-reason-group";

describe("failureReasonGroup", () => {
  it("should be empty initially", () => {
    expect(new FailureReasonGroup().isEmpty).toBe(true);
  });

  it("should track a single failure with an example label", () => {
    const g = new FailureReasonGroup();
    g.record("Forbidden", "hero.png");
    expect(g.isEmpty).toBe(false);
    expect(g.size).toBe(1);
    expect(g.entries()).toEqual([{ reason: "Forbidden", count: 1, examples: ["hero.png"] }]);
  });

  it("should count multiple failures with the same reason", () => {
    const g = new FailureReasonGroup();
    g.record("Forbidden", "a.png");
    g.record("Forbidden", "b.png");
    g.record("Forbidden", "c.png");
    const [entry] = g.entries();
    expect(entry.count).toBe(3);
    expect(entry.examples).toEqual(["a.png", "b.png", "c.png"]);
  });

  it("should cap stored examples at 3", () => {
    const g = new FailureReasonGroup();
    for (let i = 0; i < 10; i++) {
      g.record("Forbidden", `file-${i}.png`);
    }
    const [entry] = g.entries();
    expect(entry.count).toBe(10);
    expect(entry.examples).toHaveLength(3);
  });

  it("should sort entries by count descending", () => {
    const g = new FailureReasonGroup();
    g.record("Rare error");
    g.record("Common error");
    g.record("Common error");
    g.record("Common error");
    const [first, second] = g.entries();
    expect(first.reason).toBe("Common error");
    expect(first.count).toBe(3);
    expect(second.reason).toBe("Rare error");
    expect(second.count).toBe(1);
  });

  describe("toListLines", () => {
    it('should format a single failure with an example as "Failed to push \\"file\\": reason"', () => {
      const g = new FailureReasonGroup();
      g.record("Not found", "logo.png");
      expect(g.toListLines()).toEqual(['Failed to push "logo.png": Not found']);
    });

    it('should format a single failure without an example using singular "asset"', () => {
      const g = new FailureReasonGroup();
      g.record("Forbidden");
      expect(g.toListLines("transfer")).toEqual(["Failed to transfer 1 asset — Forbidden"]);
    });

    it("should format multiple failures with count and examples", () => {
      const g = new FailureReasonGroup();
      g.record("Forbidden", "a.png");
      g.record("Forbidden", "b.png");
      g.record("Forbidden", "c.png");
      const [line] = g.toListLines();
      expect(line).toContain("3 assets");
      expect(line).toContain('"a.png"');
    });

    it("should use the provided verb", () => {
      const g = new FailureReasonGroup();
      g.record("Timeout", "img.png");
      g.record("Timeout", "img2.png");
      expect(g.toListLines("transfer")[0]).toMatch(/^Failed to transfer/);
    });

    it("should truncate at 10 reasons and append overflow line", () => {
      const g = new FailureReasonGroup();
      for (let i = 0; i < 12; i++) {
        g.record(`Error ${i}`, `file-${i}.png`);
      }
      const lines = g.toListLines();
      expect(lines).toHaveLength(11); // 10 reasons + 1 overflow
      expect(lines[10]).toContain("2 more failure reason(s)");
    });

    it("should return an empty array when there are no failures", () => {
      expect(new FailureReasonGroup().toListLines()).toEqual([]);
    });
  });
});
