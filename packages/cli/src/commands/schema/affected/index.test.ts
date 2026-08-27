import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { vol } from "memfs";
import { join } from "pathe";

import "../index";
import { schemaCommand } from "../command";
import type { SchemaData } from "../types";
import type { Component } from "../../../types";
import { DEFAULT_SPACE, getID } from "../../__tests__/helpers";
import { getReporter, resetReporter } from "../../../lib/reporter/reporter";
import { getUI } from "../../../lib/ui";
import { directories } from "../../../constants";
import { resolveCommandPath } from "../../../utils/filesystem";

import { loadSchema } from "../load-schema";

// loadSchema uses jiti to dynamically import TypeScript entry files at runtime,
// which cannot be resolved in the test environment, so we mock it and provide
// the local schema directly.
vi.mock("../load-schema", () => ({
  loadSchema: vi.fn(),
}));

function makeComponent(name: string, schema: Record<string, Record<string, unknown>>): Component {
  return {
    id: getID(),
    name,
    created_at: "2024-01-01",
    updated_at: "2024-01-01",
    is_root: false,
    is_nestable: true,
    schema,
  } as unknown as Component;
}

interface StoryFixture {
  id: number;
  uuid: string;
  name: string;
  full_slug: string;
  content: Record<string, unknown>;
}

const server = setupServer();

let storiesListCalls = 0;

const preconditions = {
  hasLocalSchema(components: Component[]) {
    vi.mocked(loadSchema).mockResolvedValue({
      components,
      datasources: [],
      folders: [],
    } satisfies SchemaData);
  },
  hasRemote(components: Component[]) {
    server.use(
      http.get(`https://mapi.storyblok.com/v1/spaces/${DEFAULT_SPACE}/components`, () =>
        HttpResponse.json({ components }),
      ),
      http.get(`https://mapi.storyblok.com/v1/spaces/${DEFAULT_SPACE}/component_groups`, () =>
        HttpResponse.json({ component_groups: [] }),
      ),
      http.get(`https://mapi.storyblok.com/v1/spaces/${DEFAULT_SPACE}/datasources`, () =>
        HttpResponse.json({ datasources: [] }),
      ),
    );
  },
  hasStories(stories: StoryFixture[]) {
    server.use(
      http.get(`https://mapi.storyblok.com/v1/spaces/${DEFAULT_SPACE}/stories`, () => {
        storiesListCalls += 1;
        return HttpResponse.json(
          {
            stories: stories.map(({ id, uuid, name, full_slug }) => ({
              id,
              uuid,
              name,
              full_slug,
            })),
          },
          { headers: { Total: String(stories.length), "Per-Page": "100" } },
        );
      }),
      http.get(
        `https://mapi.storyblok.com/v1/spaces/${DEFAULT_SPACE}/stories/:id`,
        ({ params }) => {
          const story = stories.find((s) => String(s.id) === params.id);
          return HttpResponse.json({ story });
        },
      ),
    );
  },
  failsToListStories() {
    server.use(
      http.get(`https://mapi.storyblok.com/v1/spaces/${DEFAULT_SPACE}/stories`, () => {
        storiesListCalls += 1;
        return new HttpResponse(null, { status: 500 });
      }),
    );
  },
  failsToFetchStory(stories: StoryFixture[], unreadableId: number) {
    server.use(
      http.get(`https://mapi.storyblok.com/v1/spaces/${DEFAULT_SPACE}/stories`, () => {
        storiesListCalls += 1;
        return HttpResponse.json(
          {
            stories: stories.map(({ id, uuid, name, full_slug }) => ({
              id,
              uuid,
              name,
              full_slug,
            })),
          },
          { headers: { Total: String(stories.length), "Per-Page": "100" } },
        );
      }),
      http.get(
        `https://mapi.storyblok.com/v1/spaces/${DEFAULT_SPACE}/stories/:id`,
        ({ params }) => {
          if (String(unreadableId) === params.id) {
            return new HttpResponse(null, { status: 500 });
          }
          return HttpResponse.json({ story: stories.find((s) => String(s.id) === params.id) });
        },
      ),
    );
  },
  hasPaginatedStories(pages: StoryFixture[][]) {
    const all = pages.flat();
    server.use(
      http.get(`https://mapi.storyblok.com/v1/spaces/${DEFAULT_SPACE}/stories`, ({ request }) => {
        storiesListCalls += 1;
        const page = Number(new URL(request.url).searchParams.get("page") ?? 1);
        const stories = pages[page - 1] ?? [];
        return HttpResponse.json(
          {
            stories: stories.map(({ id, uuid, name, full_slug }) => ({
              id,
              uuid,
              name,
              full_slug,
            })),
          },
          { headers: { Total: String(all.length), "Per-Page": String(pages[0]?.length ?? 1) } },
        );
      }),
      http.get(`https://mapi.storyblok.com/v1/spaces/${DEFAULT_SPACE}/stories/:id`, ({ params }) =>
        HttpResponse.json({ story: all.find((s) => String(s.id) === params.id) }),
      ),
    );
  },
  hasPulledStories(directoryPath: string, stories: StoryFixture[]) {
    vol.fromJSON(
      Object.fromEntries(
        stories.map((story) => [
          join(directoryPath, `${story.full_slug}_${story.uuid}.json`),
          JSON.stringify(story),
        ]),
      ),
    );
  },
};

