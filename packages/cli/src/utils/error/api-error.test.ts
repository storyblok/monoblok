import { afterEach, describe, expect, it } from "vitest";
import { ClientError } from "@storyblok/management-api-client";
import { API_ACTIONS, APIError, handleAPIError } from "./api-error";
import { resetCredentialContext, setCredentialContext } from "./credential-context";
import { FetchError } from "../fetch";

// ClientError tests verify that mapi-client errors (which have a .response property)
// are handled correctly by the generic .response fallback in handleAPIError.

describe("handleAPIError", () => {
  it("should handle ClientError with 401 status", () => {
    const error = new ClientError("Unauthorized", {
      status: 401,
      statusText: "Unauthorized",
      data: "Unauthorized",
    });

    expect(() => handleAPIError("create_story", error)).toThrow(APIError);
    try {
      handleAPIError("create_story", error);
    } catch (e) {
      expect(e).toBeInstanceOf(APIError);
      expect((e as APIError).code).toBe(401);
      expect((e as APIError).errorId).toBe("unauthorized");
    }
  });

  it("should handle ClientError with 422 status and preserve error data", () => {
    const error = new ClientError("Unprocessable Entity", {
      status: 422,
      statusText: "Unprocessable Entity",
      data: { slug: ["has already been taken"] },
    });

    try {
      handleAPIError("create_story", error);
    } catch (e) {
      expect(e).toBeInstanceOf(APIError);
      expect((e as APIError).code).toBe(422);
      expect((e as APIError).errorId).toBe("unprocessable_entity");
      expect((e as APIError).response?.data).toEqual({ slug: ["has already been taken"] });
    }
  });

  it("should handle ClientError with 404 status", () => {
    const error = new ClientError("Not Found", {
      status: 404,
      statusText: "Not Found",
      data: { message: "Story not found" },
    });

    try {
      handleAPIError("create_story", error);
    } catch (e) {
      expect(e).toBeInstanceOf(APIError);
      expect((e as APIError).code).toBe(404);
      expect((e as APIError).errorId).toBe("not_found");
    }
  });

  it("should handle ClientError with 500 status as server_error", () => {
    const error = new ClientError("Internal Server Error", {
      status: 500,
      statusText: "Internal Server Error",
      data: {},
    });

    try {
      handleAPIError("create_story", error);
    } catch (e) {
      expect(e).toBeInstanceOf(APIError);
      expect((e as APIError).code).toBe(500);
      expect((e as APIError).errorId).toBe("server_error");
    }
  });

  it("should handle FetchError with 401 status", () => {
    const error = new FetchError("Unauthorized", { status: 401, statusText: "Unauthorized" });

    expect(() => handleAPIError("create_story", error)).toThrow(APIError);
    try {
      handleAPIError("create_story", error);
    } catch (e) {
      expect(e).toBeInstanceOf(APIError);
      expect((e as APIError).code).toBe(401);
      expect((e as APIError).errorId).toBe("unauthorized");
    }
  });

  it("should handle FetchError with 422 status", () => {
    const error = new FetchError("Unprocessable", {
      status: 422,
      statusText: "Unprocessable Entity",
    });

    try {
      handleAPIError("create_story", error);
    } catch (e) {
      expect((e as APIError).code).toBe(422);
      expect((e as APIError).errorId).toBe("unprocessable_entity");
    }
  });

  it("should rewrite 422 name-taken to a component message for component actions", () => {
    const error = new FetchError("Unprocessable", {
      status: 422,
      statusText: "Unprocessable Entity",
      data: { name: ["has already been taken"] },
    });
    try {
      handleAPIError("push_component", error);
    } catch (e) {
      expect((e as APIError).message).toBe("A component with this name already exists");
    }
  });

  it("should rewrite 422 name-taken to a folder message for folder create actions", () => {
    const error = new FetchError("Unprocessable", {
      status: 422,
      statusText: "Unprocessable Entity",
      data: { name: ["has already been taken"] },
    });
    try {
      handleAPIError("push_component_folder", error);
    } catch (e) {
      expect((e as APIError).message).toBe("A component folder with this name already exists");
    }
  });

  it("should not rewrite 422 name-taken to a component message for non-component actions", () => {
    const error = new FetchError("Unprocessable", {
      status: 422,
      statusText: "Unprocessable Entity",
      data: { name: ["has already been taken"] },
    });
    try {
      handleAPIError("push_datasource", error);
    } catch (e) {
      expect((e as APIError).message).not.toBe("A component with this name already exists");
    }
  });

  it("should handle non-FetchError objects with a response property", () => {
    const error = Object.assign(new Error("API call failed"), {
      response: {
        status: 422,
        statusText: "Unprocessable Entity",
        data: { slug: ["has already been taken"] },
      },
    });

    try {
      handleAPIError("create_story", error);
    } catch (e) {
      expect(e).toBeInstanceOf(APIError);
      expect((e as APIError).code).toBe(422);
      expect((e as APIError).errorId).toBe("unprocessable_entity");
    }
  });

  it("should handle non-FetchError objects with response 404", () => {
    const error = Object.assign(new Error("Not found"), {
      response: { status: 404, statusText: "Not Found" },
    });

    try {
      handleAPIError("create_story", error);
    } catch (e) {
      expect(e).toBeInstanceOf(APIError);
      expect((e as APIError).code).toBe(404);
      expect((e as APIError).errorId).toBe("not_found");
    }
  });

  it("should fall back to generic error for plain Error objects", () => {
    const error = new Error("Something broke");

    try {
      handleAPIError("create_story", error);
    } catch (e) {
      expect(e).toBeInstanceOf(APIError);
      expect((e as APIError).errorId).toBe("generic");
    }
  });

  it("should forward request url and method from FetchError into APIError.getInfo()", () => {
    const error = new FetchError(
      "HTTP error! status: 404",
      { status: 404, statusText: "Not Found", data: { message: "Missing" } },
      { url: "https://api.test.com/v1/spaces/1/stories", method: "POST" },
    );

    try {
      handleAPIError("create_story", error);
    } catch (e) {
      const info = (e as APIError).getInfo();
      expect(info.request).toEqual({
        url: "https://api.test.com/v1/spaces/1/stories",
        method: "POST",
      });
    }
  });

  it("should forward request context when a non-FetchError carries a request field", () => {
    const error = Object.assign(new Error("Not found"), {
      response: { status: 404, statusText: "Not Found", data: null },
      request: { url: "https://api.test.com/v1/spaces/1/stories/42", method: "PUT" },
    });

    try {
      handleAPIError("update_story", error);
    } catch (e) {
      const info = (e as APIError).getInfo();
      expect(info.request).toEqual({
        url: "https://api.test.com/v1/spaces/1/stories/42",
        method: "PUT",
      });
    }
  });

  it("should omit request from APIError.getInfo() when no url or method is available", () => {
    const error = new ClientError("Not Found", {
      status: 404,
      statusText: "Not Found",
      data: null,
    });

    try {
      handleAPIError("create_story", error);
    } catch (e) {
      const info = (e as APIError).getInfo() as Record<string, unknown>;
      expect("request" in info).toBe(false);
    }
  });
});

