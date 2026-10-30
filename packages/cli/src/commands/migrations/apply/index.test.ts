import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { vol } from "memfs";
import { defineBlock, defineField } from "@storyblok/schema";
import {
  addField,
  coerceField,
  defineMigration,
  mergeFields,
  removeField,
  renameBlock,
  renameField,
  wrapChildren,
} from "@storyblok/schema/migrations";
import "../index";
import { migrationsCommand } from "../command";
import { DEFAULT_SPACE } from "../../__tests__/helpers";
import { getUI } from "../../../lib/ui";
import { session } from "../../../session";
import { loggedInSessionState, loggedOutSessionState } from "../../../../test/setup";
import {
  createRemoteSpace,
  journalEntries,
  MIGRATIONS_DIRECTORY,
  storyWithCard,
} from "../__tests__/content-migrations";

vi.mock("../../../utils/user-module", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../../utils/user-module")>()),
  importUserModuleDefault: vi.fn(),
}));

let schemaModule: Record<string, unknown> = {};
/** Schema snapshot exports by migration id, or the error loading the snapshot throws. */
let snapshotModules: Record<string, Record<string, unknown> | Error> = {};
vi.mock("../../../utils/schema/classify-exports", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../../utils/schema/classify-exports")>()),
  loadSchemaModule: async (path: string) => {
    const snapshot = Object.entries(snapshotModules).find(([id]) =>
      path.endsWith(`${id}.before.ts`),
    )?.[1];
    if (snapshot instanceof Error) throw snapshot;
    return snapshot ?? schemaModule;
  },
}));

const server = setupServer();

const apply = (...args: string[]): Promise<unknown> =>
  migrationsCommand.parseAsync(["node", "test", "apply", ...args, "--space", DEFAULT_SPACE]);

const renameCardTitle = defineMigration([
  renameField({ block: "card", field: "title", to: "headline" }),
]);
const renameCardToTeaser = defineMigration([renameBlock({ block: "card", to: "teaser" })]);
const wrapPageBody = defineMigration([
  wrapChildren({ block: "page", field: "body", in: "grid", into: "items" }),
]);
const cardBlock = defineBlock({ name: "card", fields: [defineField("title", { type: "text" })] });
const pageBlock = defineBlock({ name: "page", fields: [defineField("body", { type: "bloks" })] });

/** Writes a `.before.ts` snapshot beside a migration, exporting `blocks`. */
function hasSnapshot(id: string, ...blocks: unknown[]): void {
  vol.fromJSON({ [`${MIGRATIONS_DIRECTORY}/${id}.before.ts`]: "export {};" });
  snapshotModules[id] = Object.fromEntries(blocks.map((block, index) => [`block${index}`, block]));
}

function hasNameOnlyBlocks(id: string, ...names: string[]): void {
  const snapshot = snapshotModules[id];
  if (snapshot instanceof Error || !snapshot) throw new Error(`no snapshot for ${id}`);
  snapshot.nameOnlyBlocks = names;
}

const renameTeaserTitle = defineMigration([
  renameField({ block: "teaser", field: "title", to: "headline" }),
]);

const storyWithRepeatedIds = (id = 1) =>
  storyWithCard({
    id,
    slug: `repeated-${id}`,
    full_slug: `repeated-${id}`,
    content: {
      _uid: `root-${id}`,
      component: "page",
      body: [
        { _uid: "dup", component: "card", title: "one" },
        { _uid: "dup", component: "card", title: "two" },
      ],
    },
  });

