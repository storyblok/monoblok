import { describe, expect, it } from "vitest";
import { didYouMean, similarNames } from "./similar-names";

describe("similarNames", () => {
  it("should suggest the closest names first", () => {
    expect(
      similarNames("changelog_entry_v3", ["changelog_entry_v2", "changelog_entry", "page", "hero"]),
    ).toEqual(["changelog_entry_v2", "changelog_entry"]);
  });

  it("should suggest a name that differs only in case", () => {
    expect(similarNames("Hero", ["hero", "card"])).toEqual(["hero"]);
  });

  it("should suggest nothing when no name is close", () => {
    expect(similarNames("hero", ["card", "page", "teaser"])).toEqual([]);
  });

  it("should suggest at most three names", () => {
    expect(similarNames("card", ["card1", "card2", "card3", "card4"])).toHaveLength(3);
  });
});

describe("didYouMean", () => {
  it("should phrase one or several suggestions as a question", () => {
    expect(didYouMean("cardd", ["card"])).toBe(' Did you mean "card"?');
    expect(didYouMean("card", ["card1", "card2"])).toBe(' Did you mean "card1" or "card2"?');
  });

  it("should say nothing when no name is close", () => {
    expect(didYouMean("hero", ["card"])).toBe("");
  });
});
