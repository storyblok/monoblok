import { describe, expect, it } from "vitest";
import { FailureCollector } from "./failure-report";
import { APIError, resetCredentialContext, setCredentialContext } from "../../../utils";
import { FetchError } from "../../../utils/fetch";

const insufficientScopeError = (): APIError => {
  setCredentialContext({ kind: "oauth" });
  const apiError = new APIError(
    "insufficient_scope",
    "update_story",
    new FetchError("Forbidden", {
      status: 403,
      statusText: "Forbidden",
      data: { error: "Insufficient scope: stories:write is required" },
    }),
  );
  resetCredentialContext();
  return apiError;
};

describe("FailureCollector fatal tracking", () => {
  it("should report no fatal failure for ordinary errors", () => {
    const failures = new FailureCollector();
    failures.record({ filename: "a.json" }, new Error("boom"));

    expect(failures.hasFatal).toBe(false);
  });

  it("should report a fatal failure once a credential error is recorded", () => {
    const failures = new FailureCollector();
    failures.record({ filename: "a.json" }, insufficientScopeError());

    expect(failures.hasFatal).toBe(true);
  });
});
