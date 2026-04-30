import { describe, expect, it } from "vitest";

import storyblokEditable from "./editable";

describe("storyblokEditable", () => {
  it("returns attributes for valid _editable string", () => {
    const blok = {
      _editable: '<!--#storyblok#{"name":"page","space":"147897","uid":"abc-123","id":"999"}-->',
    };

    const result = storyblokEditable(blok);

    expect(result).toEqual({
      "data-blok-c": JSON.stringify({
        name: "page",
        space: "147897",
        uid: "abc-123",
        id: "999",
      }),
      "data-blok-uid": "999-abc-123",
    });
  });

  it("returns empty object when blok is undefined", () => {
    expect(storyblokEditable(undefined)).toEqual({});
  });

  it("returns empty object when _editable is missing", () => {
    expect(storyblokEditable({})).toEqual({});
  });

  it("returns empty object for invalid JSON", () => {
    const blok = {
      _editable: "<!--#storyblok#INVALID_JSON-->",
    };

    expect(storyblokEditable(blok)).toEqual({});
  });

  it("returns empty object if wrapper is incorrect", () => {
    const blok = {
      _editable: '{"id":"1","uid":"abc"}',
    };

    expect(storyblokEditable(blok)).toEqual({});
  });
});