describe("migrations apply command", () => {
  let space: ReturnType<typeof createRemoteSpace>;

  beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
  afterEach(() => {
    server.resetHandlers();
    vi.restoreAllMocks();
  });
  afterAll(() => server.close());

  beforeEach(() => {
    schemaModule = {};
    snapshotModules = {};
    space = createRemoteSpace(server);
    space.hasReleases();
  });

  it("should write the migrated content of every story the migration changed", async () => {
    space.hasMigrations(["0001-rename-card-title", renameCardTitle]);
    space.hasStories(storyWithCard());
    space.canUpdateStories();

    await apply();

    expect(space.writes).toEqual([
      {
        id: 1,
        content: expect.objectContaining({
          body: [{ _uid: "card-1", component: "card", headline: "Hi" }],
        }),
        publish: false,
      },
    ]);
  });

  it("should skip ops on a field a later migration renamed when every migration reruns", async () => {
    space.hasMigrations(
      [
        "0001-add-noindex",
        defineMigration([addField({ block: "page", field: "noindex" }, () => false)]),
      ],
      [
        "0002-rename-noindex",
        defineMigration([renameField({ block: "page", field: "noindex", to: "hide" })]),
      ],
    );
    space.hasBlocks({ page: ["body", "hide"] });
    space.hasStories(
      storyWithCard({ content: { _uid: "root", component: "page", body: [], hide: false } }),
    );
    space.canUpdateStories();
    const warn = vi.spyOn(getUI(), "warn");
    process.exitCode = undefined;

    await apply();

    expect(space.writes).toEqual([]);
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining(
        'addField page.noindex skipped: the page block in the space has no field "noindex".',
      ),
    );
    expect(process.exitCode).toBeUndefined();
  });

  it("should keep a field a later schema change added back", async () => {
    space.hasMigrations([
      "0001-remove-accent",
      defineMigration([removeField({ block: "card", field: "accent" })]),
    ]);
    space.hasBlocks({ card: ["title", "accent"] });
    space.hasStories(
      storyWithCard({
        content: {
          _uid: "root",
          component: "page",
          body: [{ _uid: "card-1", component: "card", title: "Hi", accent: "green" }],
        },
      }),
    );
    space.canUpdateStories();

    await apply();

    expect(space.writes).toEqual([]);
    expect(space.story(1)?.content.body).toEqual([
      { _uid: "card-1", component: "card", title: "Hi", accent: "green" },
    ]);
  });

  it("should keep a field a later schema change added back after a merge", async () => {
    space.hasMigrations([
      "0001-merge-name",
      defineMigration([
        mergeFields({ block: "card", fields: ["first", "last"], into: "name" }, (values) =>
          values.join(" "),
        ),
      ]),
    ]);
    space.hasBlocks({ card: ["name", "first"] });
    space.hasStories(
      storyWithCard({
        content: {
          _uid: "root",
          component: "page",
          body: [{ _uid: "card-1", component: "card", name: "Ada Lovelace", first: "Ada" }],
        },
      }),
    );
    space.canUpdateStories();

    await apply();

    expect(space.writes).toEqual([]);
  });

  it("should skip a coercion to a type the field no longer has", async () => {
    space.hasMigrations(
      [
        "0001-price-to-number",
        defineMigration([coerceField({ block: "card", field: "price", to: "number" })]),
      ],
      [
        "0002-price-to-text",
        defineMigration([coerceField({ block: "card", field: "price", to: "string" })]),
      ],
    );
    space.hasBlocks({ card: { price: "text" } });
    space.hasStories(
      storyWithCard({
        content: {
          _uid: "root",
          component: "page",
          body: [{ _uid: "card-1", component: "card", price: "about 5 EUR" }],
        },
      }),
    );
    space.canUpdateStories();
    const warn = vi.spyOn(getUI(), "warn");
    process.exitCode = undefined;

    await apply();

    expect(space.writes).toEqual([]);
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining(
        'coerceField card.price skipped: the card block in the space has "price" as a text field.',
      ),
    );
    expect(process.exitCode).toBeUndefined();
  });

  it("should apply migrations in the order of their numeric prefix", async () => {
    space.hasMigrations(
      ["10-rename-teaser-title", renameTeaserTitle],
      ["9-rename-card-to-teaser", renameCardToTeaser],
    );
    space.hasStories(storyWithCard());
    space.canUpdateStories();

    await apply();

    expect(space.story(1)?.content.body).toEqual([
      { _uid: "card-1", component: "teaser", headline: "Hi" },
    ]);
  });

  it("should apply only the named migration", async () => {
    space.hasMigrations(
      ["0001-rename-card-title", renameCardTitle],
      ["0002-rename-card-to-teaser", renameCardToTeaser],
    );
    space.hasStories(storyWithCard());
    space.canUpdateStories();

    await apply("0002-rename-card-to-teaser");

    expect(space.story(1)?.content.body).toEqual([
      { _uid: "card-1", component: "teaser", title: "Hi" },
    ]);
  });

  it("should fail when no migration has the given name and name the ones there are", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    space.hasMigrations(["0001-rename-card-title", renameCardTitle]);
    space.hasStories(storyWithCard());

    await apply("0002-other");

    expect(space.writes).toEqual([]);
    expect(process.exitCode).toBe(2);
    expect(error.mock.calls.flat().join("\n")).toContain("Available: 0001-rename-card-title.");
  });

  it("should accept the migration's filename as its name", async () => {
    space.hasMigrations(["0001-rename-card-title", renameCardTitle]);
    space.hasStories(storyWithCard());
    space.canUpdateStories();

    await apply("0001-rename-card-title.ts");

    expect(space.writes).toHaveLength(1);
  });

  it("should apply the named migration when another migration file is broken", async () => {
    space.hasMigrations(["0001-rename-card-title", renameCardTitle]);
    vol.fromJSON({ [`${MIGRATIONS_DIRECTORY}/0002-broken.ts`]: "export default 42;" });
    space.hasStories(storyWithCard());
    space.canUpdateStories();

    await apply("0001-rename-card-title");

    expect(space.writes).toHaveLength(1);
    expect(process.exitCode).toBeUndefined();
  });

  it("should not apply schema snapshots that sit beside the migrations as migrations", async () => {
    space.hasMigrations(["0001-rename-card-title", renameCardTitle]);
    hasSnapshot("0001-rename-card-title", cardBlock);
    space.hasStories(storyWithCard());
    space.canUpdateStories();

    await apply();

    expect(space.writes).toHaveLength(1);
    expect(process.exitCode).toBeUndefined();
  });

  it("should record the run so it can be listed and undone", async () => {
    const info = vi.spyOn(getUI(), "info");
    space.hasMigrations(["0001-rename-card-title", renameCardTitle]);
    space.hasStories(storyWithCard());
    space.canUpdateStories();

    await apply();
    await migrationsCommand.parseAsync(["node", "test", "list", "--space", DEFAULT_SPACE]);

    expect(journalEntries()).toMatchObject([
      { space: DEFAULT_SPACE, migration: "0001-rename-card-title", stories: 1, blocks: 1 },
    ]);
    expect(info).toHaveBeenLastCalledWith(
      expect.stringMatching(
        /-0001-rename-card-title {2}0001-rename-card-title {2}1 story, 1 block$/,
      ),
    );
  });

  it("should list the recorded runs without a login", async () => {
    const info = vi.spyOn(getUI(), "info");
    space.hasMigrations(["0001-rename-card-title", renameCardTitle]);
    space.hasStories(storyWithCard());
    space.canUpdateStories();
    await apply();
    session().state = loggedOutSessionState();

    try {
      await migrationsCommand.parseAsync(["node", "test", "list", "--space", DEFAULT_SPACE]);
    } finally {
      session().state = loggedInSessionState();
    }

    expect(process.exitCode).toBeUndefined();
    expect(info).toHaveBeenLastCalledWith(expect.stringContaining("0001-rename-card-title"));
  });

  it("should neither write nor record anything on a dry run", async () => {
    space.hasMigrations(["0001-rename-card-title", renameCardTitle]);
    space.hasStories(storyWithCard());

    await apply("--dry-run");

    expect(space.writes).toEqual([]);
    expect(journalEntries()).toEqual([]);
  });

  it("should report under a dry run what a real run does, including for a migration that matches only what an earlier one produced", async () => {
    const info = vi.spyOn(getUI(), "info");
    const list = vi.spyOn(getUI(), "list");
    space.hasMigrations(
      ["0001-rename-card-to-teaser", renameCardToTeaser],
      ["0002-rename-teaser-title", renameTeaserTitle],
    );
    space.hasStories(storyWithCard());
    space.canUpdateStories();

    await apply("--dry-run");

    expect(info.mock.calls.map(([message]) => message)).toEqual([
      "0001-rename-card-to-teaser: would change 1 story (1 block).",
      "0002-rename-teaser-title: would change 1 story (1 block).",
    ]);
    expect(list).toHaveBeenCalledWith(["home: 1 block"]);
    info.mockClear();

    await apply();

    expect(space.writes).toHaveLength(2);
    expect(info.mock.calls.map(([message]) => message)).toEqual([
      expect.stringMatching(
        /^0001-rename-card-to-teaser: changed 1 story \(1 block\), recorded as /,
      ),
      expect.stringMatching(/^0002-rename-teaser-title: changed 1 story \(1 block\), recorded as /),
    ]);
  });

  it("should refuse a story that already contains repeated block ids and fail when nothing was written", async () => {
    space.hasMigrations(["0001-rename-card-title", renameCardTitle]);
    space.hasStories(storyWithRepeatedIds());
    space.canUpdateStories();

    await apply();

    expect(space.writes).toEqual([]);
    expect(journalEntries()).toEqual([]);
    expect(process.exitCode).toBe(2);
  });

  it("should succeed and record the stories it wrote when it refused others", async () => {
    space.hasMigrations(["0001-rename-card-title", renameCardTitle]);
    space.hasStories(storyWithCard(), storyWithRepeatedIds(2));
    space.canUpdateStories();

    await apply();

    expect(space.writes.map((write) => write.id)).toEqual([1]);
    expect(journalEntries()).toMatchObject([{ stories: 1 }]);
    expect(process.exitCode).toBeUndefined();
  });

  it("should fail when one of several migrations refused every story it matched", async () => {
    space.hasMigrations(
      ["0001-rename-card-title", renameCardTitle],
      [
        "0002-rename-hero-title",
        defineMigration([renameField({ block: "hero", field: "title", to: "headline" })]),
      ],
    );
    space.hasStories(
      storyWithRepeatedIds(1),
      storyWithCard({
        id: 2,
        slug: "about",
        full_slug: "about",
        content: {
          _uid: "root-2",
          component: "page",
          body: [{ _uid: "hero-1", component: "hero", title: "Hi" }],
        },
      }),
    );
    space.canUpdateStories();

    await apply();

    expect(space.writes.map((write) => write.id)).toEqual([2]);
    expect(process.exitCode).toBe(2);
  });

  it("should record nothing and fail when every write failed", async () => {
    space.hasMigrations(["0001-rename-card-title", renameCardTitle]);
    space.hasStories(storyWithCard());
    space.failsToUpdateStories();

    await apply();

    expect(journalEntries()).toEqual([]);
    expect(process.exitCode).toBe(2);
  });

  it("should record the run before the first write, so a run that stops partway can be undone", async () => {
    const recordedAtWrite: number[] = [];
    space.hasMigrations(["0001-rename-card-title", renameCardTitle]);
    space.hasStories(storyWithCard());
    space.canUpdateStories(() => recordedAtWrite.push(journalEntries().length));

    await apply();

    expect(recordedAtWrite).toEqual([1]);
  });

  it("should list a run that stopped before it finished as interrupted", async () => {
    const info = vi.spyOn(getUI(), "info");
    let journalAtWrite: Record<string, string | null> = {};
    space.hasMigrations(["0001-rename-card-title", renameCardTitle]);
    space.hasStories(storyWithCard());
    space.canUpdateStories(() => {
      journalAtWrite = Object.fromEntries(
        Object.entries(vol.toJSON()).filter(([file]) => file.includes(".journal")),
      );
    });
    const list = () =>
      migrationsCommand.parseAsync(["node", "test", "list", "--space", DEFAULT_SPACE]);

    await apply();
    await list();

    expect(info).toHaveBeenLastCalledWith(expect.stringMatching(/1 story, 1 block$/));

    vol.fromJSON(journalAtWrite);
    await list();

    expect(info).toHaveBeenLastCalledWith(
      expect.stringMatching(/1 story, 1 block {2}\(interrupted\)$/),
    );
  });

  it("should record only the stories that were written when some writes failed, and fail", async () => {
    const warn = vi.spyOn(getUI(), "warn");
    space.hasMigrations(["0001-rename-card-title", renameCardTitle]);
    space.hasStories(storyWithCard(), storyWithCard({ id: 2, slug: "about", full_slug: "about" }));
    space.canUpdateStories();
    server.use(
      http.put(`https://mapi.storyblok.com/v1/spaces/${DEFAULT_SPACE}/stories/2`, () =>
        HttpResponse.json({ error: "Unprocessable Entity" }, { status: 422 }),
      ),
    );

    await apply();

    expect(journalEntries()).toMatchObject([{ stories: 1 }]);
    expect(process.exitCode).toBe(2);
    expect(warn).toHaveBeenCalledWith(expect.stringMatching(/^.*about.* could not be written: /));
  });

  it("should migrate the other stories and fail when one story could not be read", async () => {
    space.hasMigrations(["0001-rename-card-title", renameCardTitle]);
    space.hasStories(storyWithCard(), storyWithCard({ id: 2, slug: "about", full_slug: "about" }));
    space.canUpdateStories();
    space.failsToReadStory(1);

    await apply();

    expect(space.writes.map((write) => write.id)).toEqual([2]);
    expect(process.exitCode).toBe(2);
  });

  it("should record nothing for a re-run that changes no story, and say so on a dry run too", async () => {
    const info = vi.spyOn(getUI(), "info");
    space.hasMigrations(["0001-rename-card-title", renameCardTitle]);
    space.hasStories(storyWithCard());
    space.canUpdateStories();
    await apply();
    info.mockClear();

    await apply("--dry-run");
    await apply();

    expect(journalEntries()).toHaveLength(1);
    expect(info.mock.calls.map(([message]) => message)).toEqual([
      "0001-rename-card-title: would change no stories.",
      "0001-rename-card-title: changed no stories, so nothing was recorded.",
    ]);
  });

  describe("--schema", () => {
    it("should refuse to check several migrations against one schema", async () => {
      space.hasMigrations(
        ["0001-rename-card-title", renameCardTitle],
        ["0002-rename-card-to-teaser", renameCardToTeaser],
      );
      server.resetHandlers();

      await apply("--schema", "src/schema.ts");

      expect(space.writes).toEqual([]);
      expect(process.exitCode).toBe(2);
    });

    it("should refuse a migration naming a block the schema does not define, before reaching the API", async () => {
      const error = vi.spyOn(console, "error").mockImplementation(() => {});
      space.hasMigrations(["0001-rename-card-title", renameCardTitle]);
      schemaModule = {
        page: defineBlock({ name: "page", fields: [defineField("body", { type: "bloks" })] }),
      };
      server.resetHandlers();

      await apply("--schema", "src/schema.ts");

      expect(space.writes).toEqual([]);
      expect(process.exitCode).toBe(2);
      expect(error.mock.calls.flat().join("\n")).toContain(
        "0001-rename-card-title does not match the schema",
      );
    });

    it("should read the name-only blocks of a snapshot passed as the schema", async () => {
      const error = vi.spyOn(console, "error").mockImplementation(() => {});
      space.hasMigrations([
        "0001-rename-teaser-title",
        defineMigration([renameField({ block: "teaser", field: "title", to: "headline" })]),
      ]);
      schemaModule = {
        teaser: defineBlock({ name: "teaser", fields: [] }),
        nameOnlyBlocks: ["teaser"],
      };
      server.resetHandlers();

      await apply("--schema", "0001-rename-teaser-title.before.ts");

      expect(space.writes).toEqual([]);
      expect(error.mock.calls.flat().join("\n")).toContain('Block "teaser" is listed by name only');
    });

    it("should apply a migration the schema defines", async () => {
      space.hasMigrations(["0001-rename-card-title", renameCardTitle]);
      space.hasStories(storyWithCard());
      space.canUpdateStories();
      schemaModule = {
        card: defineBlock({ name: "card", fields: [defineField("title", { type: "text" })] }),
      };

      await apply("--schema", "src/schema.ts");

      expect(space.writes).toHaveLength(1);
    });
  });

  describe("schema snapshots", () => {
    it("should refuse a renameBlock onto a block its snapshot already defines, before reaching the API", async () => {
      const error = vi.spyOn(console, "error").mockImplementation(() => {});
      space.hasMigrations(["0001-rename-card-to-teaser", renameCardToTeaser]);
      hasSnapshot(
        "0001-rename-card-to-teaser",
        cardBlock,
        defineBlock({ name: "teaser", fields: [defineField("headline", { type: "text" })] }),
      );
      server.resetHandlers();

      await apply();

      expect(space.writes).toEqual([]);
      expect(process.exitCode).toBe(2);
      expect(error.mock.calls.flat().join("\n")).toContain('Block "teaser" already exists');
    });

    it("should refuse wrapping children into an existing block that lacks the target field", async () => {
      const error = vi.spyOn(console, "error").mockImplementation(() => {});
      space.hasMigrations(["0001-wrap-page-body", wrapPageBody]);
      hasSnapshot(
        "0001-wrap-page-body",
        pageBlock,
        defineBlock({ name: "grid", fields: [defineField("columns", { type: "bloks" })] }),
      );
      server.resetHandlers();

      await apply();

      expect(space.writes).toEqual([]);
      expect(process.exitCode).toBe(2);
      expect(error.mock.calls.flat().join("\n")).toContain('has no field "items"');
    });

    it("should check each of several migrations against its own snapshot", async () => {
      space.hasMigrations(
        ["0001-rename-card-title", renameCardTitle],
        ["0002-rename-card-to-teaser", renameCardToTeaser],
      );
      hasSnapshot("0001-rename-card-title", cardBlock);
      hasSnapshot(
        "0002-rename-card-to-teaser",
        defineBlock({ name: "card", fields: [defineField("headline", { type: "text" })] }),
      );
      space.hasStories(storyWithCard());
      space.canUpdateStories();

      await apply();

      expect(space.writes).toHaveLength(2);
      expect(process.exitCode).toBeUndefined();
    });

    it("should apply without a check and warn when a migration has no snapshot", async () => {
      const warn = vi.spyOn(getUI(), "warn");
      space.hasMigrations(["0001-rename-card-title", renameCardTitle]);
      space.hasStories(storyWithCard());
      space.canUpdateStories();

      await apply();

      expect(space.writes).toHaveLength(1);
      expect(warn.mock.calls.flat().join("\n")).toContain(
        "Not checked against a schema, because no .before.ts snapshot sits beside it: 0001-rename-card-title",
      );
    });

    it("should report the mismatches of every migration in one failure", async () => {
      const error = vi.spyOn(console, "error").mockImplementation(() => {});
      space.hasMigrations(
        ["0001-rename-card-to-teaser", renameCardToTeaser],
        ["0002-wrap-page-body", wrapPageBody],
      );
      hasSnapshot(
        "0001-rename-card-to-teaser",
        cardBlock,
        defineBlock({ name: "teaser", fields: [defineField("headline", { type: "text" })] }),
      );
      hasSnapshot(
        "0002-wrap-page-body",
        pageBlock,
        defineBlock({ name: "grid", fields: [defineField("columns", { type: "bloks" })] }),
      );
      server.resetHandlers();

      await apply();

      const output = error.mock.calls.flat().join("\n");
      expect(output).toContain("0001-rename-card-to-teaser does not match the schema");
      expect(output).toContain("0002-wrap-page-body does not match the schema");
      expect(process.exitCode).toBe(2);
    });

    it("should refuse a renameBlock onto a block the snapshot lists by name only", async () => {
      const error = vi.spyOn(console, "error").mockImplementation(() => {});
      space.hasMigrations(["0001-rename-card-to-teaser", renameCardToTeaser]);
      hasSnapshot("0001-rename-card-to-teaser", cardBlock);
      hasNameOnlyBlocks("0001-rename-card-to-teaser", "teaser");
      server.resetHandlers();

      await apply();

      expect(space.writes).toEqual([]);
      expect(error.mock.calls.flat().join("\n")).toContain('Block "teaser" already exists');
    });

    it("should warn and apply when wrapping children into a block the snapshot lists by name only", async () => {
      const warn = vi.spyOn(getUI(), "warn");
      space.hasMigrations(["0001-wrap-page-body", wrapPageBody]);
      hasSnapshot("0001-wrap-page-body", pageBlock, defineBlock({ name: "grid", fields: [] }));
      hasNameOnlyBlocks("0001-wrap-page-body", "grid");
      space.hasStories(storyWithCard());
      space.canUpdateStories();

      await apply();

      expect(space.writes).toHaveLength(1);
      expect(warn.mock.calls.flat().join("\n")).toContain(
        '0001-wrap-page-body: op 0: Block "grid" already exists but is listed by name only',
      );
    });

    it("should refuse a snapshot in a format newer than the CLI reads", async () => {
      const error = vi.spyOn(console, "error").mockImplementation(() => {});
      space.hasMigrations(["0001-rename-card-title", renameCardTitle]);
      hasSnapshot("0001-rename-card-title");
      snapshotModules["0001-rename-card-title"] = { card: cardBlock, snapshotFormat: 2 };
      server.resetHandlers();

      await apply();

      expect(space.writes).toEqual([]);
      expect(error.mock.calls.flat().join("\n")).toContain(
        "has snapshot format 2, but this version of the Storyblok CLI reads up to format 1. Update the Storyblok CLI.",
      );
      expect(process.exitCode).toBe(2);
    });

    it("should name the migration and its snapshot when the snapshot can't be loaded", async () => {
      const error = vi.spyOn(console, "error").mockImplementation(() => {});
      space.hasMigrations(["0001-rename-card-title", renameCardTitle]);
      hasSnapshot("0001-rename-card-title");
      snapshotModules["0001-rename-card-title"] = new Error(
        "Cannot find module './schema'\nRequire stack:\n- somewhere",
      );
      server.resetHandlers();

      await apply();

      const output = error.mock.calls.flat().join("\n");
      expect(output).toContain(
        "0001-rename-card-title: the schema snapshot .storyblok/migrations/12345/0001-rename-card-title.before.ts could not be loaded: Cannot find module './schema'",
      );
      expect(output).toContain("--no-validate");
      expect(output).not.toContain("Require stack");
      expect(process.exitCode).toBe(2);
    });

    it("should report a snapshot that can't be loaded together with the mismatches of other migrations", async () => {
      const error = vi.spyOn(console, "error").mockImplementation(() => {});
      space.hasMigrations(
        ["0001-rename-card-to-teaser", renameCardToTeaser],
        ["0002-rename-card-title", renameCardTitle],
      );
      hasSnapshot(
        "0001-rename-card-to-teaser",
        cardBlock,
        defineBlock({ name: "teaser", fields: [defineField("headline", { type: "text" })] }),
      );
      hasSnapshot("0002-rename-card-title");
      snapshotModules["0002-rename-card-title"] = new Error("ParseError: Unexpected token ");
      server.resetHandlers();

      await apply();

      const output = error.mock.calls.flat().join("\n");
      expect(output).toContain("0001-rename-card-to-teaser does not match the schema");
      expect(output).toContain("0002-rename-card-title: the schema snapshot");
      expect(process.exitCode).toBe(2);
    });

    it("should refuse --schema together with --no-validate", async () => {
      space.hasMigrations(["0001-rename-card-title", renameCardTitle]);
      server.resetHandlers();

      await apply("--schema", "src/schema.ts", "--no-validate");

      expect(space.writes).toEqual([]);
      expect(process.exitCode).toBe(2);
    });

    it("should skip the snapshot check with --no-validate", async () => {
      space.hasMigrations(["0001-rename-card-to-teaser", renameCardToTeaser]);
      hasSnapshot(
        "0001-rename-card-to-teaser",
        cardBlock,
        defineBlock({ name: "teaser", fields: [defineField("headline", { type: "text" })] }),
      );
      space.hasStories(storyWithCard());
      space.canUpdateStories();

      await apply("--no-validate");

      expect(space.writes).toHaveLength(1);
      expect(process.exitCode).toBeUndefined();
    });
  });

  describe("pending releases", () => {
    it("should refuse to run while a release is pending and name it", async () => {
      const error = vi.spyOn(console, "error").mockImplementation(() => {});
      space.hasMigrations(["0001-rename-card-title", renameCardTitle]);
      space.hasStories(storyWithCard());
      space.hasReleases(
        { id: 7, name: "Summer campaign", released: false },
        { id: 8, name: "Spring campaign", released: true },
      );
      space.canUpdateStories();

      await apply();

      expect(space.writes).toEqual([]);
      expect(process.exitCode).toBe(2);
      const output = error.mock.calls.flat().join("\n");
      expect(output).toContain("Summer campaign (7)");
      expect(output).not.toContain("Spring campaign");
    });

    it("should run with --allow-pending-releases and list the releases it misses", async () => {
      const warn = vi.spyOn(getUI(), "warn");
      space.hasMigrations(["0001-rename-card-title", renameCardTitle]);
      space.hasStories(storyWithCard());
      space.hasReleases({ id: 7, name: "Summer campaign", released: false });
      space.canUpdateStories();

      await apply("--allow-pending-releases");

      expect(space.writes).toHaveLength(1);
      expect(warn).toHaveBeenCalledWith(expect.stringContaining("Summer campaign (7)"));
    });

    it("should refuse to run when the releases can't be checked", async () => {
      space.hasMigrations(["0001-rename-card-title", renameCardTitle]);
      space.hasStories(storyWithCard());
      space.failsToListReleases();
      space.canUpdateStories();

      await apply();

      expect(space.writes).toEqual([]);
      expect(process.exitCode).toBe(1);
    });

    it("should warn and run with --allow-pending-releases when the releases can't be checked", async () => {
      const warn = vi.spyOn(getUI(), "warn");
      space.hasMigrations(["0001-rename-card-title", renameCardTitle]);
      space.hasStories(storyWithCard());
      space.failsToListReleases();
      space.canUpdateStories();

      await apply("--allow-pending-releases");

      expect(space.writes).toHaveLength(1);
      expect(warn).toHaveBeenCalledWith(
        expect.stringContaining("Could not check for pending releases"),
      );
    });

    it("should only warn on a dry run", async () => {
      const warn = vi.spyOn(getUI(), "warn");
      space.hasMigrations(["0001-rename-card-title", renameCardTitle]);
      space.hasStories(storyWithCard());
      space.hasReleases({ id: 7, name: "Summer campaign", released: false });

      await apply("--dry-run");

      expect(process.exitCode).toBeUndefined();
      expect(warn).toHaveBeenCalledWith(expect.stringContaining("Summer campaign (7)"));
    });
  });

  describe("publishing", () => {
    const publishedStory = (id: number, unpublishedChanges: boolean) =>
      storyWithCard({
        id,
        slug: `story-${id}`,
        full_slug: `story-${id}`,
        published: true,
        unpublished_changes: unpublishedChanges,
      });

    it("should write drafts only and warn how many published stories that affects", async () => {
      const warn = vi.spyOn(getUI(), "warn");
      space.hasMigrations(["0001-rename-card-title", renameCardTitle]);
      space.hasStories(publishedStory(1, false), publishedStory(2, true), storyWithCard({ id: 3 }));
      space.canUpdateStories();

      await apply();

      expect(space.writes.some((write) => write.publish)).toBe(false);
      expect(warn).toHaveBeenCalledWith(expect.stringContaining("2 published stories were"));
    });

    it("should publish only the stories the --publish mode selects", async () => {
      space.hasMigrations(["0001-rename-card-title", renameCardTitle]);
      space.hasStories(publishedStory(1, false), publishedStory(2, true), storyWithCard({ id: 3 }));
      space.canUpdateStories();

      const warn = vi.spyOn(getUI(), "warn");

      await apply("--publish", "published");

      expect(warn).toHaveBeenCalledWith(
        expect.stringContaining("--publish published doesn't select it"),
      );
      expect(space.writes.map(({ id, publish }) => ({ id, publish }))).toEqual([
        { id: 1, publish: true },
        { id: 2, publish: false },
        { id: 3, publish: false },
      ]);
    });

    it("should reject an unknown --publish mode", async () => {
      space.hasMigrations(["0001-rename-card-title", renameCardTitle]);
      space.hasStories(storyWithCard());

      await apply("--publish", "everything");

      expect(space.writes).toEqual([]);
      expect(process.exitCode).toBe(2);
    });
  });
});