describe("aPIError server message extraction", () => {
  it("should use data.error string as message when present", () => {
    const error = new FetchError("Not Found", {
      status: 404,
      statusText: "Not Found",
      data: { error: "Story not found in this space" },
    });
    try {
      handleAPIError("pull_story", error);
    } catch (e) {
      expect((e as APIError).message).toBe("Story not found in this space");
      expect((e as APIError).messageStack).toContain("Story not found in this space");
    }
  });

  it("should use data.message string as message when data.error is absent", () => {
    const error = new FetchError("Unauthorized", {
      status: 401,
      statusText: "Unauthorized",
      data: { message: "Token has expired" },
    });
    try {
      handleAPIError("get_user", error);
    } catch (e) {
      expect((e as APIError).message).toBe("Token has expired");
      expect((e as APIError).messageStack).toContain("Token has expired");
    }
  });

  it("should prefer data.error over data.message when both are present", () => {
    const error = new FetchError("Bad Request", {
      status: 400,
      statusText: "Bad Request",
      data: { error: "Invalid slug format", message: "Something went wrong" },
    });
    try {
      handleAPIError("create_story", error);
    } catch (e) {
      expect((e as APIError).message).toBe("Invalid slug format");
    }
  });

  it("should not override a customMessage with the server message", () => {
    const error = new FetchError("Not Found", {
      status: 404,
      statusText: "Not Found",
      data: { error: "Story not found in this space" },
    });
    try {
      handleAPIError("pull_story", error, "Custom override message");
    } catch (e) {
      expect((e as APIError).message).toBe("Custom override message");
    }
  });

  it("should not override the 422 name-taken rewrite with the server message", () => {
    const error = new FetchError("Unprocessable", {
      status: 422,
      statusText: "Unprocessable Entity",
      data: { name: ["has already been taken"], error: "Validation failed" },
    });
    try {
      handleAPIError("push_component", error);
    } catch (e) {
      expect((e as APIError).message).toBe("A component with this name already exists");
    }
  });

  it("should fall back to generic API_ERRORS message when data has no error/message string", () => {
    const error = new FetchError("Server Error", {
      status: 500,
      statusText: "Internal Server Error",
      data: { code: 500 },
    });
    try {
      handleAPIError("pull_stories", error);
    } catch (e) {
      expect((e as APIError).message).toBe("The server returned an error");
    }
  });

  it("should not replace message with an empty string from data.error", () => {
    const error = new FetchError("Server Error", {
      status: 500,
      statusText: "Internal Server Error",
      data: { error: "" },
    });
    try {
      handleAPIError("pull_stories", error);
    } catch (e) {
      expect((e as APIError).message).toBe("The server returned an error");
    }
  });

  it("should NOT override message when server error string matches HTTP statusText (401 regression, HTTP/1.1)", () => {
    // MAPI returns {"error":"Unauthorized"} for 401. The old code replaced the
    // friendly "The user is not authorized to access the API" with "Unauthorized".
    const error = new FetchError("Unauthorized", {
      status: 401,
      statusText: "Unauthorized",
      data: { error: "Unauthorized" },
    });
    try {
      handleAPIError("pull_components", error);
    } catch (e) {
      expect((e as APIError).message).toBe("The user is not authorized to access the API");
      expect((e as APIError).cause).toBe("The user is not authorized to access the API");
    }
  });

  it("should NOT override message when server error string matches canonical reason phrase (401 regression, HTTP/2 empty statusText)", () => {
    // HTTP/2 sends empty statusText; MAPI still returns {"error":"Unauthorized"}.
    // Without the canonical-phrase fallback the guard would pass and "Unauthorized"
    // would replace the friendlier API_ERRORS.unauthorized constant.
    const error = new FetchError("", {
      status: 401,
      statusText: "",
      data: { error: "Unauthorized" },
    });
    try {
      handleAPIError("pull_components", error);
    } catch (e) {
      expect((e as APIError).message).toBe("The user is not authorized to access the API");
      expect((e as APIError).cause).toBe("The user is not authorized to access the API");
    }
  });

  it("should sync cause with message when a server message overrides the generic entry", () => {
    const error = new FetchError("Not Found", {
      status: 404,
      statusText: "Not Found",
      data: { error: "Space not found" },
    });
    try {
      handleAPIError("pull_stories", error);
    } catch (e) {
      expect((e as APIError).message).toBe("Space not found");
      expect((e as APIError).cause).toBe("Space not found");
    }
  });

  it('should extract messages from 422 nested error object {"error":{"base":["msg"]}}', () => {
    // Real MAPI asset-create shape: POST /assets with bad asset_folder_id
    const error = new FetchError("Unprocessable Entity", {
      status: 422,
      statusText: "Unprocessable Entity",
      data: { error: { base: ["This asset folder is not valid"] } },
    });
    try {
      handleAPIError("push_asset_create", error);
    } catch (e) {
      expect((e as APIError).messageStack).toContain("base: This asset folder is not valid");
      // "base" is a Rails model-level key — strip it from the summary message
      expect((e as APIError).message).toBe("This asset folder is not valid");
    }
  });

  it("should extract messages from 422 nested error object with multiple fields", () => {
    // Real MAPI asset-create shape: bad internal_tag_ids
    const error = new FetchError("Unprocessable Entity", {
      status: 422,
      statusText: "Unprocessable Entity",
      data: {
        error: {
          internal_tag_ids: [
            "Invalid internal_tag, there is at least one internal_tag not found in our database",
          ],
        },
      },
    });
    try {
      handleAPIError("push_asset_create", error);
    } catch (e) {
      expect((e as APIError).messageStack).toContain(
        "internal_tag_ids: Invalid internal_tag, there is at least one internal_tag not found in our database",
      );
      // field name is preserved — it tells the user which parameter is invalid
      expect((e as APIError).message).toBe(
        "internal_tag_ids: Invalid internal_tag, there is at least one internal_tag not found in our database",
      );
    }
  });
});

