import { describe, expectTypeOf, it } from "vitest";
import StoryblokClient from ".";
import type { ISbResponse, ISbStrataSearchHit, ISbStrataSearchResult } from "./interfaces";

// Regression guard for DX-472: the write methods resolve to the `ISbResponse`
// envelope (`{ data, status, statusText, headers }`), not the body payload
// `ISbResponseData`. The created resource lives at `response.data.*`.
describe("write method return types", () => {
  const client = new StoryblokClient({ oauthToken: "token" });

  it("post/put/patch/delete resolve to ISbResponse", () => {
    expectTypeOf(client.post).returns.resolves.toEqualTypeOf<ISbResponse>();
    expectTypeOf(client.put).returns.resolves.toEqualTypeOf<ISbResponse>();
    expectTypeOf(client.patch).returns.resolves.toEqualTypeOf<ISbResponse>();
    expectTypeOf(client.delete).returns.resolves.toEqualTypeOf<ISbResponse>();
  });
});

describe("strata search", () => {
  const client = new StoryblokClient({ accessToken: "token" });

  it("accepts the strata search params", () => {
    expectTypeOf(
      client.get("cdn/strata/search", {
        q: "pricing",
        version: "draft",
        limit: 10,
        starts_with: "docs/",
        content_type: "article",
      }),
    ).resolves.toEqualTypeOf<ISbStrataSearchResult>();
  });

  it("types the search hits", () => {
    expectTypeOf<
      ISbStrataSearchResult["data"]["results"][number]
    >().toEqualTypeOf<ISbStrataSearchHit>();
  });

  it("rejects params the endpoint does not take", () => {
    // @ts-expect-error `resolve_relations` is a stories param
    void client.get("cdn/strata/search", { q: "pricing", resolve_relations: "a.b" });
  });
});

describe("stories fetch", () => {
  const client = new StoryblokClient({ accessToken: "token" });

  it("rejects params the stories endpoint does not take", () => {
    // @ts-expect-error `q` is not a stories param
    void client.get("cdn/stories", { q: "pricing" });
  });
});
