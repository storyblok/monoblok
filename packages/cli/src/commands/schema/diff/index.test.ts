import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";

import "../index";
import { schemaCommand } from "../command";
import type { SchemaData } from "../types";
import { CommandError } from "../../../utils";
import { loadSchema } from "../load-schema";

// loadSchema uses jiti to import TypeScript entry files at runtime, which cannot
// resolve @storyblok/schema in the test environment; mock it and feed data directly.
vi.mock("../load-schema", () => ({
  loadSchema: vi.fn(),
}));

const consoleError = vi.spyOn(console, "error");

const server = setupServer();

interface MockComponent {
  id: number;
  name: string;
  created_at: string;
  updated_at: string;
  schema: Record<string, Record<string, unknown>>;
}

function comp(
  name: string,
  schema: Record<string, Record<string, unknown>>,
  id = 1,
): MockComponent {
  return { id, name, created_at: "2024-01-01", updated_at: "2024-01-01", schema };
}

/** Registers the three GET endpoints `fetchRemoteSchema` needs for a space. */
function spaceWith(space: string, components: MockComponent[]) {
  server.use(
    http.get(`https://mapi.storyblok.com/v1/spaces/${space}/components`, () =>
      HttpResponse.json({ components }),
    ),
    http.get(`https://mapi.storyblok.com/v1/spaces/${space}/component_groups`, () =>
      HttpResponse.json({ component_groups: [] }),
    ),
    http.get(`https://mapi.storyblok.com/v1/spaces/${space}/datasources`, () =>
      HttpResponse.json({ datasources: [] }),
    ),
  );
}

/**
 * Everything the command rendered, with color escapes removed so assertions hold
 * whether or not the runner reports a color-capable terminal. The UI writes to
 * stderr; only machine-readable output goes to stdout.
 */
function output(): string {
  return consoleError.mock.calls
    .flat()
    .join("\n")
    .replace(/\p{Cc}\[[0-9;]*m/gu, "");
}

describe("schema diff command", () => {
  beforeAll(() => server.listen({ onUnhandledRequest: "error" }));

  afterEach(() => {
    process.exitCode = undefined;
    vi.resetAllMocks();
    vi.clearAllMocks();
    server.resetHandlers();
  });

  afterAll(() => server.close());

  it("should diff two remote spaces and classify created, changed, and unchanged entities", async () => {
    spaceWith("111", [comp("hero", { title: { type: "text", pos: 0 } })]);
    spaceWith("222", [
      comp("hero", { title: { type: "text", pos: 0 }, subtitle: { type: "text", pos: 1 } }, 2),
      comp("banner", { image: { type: "asset", pos: 0 } }, 3),
    ]);

    await schemaCommand.parseAsync(["node", "test", "diff", "--from", "111", "--to", "222"]);

    expect(output()).toContain("+ banner (added)");
    expect(output()).toContain("~ hero (changed)");
    expect(output()).toContain("1 added, 1 changed");
  });

  it("should report which field changed rather than the whole block", async () => {
    spaceWith("111", [comp("hero", { title: { type: "text", pos: 0 } })]);
    spaceWith("222", [
      comp("hero", { title: { type: "text", pos: 0 }, subtitle: { type: "text", pos: 1 } }, 2),
    ]);

    await schemaCommand.parseAsync(["node", "test", "diff", "--from", "111", "--to", "222"]);

    expect(output()).toContain("+ schema.subtitle:");
  });

  it("should diff a local entry file against a remote space", async () => {
    const local: SchemaData = {
      components: [
        comp("hero", {
          title: { type: "text", pos: 0 },
        }) as unknown as SchemaData["components"][number],
      ],
      datasources: [],
      folders: [],
    };
    vi.mocked(loadSchema).mockResolvedValue(local);
    spaceWith("222", []);

    await schemaCommand.parseAsync([
      "node",
      "test",
      "diff",
      "--from",
      "./schema.ts",
      "--to",
      "222",
    ]);

    expect(loadSchema).toHaveBeenCalledWith("./schema.ts");
    // Local (to=remote 222 is empty, from=file has hero) → hero exists only in `from` → removed.
    expect(output()).toContain("- hero (removed)");
  });

  it("should report which side failed to resolve when a file cannot be loaded", async () => {
    consoleError.mockImplementation(() => {});
    vi.mocked(loadSchema).mockRejectedValue(new Error("Cannot find module /abs/missing.ts"));
    spaceWith("222", []);

    await schemaCommand.parseAsync([
      "node",
      "test",
      "diff",
      "--from",
      "./missing.ts",
      "--to",
      "222",
    ]);

    expect(output()).toContain("--from");
    expect(output()).toContain("schema entry file");
    expect(process.exitCode).toBe(1);
  });

  it("should surface a schema authoring mistake unchanged, with the user-error exit code", async () => {
    consoleError.mockImplementation(() => {});
    vi.mocked(loadSchema).mockRejectedValue(
      new CommandError(`Duplicate schema definitions: block name "hero".`),
    );
    spaceWith("222", []);

    await schemaCommand.parseAsync([
      "node",
      "test",
      "diff",
      "--from",
      "./schema.ts",
      "--to",
      "222",
    ]);

    expect(output()).toContain(`Duplicate schema definitions: block name "hero".`);
    expect(output()).not.toContain("Check the path");
    expect(process.exitCode).toBe(2);
  });
});