describe("APIError credential rewrites", () => {
  afterEach(() => {
    resetCredentialContext();
  });

  it("should classify a plain 403 as forbidden rather than generic", () => {
    const error = new FetchError("Forbidden", {
      status: 403,
      statusText: "Forbidden",
      data: {},
    });

    try {
      handleAPIError("push_component", error);
    } catch (e) {
      expect((e as APIError).errorId).toBe("forbidden");
      expect((e as APIError).code).toBe(403);
    }
  });

  it("should rewrite an insufficient-scope 403 into an actionable message", () => {
    setCredentialContext({ kind: "oauth" });
    const error = new FetchError("Forbidden", {
      status: 403,
      statusText: "Forbidden",
      data: { error: "Insufficient scope: stories:write is required" },
    });

    try {
      handleAPIError("update_story", error);
    } catch (e) {
      const apiError = e as APIError;
      expect(apiError.errorId).toBe("insufficient_scope");
      expect(apiError.fatal).toBe(true);
      expect(apiError.message).toBe(
        'Your OAuth login is missing the "stories:write" permission. Re-run `storyblok login` and grant it at the consent screen.',
      );
    }
  });

  it("should keep the failed action as the first message stack entry", () => {
    setCredentialContext({ kind: "oauth" });
    const error = new FetchError("Forbidden", {
      status: 403,
      statusText: "Forbidden",
      data: { error: "Insufficient scope: stories:write is required" },
    });

    try {
      handleAPIError("update_story", error);
    } catch (e) {
      const apiError = e as APIError;
      expect(apiError.messageStack[0]).toBe(API_ACTIONS.update_story);
      expect(apiError.messageStack.at(-1)).toBe(apiError.message);
    }
  });

  it("should leave the raw server string alone when the credential kind is unknown", () => {
    const error = new FetchError("Forbidden", {
      status: 403,
      statusText: "Forbidden",
      data: { error: "Insufficient scope: stories:write is required" },
    });

    try {
      handleAPIError("update_story", error);
    } catch (e) {
      const apiError = e as APIError;
      expect(apiError.message).toBe("Insufficient scope: stories:write is required");
      expect(apiError.fatal).toBe(false);
    }
  });

  it("should let a customMessage suppress the credential rewrite entirely", () => {
    setCredentialContext({ kind: "oauth" });
    const error = new FetchError("Forbidden", {
      status: 403,
      statusText: "Forbidden",
      data: { error: "Insufficient scope: stories:write is required" },
    });

    try {
      handleAPIError("update_story", error, "Custom override message");
    } catch (e) {
      const apiError = e as APIError;
      expect(apiError.message).toBe("Custom override message");
      expect(apiError.fatal).toBe(false);
    }
  });

  it("should not mark unrelated errors as fatal", () => {
    setCredentialContext({ kind: "oauth" });
    const error = new FetchError("Unprocessable", {
      status: 422,
      statusText: "Unprocessable Entity",
      data: { slug: ["has already been taken"] },
    });

    try {
      handleAPIError("create_story", error);
    } catch (e) {
      expect((e as APIError).fatal).toBe(false);
    }
  });
});
