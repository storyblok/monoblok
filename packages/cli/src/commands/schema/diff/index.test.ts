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
const stdout = vi.spyOn(process.stdout, "write").mockReturnValue(true);

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

/** Registers the GET endpoints `fetchRemoteSchema` needs for a space. */
function spaceWith(space: string, components: MockComponent[]) {
  server.use(
    http.get(`https://mapi.storyblok.com/v1/spaces/${space}/components`, () =>
      HttpResponse.json({ components }),
    ),
    http.get(`https://mapi.storyblok.com/v1/spaces/${space}/component_groups`, () =>
      HttpResponse.json({ component_groups: [] }),
    ),
    http.get(`https://mapi.storyblok.com/v1/spaces/${space}/internal_tags`, () =>
      HttpResponse.json({ internal_tags: [] }, { headers: { Total: "0", "Per-Page": "100" } }),
    ),
    http.get(`https://mapi.storyblok.com/v1/spaces/${space}/datasources`, () =>
      HttpResponse.json({ datasources: [] }),
    ),
  );
}

/** Strips color escapes so assertions hold whether or not the runner reports a color-capable terminal. */
function plain(text: string): string {
  return text.replace(/\p{Cc}\[[0-9;]*m/gu, "");
}

/** The diff document on stdout — what `schema diff ... > changes.diff` captures. */
function diffOutput(): string {
  return plain(stdout.mock.calls.flat().join(""));
}

/** The surrounding chrome and errors, which the UI writes to stderr. */
function output(): string {
  return plain(consoleError.mock.calls.flat().join("\n"));
}

describe("schema diff command", () => {
  beforeAll(() => server.listen({ onUnhandledRequest: "error" }));

  afterEach(() => {
    process.exitCode = undefined;
    vi.resetAllMocks();
    vi.clearAllMocks();
    server.resetHandlers();
    // `resetAllMocks` drops the implementation, which would let the next test
    // write the diff to the real terminal.
    stdout.mockReturnValue(true);
  });

  afterAll(() => server.close());

  it("should diff two remote spaces and classify created, changed, and unchanged entities", async () => {
    spaceWith("111", [comp("hero", { title: { type: "text", pos: 0 } })]);
    spaceWith("222", [
      comp("hero", { title: { type: "text", pos: 0 }, subtitle: { type: "text", pos: 1 } }, 2),
      comp("banner", { image: { type: "asset", pos: 0 } }, 3),
    ]);

    await schemaCommand.parseAsync(["node", "test", "diff", "--from", "111", "--to", "222"]);

    expect(diffOutput()).toContain("+ banner (added)");
    expect(diffOutput()).toContain("~ hero (changed)");
    expect(diffOutput()).toContain("1 added, 1 changed");
  });

  it("should report which field changed rather than the whole block", async () => {
    spaceWith("111", [comp("hero", { title: { type: "text", pos: 0 } })]);
    spaceWith("222", [
      comp("hero", { title: { type: "text", pos: 0 }, subtitle: { type: "text", pos: 1 } }, 2),
    ]);

    await schemaCommand.parseAsync(["node", "test", "diff", "--from", "111", "--to", "222"]);

    expect(diffOutput()).toContain("+ schema.subtitle:");
  });

  it("should report a target block's explicit component_group_uuid against a space, as push would", async () => {
    // The raw-uuid escape hatch is what `schema push` acts on, so a diff whose
    // target is a schema file must not stay silent about it.
    const local: SchemaData = {
      components: [
        {
          ...comp("hero", { title: { type: "text", pos: 0 } }),
          component_group_uuid: "chosen-group",
        } as unknown as SchemaData["components"][number],
      ],
      datasources: [],
      folders: [],
    };
    vi.mocked(loadSchema).mockResolvedValue(local);
    server.use(
      http.get("https://mapi.storyblok.com/v1/spaces/222/components", () =>
        HttpResponse.json({
          components: [
            {
              ...comp("hero", { title: { type: "text", pos: 0 } }),
              component_group_uuid: "current-group",
            },
          ],
        }),
      ),
      http.get("https://mapi.storyblok.com/v1/spaces/222/component_groups", () =>
        HttpResponse.json({ component_groups: [] }),
      ),
      http.get("https://mapi.storyblok.com/v1/spaces/222/internal_tags", () =>
        HttpResponse.json({ internal_tags: [] }, { headers: { Total: "0", "Per-Page": "100" } }),
      ),
      http.get("https://mapi.storyblok.com/v1/spaces/222/datasources", () =>
        HttpResponse.json({ datasources: [] }),
      ),
    );

    await schemaCommand.parseAsync([
      "node",
      "test",
      "diff",
      "--from",
      "222",
      "--to",
      "./schema.ts",
    ]);

    expect(diffOutput()).toContain("~ hero (changed)");
    expect(diffOutput()).toContain("component_group_uuid");
  });

  it("should not compare component_group_uuid between two spaces", async () => {
    // Group UUIDs are per-space, so comparing them would flag every grouped block.
    for (const [space, uuid] of [
      ["111", "group-in-a"],
      ["222", "group-in-b"],
    ]) {
      server.use(
        http.get(`https://mapi.storyblok.com/v1/spaces/${space}/components`, () =>
          HttpResponse.json({
            components: [
              { ...comp("hero", { title: { type: "text", pos: 0 } }), component_group_uuid: uuid },
            ],
          }),
        ),
        http.get(`https://mapi.storyblok.com/v1/spaces/${space}/component_groups`, () =>
          HttpResponse.json({ component_groups: [] }),
        ),
        http.get(`https://mapi.storyblok.com/v1/spaces/${space}/internal_tags`, () =>
          HttpResponse.json({ internal_tags: [] }, { headers: { Total: "0", "Per-Page": "100" } }),
        ),
        http.get(`https://mapi.storyblok.com/v1/spaces/${space}/datasources`, () =>
          HttpResponse.json({ datasources: [] }),
        ),
      );
    }

    await schemaCommand.parseAsync(["node", "test", "diff", "--from", "111", "--to", "222"]);

    expect(diffOutput()).toContain("1 unchanged");
    expect(diffOutput()).not.toContain("component_group_uuid");
  });

  it("should fail when an entry file exports no schema definitions", async () => {
    vi.mocked(loadSchema).mockResolvedValue({ components: [], datasources: [], folders: [] });
    spaceWith("222", []);

    await schemaCommand.parseAsync([
      "node",
      "test",
      "diff",
      "--from",
      "./not-schema.ts",
      "--to",
      "222",
    ]);

    expect(output()).toContain("No blocks or datasources found");
    expect(process.exitCode).toBe(2);
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
    expect(diffOutput()).toContain("- hero (removed)");
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
