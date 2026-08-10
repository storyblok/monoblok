import { describe, expect, it } from "vitest";
import { defineGoal } from "./define-goal";

describe("defineGoal", () => {
  it("returns the goal unchanged", () => {
    const goal = { name: "signup", value: 100, props: { plan: "pro" } };

    expect(defineGoal(goal)).toEqual(goal);
  });

  it("keeps a bare name usable as a goal", () => {
    expect(defineGoal({ name: "signup" })).toEqual({ name: "signup" });
  });
});
