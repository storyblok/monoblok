import { describe, expect, it } from "vitest";
import { checkPendingReleases } from "./releases";

const released = { id: 1, name: "Spring launch", released: true };
const pending = { id: 2, name: "Summer launch", released: false };

describe("checkPendingReleases", () => {
  it("should proceed when every release has been released", () => {
    expect(checkPendingReleases([released])).toEqual({ proceed: true, pending: [] });
  });

  it("should refuse while a release is pending and name it", () => {
    expect(checkPendingReleases([released, pending])).toEqual({
      proceed: false,
      pending: [pending],
    });
  });

  it("should proceed past pending releases when allowed, naming what the run will miss", () => {
    expect(checkPendingReleases([pending], { allowPendingReleases: true })).toEqual({
      proceed: true,
      pending: [pending],
    });
  });
});