// The detailed impact report is attached to the standard report file via
// `reporter.addMeta('schemaAffected', ...)`, so enable the reporter and read it back.
function readOutputReport() {
  const entry = Object.entries(vol.toJSON()).find(([filename]) => filename.endsWith("report.json"));
  return entry ? JSON.parse(entry[1] as string).meta?.schemaAffected : undefined;
}

async function runAffected(extraArgs: string[] = []) {
  resetReporter();
  getReporter({ enabled: true, filePath: "report.json" });
  await schemaCommand.parseAsync([
    "node",
    "test",
    "affected",
    "schema.ts",
    "--space",
    DEFAULT_SPACE,
    ...extraArgs,
  ]);
}

describe("schema affected command", () => {
  beforeAll(() => server.listen({ onUnhandledRequest: "error" }));

  afterEach(() => {
    vi.resetAllMocks();
    vi.clearAllMocks();
    vol.reset();
    server.resetHandlers();
    resetReporter();
    storiesListCalls = 0;
    process.exitCode = undefined;
  });

  afterAll(() => server.close());

  it("should flag stories missing a newly required field as broken", async () => {
    preconditions.hasLocalSchema([
      makeComponent("hero", {
        title: { type: "text" },
        subtitle: { type: "text", required: true },
      }),
    ]);
    preconditions.hasRemote([makeComponent("hero", { title: { type: "text" } })]);
    preconditions.hasStories([
      {
        id: 100,
        uuid: "u-home",
        name: "Home",
        full_slug: "home",
        content: { _uid: "r", component: "hero", title: "Hi" },
      },
    ]);

    await runAffected();

    const report = readOutputReport();
    expect(report.totals).toMatchObject({ usedStories: 1, brokenStories: 1 });
    const hero = report.components.find((c: { component: string }) => c.component === "hero");
    expect(hero).toMatchObject({ usedStories: 1, brokenStories: 1 });
    expect(hero.fields.find((f: { field: string }) => f.field === "subtitle")).toMatchObject({
      kind: "required_added",
      broken: 1,
    });
  });

  it("should treat a removed field as affected but not broken", async () => {
    preconditions.hasLocalSchema([makeComponent("hero", { title: { type: "text" } })]);
    preconditions.hasRemote([
      makeComponent("hero", { title: { type: "text" }, subtitle: { type: "text" } }),
    ]);
    preconditions.hasStories([
      {
        id: 101,
        uuid: "u-a",
        name: "A",
        full_slug: "a",
        content: { _uid: "r", component: "hero", title: "Hi", subtitle: "orphan" },
      },
    ]);

    await runAffected();

    const report = readOutputReport();
    expect(report.totals).toMatchObject({ usedStories: 1, brokenStories: 0 });
    expect(
      report.stories[0].issues.some(
        (i: { code: string; severity: string }) =>
          i.code === "unknown_field" && i.severity === "warning",
      ),
    ).toBe(true);
  });

  it("should flag stories using a removed component as broken with --include-deleted", async () => {
    preconditions.hasLocalSchema([makeComponent("page", { body: { type: "bloks" } })]);
    preconditions.hasRemote([
      makeComponent("page", { body: { type: "bloks" } }),
      makeComponent("teaser", { headline: { type: "text" } }),
    ]);
    preconditions.hasStories([
      {
        id: 102,
        uuid: "u-b",
        name: "B",
        full_slug: "b",
        content: {
          _uid: "r",
          component: "page",
          body: [{ _uid: "x", component: "teaser", headline: "Hey" }],
        },
      },
    ]);

    await runAffected(["--include-deleted"]);

    const report = readOutputReport();
    const teaser = report.components.find((c: { component: string }) => c.component === "teaser");
    expect(teaser).toMatchObject({ action: "removed", brokenStories: 1 });
    expect(report.totals.brokenStories).toBe(1);
  });

  it("should not treat a removed component as affected without --include-deleted", async () => {
    preconditions.hasLocalSchema([makeComponent("page", { body: { type: "bloks" } })]);
    preconditions.hasRemote([
      makeComponent("page", { body: { type: "bloks" } }),
      makeComponent("teaser", { headline: { type: "text" } }),
    ]);
    preconditions.hasStories([]);

    await runAffected();

    expect(storiesListCalls).toBe(0);
    expect(readOutputReport()).toMatchObject({ components: [], totals: { usedStories: 0 } });
  });

  it("should union stories across multiple impacted components (MAPI contain_component is AND)", async () => {
    preconditions.hasLocalSchema([
      makeComponent("hero", { title: { type: "text", required: true } }),
      makeComponent("teaser", { headline: { type: "text", required: true } }),
    ]);
    preconditions.hasRemote([
      makeComponent("hero", { title: { type: "text" } }),
      makeComponent("teaser", { headline: { type: "text" } }),
    ]);

    // No single story uses both components, so a single AND-filtered request for
    // `hero,teaser` would return nothing. Only one request per component unions them.
    const stories: StoryFixture[] = [
      {
        id: 200,
        uuid: "u-h",
        name: "H",
        full_slug: "h",
        content: { _uid: "r", component: "hero" },
      },
      {
        id: 201,
        uuid: "u-t",
        name: "T",
        full_slug: "t",
        content: { _uid: "r", component: "teaser" },
      },
    ];
    const componentsOf = (content: unknown): Set<string> => {
      const found = new Set<string>();
      const walk = (value: unknown): void => {
        if (Array.isArray(value)) {
          value.forEach(walk);
          return;
        }
        if (value && typeof value === "object") {
          const component = (value as Record<string, unknown>).component;
          if (typeof component === "string") {
            found.add(component);
          }
          Object.values(value).forEach(walk);
        }
      };
      walk(content);
      return found;
    };
    server.use(
      http.get(`https://mapi.storyblok.com/v1/spaces/${DEFAULT_SPACE}/stories`, ({ request }) => {
        storiesListCalls += 1;
        const contain = new URL(request.url).searchParams.get("contain_component");
        const required = contain ? contain.split(",") : [];
        // Mirror MAPI: match stories whose component set is a superset of all requested names.
        const matched = stories.filter((story) =>
          required.every((name) => componentsOf(story.content).has(name)),
        );
        return HttpResponse.json(
          {
            stories: matched.map(({ id, uuid, name, full_slug }) => ({
              id,
              uuid,
              name,
              full_slug,
            })),
          },
          { headers: { Total: String(matched.length), "Per-Page": "100" } },
        );
      }),
      http.get(`https://mapi.storyblok.com/v1/spaces/${DEFAULT_SPACE}/stories/:id`, ({ params }) =>
        HttpResponse.json({ story: stories.find((story) => String(story.id) === params.id) }),
      ),
    );

    await runAffected();

    const report = readOutputReport();
    expect(report.totals).toMatchObject({ usedStories: 2, brokenStories: 2 });
    expect(report.components.map((c: { component: string }) => c.component).sort()).toEqual([
      "hero",
      "teaser",
    ]);
  });

  it("should include a story that uses an impacted component only as its root content type", async () => {
    preconditions.hasLocalSchema([
      makeComponent("page", {
        title: { type: "text" },
        subtitle: { type: "text", required: true },
      }),
    ]);
    preconditions.hasRemote([makeComponent("page", { title: { type: "text" } })]);
    // `contain_component` matches a component anywhere in the content, root
    // content type included, so a story with no nested bloks still matches.
    preconditions.hasStories([
      {
        id: 300,
        uuid: "u-p",
        name: "P",
        full_slug: "p",
        content: { _uid: "r", component: "page", title: "Hi" },
      },
    ]);

    await runAffected();

    const report = readOutputReport();
    expect(report.totals).toMatchObject({ usedStories: 1, brokenStories: 1 });
    expect(report.components.map((c: { component: string }) => c.component)).toEqual(["page"]);
  });

  it("should exit non-zero with --fail-on-break when a story would break", async () => {
    preconditions.hasLocalSchema([
      makeComponent("hero", {
        title: { type: "text" },
        subtitle: { type: "text", required: true },
      }),
    ]);
    preconditions.hasRemote([makeComponent("hero", { title: { type: "text" } })]);
    preconditions.hasStories([
      {
        id: 100,
        uuid: "u-home",
        name: "Home",
        full_slug: "home",
        content: { _uid: "r", component: "hero", title: "Hi" },
      },
    ]);

    await runAffected(["--fail-on-break"]);

    expect(process.exitCode).toBe(1);
  });

  it("should not set a non-zero exit code for breakage without --fail-on-break", async () => {
    preconditions.hasLocalSchema([
      makeComponent("hero", {
        title: { type: "text" },
        subtitle: { type: "text", required: true },
      }),
    ]);
    preconditions.hasRemote([makeComponent("hero", { title: { type: "text" } })]);
    preconditions.hasStories([
      {
        id: 100,
        uuid: "u-home",
        name: "Home",
        full_slug: "home",
        content: { _uid: "r", component: "hero", title: "Hi" },
      },
    ]);

    await runAffected();

    expect(process.exitCode).toBeUndefined();
  });

  it("should fail with actionable guidance when --local finds no pulled stories", async () => {
    const errorSpy = vi.spyOn(getUI(), "error").mockImplementation(() => {});
    preconditions.hasLocalSchema([makeComponent("hero", { title: { type: "text" } })]);
    preconditions.hasRemote([
      makeComponent("hero", { title: { type: "text" }, subtitle: { type: "text" } }),
    ]);

    await runAffected(["--local"]);

    expect(
      errorSpy.mock.calls.some(
        ([message]) => typeof message === "string" && message.includes("stories pull"),
      ),
    ).toBe(true);
    // The guard returns before any analysis, so no impact report is attached.
    expect(readOutputReport()).toBeUndefined();
    // A user-input mistake must not be a green run, so CI gating can trust it.
    expect(process.exitCode).toBe(2);
  });

  it("should fail when the entry file resolves to an empty schema", async () => {
    const errorSpy = vi.spyOn(getUI(), "error").mockImplementation(() => {});
    preconditions.hasLocalSchema([]);

    await runAffected();

    expect(
      errorSpy.mock.calls.some(
        ([message]) =>
          typeof message === "string" && message.includes("No components or datasources"),
      ),
    ).toBe(true);
    expect(process.exitCode).toBe(2);
    // A misconfigured entry-file must never diff nothing and report a false all-clear.
    expect(readOutputReport()).toBeUndefined();
  });

  it("should fail loudly instead of reporting a clean result when the story listing fails", async () => {
    const errorSpy = vi.spyOn(getUI(), "error").mockImplementation(() => {});
    preconditions.hasLocalSchema([
      makeComponent("hero", {
        title: { type: "text" },
        subtitle: { type: "text", required: true },
      }),
    ]);
    preconditions.hasRemote([makeComponent("hero", { title: { type: "text" } })]);
    preconditions.failsToListStories();

    await runAffected(["--fail-on-break"]);

    // A truncated listing under-reports impact, which reads as an all-clear on a
    // CI gate. It has to be an error, not a quiet zero.
    expect(process.exitCode).toBeGreaterThan(0);
    expect(
      errorSpy.mock.calls.some(
        ([message]) => typeof message === "string" && message.includes("Could not list"),
      ),
    ).toBe(true);
    expect(readOutputReport()).toBeUndefined();
  });

  it("should fail the --fail-on-break gate when a story cannot be read", async () => {
    preconditions.hasLocalSchema([
      makeComponent("hero", {
        title: { type: "text" },
        subtitle: { type: "text", required: true },
      }),
    ]);
    preconditions.hasRemote([makeComponent("hero", { title: { type: "text" } })]);
    preconditions.failsToFetchStory(
      [
        {
          id: 1,
          uuid: "u-1",
          name: "One",
          full_slug: "one",
          content: { _uid: "r", component: "hero", title: "Hi" },
        },
      ],
      1,
    );

    await runAffected(["--fail-on-break"]);

    // Zero broken stories were found, but only because none could be read.
    expect(readOutputReport().totals).toMatchObject({ brokenStories: 0 });
    expect(process.exitCode).toBe(1);
  });

  it("should analyze stories across every page of the listing", async () => {
    preconditions.hasLocalSchema([
      makeComponent("hero", {
        title: { type: "text" },
        subtitle: { type: "text", required: true },
      }),
    ]);
    preconditions.hasRemote([makeComponent("hero", { title: { type: "text" } })]);
    preconditions.hasPaginatedStories([
      [
        {
          id: 1,
          uuid: "u-1",
          name: "One",
          full_slug: "one",
          content: { _uid: "a", component: "hero", title: "Hi" },
        },
      ],
      [
        {
          id: 2,
          uuid: "u-2",
          name: "Two",
          full_slug: "two",
          content: { _uid: "b", component: "hero", title: "Ho" },
        },
      ],
    ]);

    await runAffected();

    expect(readOutputReport().totals).toMatchObject({ usedStories: 2, brokenStories: 2 });
  });

  it("should attribute an issue to the nested field that failed, not its parent", async () => {
    preconditions.hasLocalSchema([
      makeComponent("page", { body: { type: "bloks" } }),
      makeComponent("card", {
        body: { type: "text" },
        title: { type: "text", required: true },
      }),
    ]);
    preconditions.hasRemote([
      makeComponent("page", { body: { type: "bloks" } }),
      makeComponent("card", { body: { type: "text" }, title: { type: "text" } }),
    ]);
    preconditions.hasStories([
      {
        id: 400,
        uuid: "u-c",
        name: "C",
        full_slug: "c",
        content: {
          _uid: "r",
          component: "page",
          body: [{ _uid: "n", component: "card", body: "text" }],
        },
      },
    ]);

    await runAffected();

    const report = readOutputReport();
    const issue = report.stories[0].issues.find(
      (i: { component: string }) => i.component === "card",
    );
    expect(issue.field).toBe("title");
  });

  it("should analyze locally pulled stories with --local", async () => {
    preconditions.hasLocalSchema([
      makeComponent("hero", {
        title: { type: "text" },
        subtitle: { type: "text", required: true },
      }),
    ]);
    preconditions.hasRemote([makeComponent("hero", { title: { type: "text" } })]);
    preconditions.hasPulledStories(resolveCommandPath(directories.stories, DEFAULT_SPACE), [
      {
        id: 500,
        uuid: "u-l",
        name: "L",
        full_slug: "l",
        content: { _uid: "r", component: "hero", title: "Hi" },
      },
    ]);

    await runAffected(["--local"]);

    expect(storiesListCalls).toBe(0);
    expect(readOutputReport().totals).toMatchObject({ usedStories: 1, brokenStories: 1 });
  });

  it("should exit non-zero when the required --space is missing", async () => {
    vi.spyOn(getUI(), "error").mockImplementation(() => {});
    resetReporter();
    getReporter({ enabled: true, filePath: "report.json" });

    await schemaCommand.parseAsync(["node", "test", "affected", "schema.ts"]);

    expect(process.exitCode).toBe(2);
  });

  it("should not fetch stories when there are no content-affecting changes", async () => {
    const shared = { title: { type: "text" } };
    preconditions.hasLocalSchema([makeComponent("hero", shared)]);
    preconditions.hasRemote([makeComponent("hero", shared)]);
    preconditions.hasStories([]);

    await runAffected();

    expect(storiesListCalls).toBe(0);
    expect(readOutputReport()).toMatchObject({ components: [], totals: { usedStories: 0 } });
  });
});
