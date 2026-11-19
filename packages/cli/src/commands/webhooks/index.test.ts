import { Readable } from "node:stream";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { vol } from "memfs";
import { confirm } from "@inquirer/prompts";
import { session } from "../../session";
import { loggedOutSessionState } from "../../../test/setup";
import { getStdinTarget } from "../../lib/ui/stream-target";
import { resetLogger } from "../../lib/logger/logger";
import { resetReporter } from "../../lib/reporter/reporter";
import { getLogFileContents, getReport } from "../__tests__/helpers";
import { getProgram } from "../../program";
import "../languages";
import { webhookFields } from "../../generated/mapi/resource-fields.gen";
import { webhooksCommand } from ".";

vi.mock("@inquirer/prompts", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@inquirer/prompts")>()),
  confirm: vi.fn(),
}));

// Whether stdin carries data is an `fstat` on fd 0, which the test runner's own
// stdin decides. Pinned per test.
vi.mock("../../lib/ui/stream-target", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../lib/ui/stream-target")>()),
  getStdinTarget: vi.fn(() => "terminal"),
}));

const SPACE = "12345";
const BASE = `https://mapi.storyblok.com/v1/spaces/${SPACE}/webhook_endpoints`;
const SECRET = "whsec-top-secret-value";
const ALLOWED_ACTIONS = ["story.published", "story.unpublished", "asset.created"];

interface FakeWebhook {
  id: number;
  name: string;
  description: string | null;
  endpoint: string;
  space_id: number;
  secret: string | null;
  actions: string[];
  activated: boolean;
  deleted_at: null;
  created_at: string;
  updated_at: string;
}

interface WebhookBody {
  webhook_endpoint: Record<string, unknown>;
}

interface Write {
  method: "POST" | "PATCH" | "DELETE";
  id?: number;
  body?: Record<string, unknown>;
}

/** A space's webhooks behind the Management API, enforcing what the API enforces. */
const api = {
  webhooks: [] as FakeWebhook[],
  writes: [] as Write[],
  nextId: 100,
  clock: 0,
};

function timestamp(): string {
  api.clock += 1;
  return new Date(Date.UTC(2026, 0, 1, 0, 0, api.clock)).toISOString();
}

function makeWebhook(overrides: Partial<FakeWebhook> = {}): FakeWebhook {
  const at = timestamp();
  const id = overrides.id ?? api.nextId++;
  return {
    id,
    name: `hook-${id}`,
    description: null,
    endpoint: `https://example.com/${id}`,
    space_id: Number(SPACE),
    secret: SECRET,
    actions: ["story.published"],
    activated: true,
    deleted_at: null,
    created_at: at,
    updated_at: at,
    ...overrides,
  };
}

const nameTaken = (name: unknown, exceptId?: number) =>
  api.webhooks.some((webhook) => webhook.name === name && webhook.id !== exceptId);

const invalidActions = (actions: unknown) =>
  Array.isArray(actions) && actions.some((action) => !ALLOWED_ACTIONS.includes(action));

const server = setupServer(
  http.get(BASE, () => HttpResponse.json({ webhook_endpoints: api.webhooks })),
  http.get(`${BASE}/allowed_actions`, () =>
    HttpResponse.json({ allowed_actions: ALLOWED_ACTIONS.map((action) => ({ action })) }),
  ),
  http.get(`${BASE}/:id`, ({ params }) => {
    const webhook = api.webhooks.find((candidate) => candidate.id === Number(params.id));
    return webhook
      ? HttpResponse.json({ webhook_endpoint: webhook })
      : HttpResponse.json({ error: "Not found" }, { status: 404 });
  }),
  http.post<never, WebhookBody>(BASE, async ({ request }) => {
    const { webhook_endpoint: body } = await request.json();
    api.writes.push({ method: "POST", body });
    if (nameTaken(body.name)) {
      return HttpResponse.json({ name: ["has already been taken"] }, { status: 422 });
    }
    if (invalidActions(body.actions)) {
      // What the API answers for an action it does not know.
      return HttpResponse.json({ actions: ["not allowed"] }, { status: 422 });
    }
    const webhook = makeWebhook({ ...body, activated: body.activated !== false });
    api.webhooks.push(webhook);
    return HttpResponse.json({ webhook_endpoint: webhook }, { status: 201 });
  }),
  http.patch<{ id: string }, WebhookBody>(`${BASE}/:id`, async ({ params, request }) => {
    const id = Number(params.id);
    const { webhook_endpoint: body } = await request.json();
    api.writes.push({ method: "PATCH", id, body });
    const webhook = api.webhooks.find((candidate) => candidate.id === id);
    if (!webhook) {
      return HttpResponse.json({ error: "Not found" }, { status: 404 });
    }
    if (body.name !== undefined && nameTaken(body.name, id)) {
      return HttpResponse.json({ name: ["has already been taken"] }, { status: 422 });
    }
    if (body.endpoint === "https://fails.example.com") {
      return HttpResponse.json({ endpoint: ["is invalid"] }, { status: 422 });
    }
    Object.assign(webhook, body, { updated_at: timestamp() });
    if (webhook.activated === null) {
      webhook.activated = false;
    }
    return HttpResponse.json({ webhook_endpoint: webhook });
  }),
  http.delete(`${BASE}/:id`, ({ params }) => {
    const id = Number(params.id);
    api.writes.push({ method: "DELETE", id });
    const webhook = api.webhooks.find((candidate) => candidate.id === id);
    if (!webhook) {
      return HttpResponse.json({ error: "Not found" }, { status: 404 });
    }
    api.webhooks = api.webhooks.filter((candidate) => candidate !== webhook);
    return HttpResponse.json({ webhook_endpoint: webhook });
  }),
);

/** Undoes what a precondition changed outside of the mocks, after each test. */
const cleanups: (() => void)[] = [];

function setTTY(stream: NodeJS.ReadStream | NodeJS.WriteStream, value: boolean) {
  const original = Object.getOwnPropertyDescriptor(stream, "isTTY");
  Object.defineProperty(stream, "isTTY", { value, configurable: true });
  cleanups.push(() => {
    if (original) {
      Object.defineProperty(stream, "isTTY", original);
    } else {
      delete (stream as { isTTY?: boolean }).isTTY;
    }
  });
}

const preconditions = {
  hasWebhooks(...overrides: Partial<FakeWebhook>[]) {
    const webhooks = overrides.map((override) => makeWebhook(override));
    api.webhooks.push(...webhooks);
    return webhooks;
  },
  /** stdout is a terminal that no pager runs on, so tables are printed directly. */
  stdoutIsATerminal() {
    vi.stubEnv("TERM", "dumb");
    setTTY(process.stdout, true);
  },
  stderrIsATerminal() {
    setTTY(process.stderr, true);
  },
  stdinIsATerminal() {
    setTTY(process.stdin, true);
  },
  /** stdin is a pipe carrying `text`, as in `… | storyblok webhooks …`. */
  stdinCarries(text: string) {
    vi.mocked(getStdinTarget).mockReturnValue("pipe");
    const stdin = Readable.from([text]);
    const read = vi.spyOn(stdin, "read");
    const original = Object.getOwnPropertyDescriptor(process, "stdin");
    Object.defineProperty(process, "stdin", { value: stdin, configurable: true });
    cleanups.push(() => {
      if (original) {
        Object.defineProperty(process, "stdin", original);
      }
    });
    return read;
  },
  loggedOut() {
    vi.mocked(session().initializeSession).mockImplementation(async () => {
      session().state = loggedOutSessionState();
    });
  },
};

const stdoutWrites: string[] = [];

function stdoutLines(): Record<string, unknown>[] {
  return stdoutWrites
    .join("")
    .split("\n")
    .filter((line) => line.trim() !== "")
    .map((line) => JSON.parse(line));
}

function stdoutText(): string {
  return stdoutWrites.join("");
}

function stderrText(): string {
  return vi
    .mocked(console.error)
    .mock.calls.map((args) => args.map(String).join(" "))
    .join("\n");
}

/** The JSON error lines on stderr. */
function stderrErrors(): Record<string, unknown>[] {
  return stderrText()
    .split("\n")
    .filter((line) => line.startsWith("{"))
    .map((line) => JSON.parse(line));
}

function run(...args: string[]) {
  return webhooksCommand.parseAsync(["node", "test", ...args]);
}

const asListOutput = (webhooks: FakeWebhook[]) =>
  webhooks.map(({ secret: _secret, ...line }) => JSON.stringify(line)).join("\n");

describe("webhooks command", () => {
  beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
  beforeEach(() => {
    // Each run gets its own log and report file, as each CLI invocation does.
    resetLogger();
    resetReporter();
    api.webhooks = [];
    api.writes = [];
    stdoutWrites.length = 0;
    process.exitCode = undefined;
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(process.stdout, "write").mockImplementation((chunk: unknown) => {
      stdoutWrites.push(String(chunk));
      return true;
    });
  });
  afterEach(() => {
    for (const cleanup of cleanups.splice(0)) {
      cleanup();
    }
    vi.restoreAllMocks();
    vi.mocked(getStdinTarget).mockReturnValue("terminal");
    vi.mocked(confirm).mockReset();
    // Back to the logged-in session the test setup provides.
    vi.mocked(session().initializeSession).mockReset();
    vi.unstubAllEnvs();
    vol.reset();
    server.resetHandlers();
    process.exitCode = undefined;
  });
  afterAll(() => server.close());

  describe("list", () => {
    it("should print one webhook per line, without its secret", async () => {
      const webhooks = preconditions.hasWebhooks({}, {});

      await run("list", "--space", SPACE);

      expect(stdoutLines().map((line) => line.id)).toEqual(webhooks.map(({ id }) => id));
      expect(stdoutLines()[0]).not.toHaveProperty("secret");
      expect(stdoutText()).not.toContain(SECRET);
    });

    it("should print a table when stdout is a terminal", async () => {
      preconditions.hasWebhooks({ name: "deploy-preview" });
      preconditions.stdoutIsATerminal();

      await run("list", "--space", SPACE);

      expect(stdoutText()).toContain("deploy-preview");
      expect(stdoutText()).toContain("https://example.com/");
      expect(stdoutText()).not.toContain(SECRET);
    });
  });

  describe("get", () => {
    it("should print the webhook a name or an id targets", async () => {
      const [, target] = preconditions.hasWebhooks({}, { name: "deploy" });

      await run("get", "deploy", "--space", SPACE);
      await run("get", String(target.id), "--space", SPACE);

      expect(stdoutLines().map((line) => line.id)).toEqual([target.id, target.id]);
      expect(stdoutText()).not.toContain(SECRET);
    });

    it("should print fields and values when stdout is a terminal", async () => {
      preconditions.hasWebhooks({ name: "deploy", endpoint: "https://example.com/deploy" });
      preconditions.stdoutIsATerminal();

      await run("get", "deploy", "--space", SPACE);

      expect(stdoutText()).toMatch(/endpoint\s+https:\/\/example\.com\/deploy/);
      expect(stdoutText()).not.toContain(SECRET);
    });

    it("should fail on a name several webhooks share, listing their ids", async () => {
      const twins = preconditions.hasWebhooks({ name: "twin" }, { name: "twin" });

      await run("get", "twin", "--space", SPACE);

      expect(process.exitCode).toBe(1);
      expect(stderrErrors()[0].error).toContain(twins.map(({ id }) => id).join(", "));
      expect(stdoutWrites).toEqual([]);
    });

    it("should fail on a webhook the space does not have", async () => {
      await run("get", "missing", "--space", SPACE);

      expect(process.exitCode).toBe(1);
      expect(stderrErrors()[0].error).toBe("No webhook matches the given ID or name.");
    });
  });

  describe("create", () => {
    it("should create a webhook from --set and print its result line", async () => {
      await run(
        "create",
        "--space",
        SPACE,
        "--set",
        "name=deploy",
        "--set",
        "endpoint=https://example.com/deploy",
        "--set",
        "actions=story.published,story.unpublished",
        "--set",
        `secret=${SECRET}`,
      );

      expect(api.writes).toEqual([
        {
          method: "POST",
          body: {
            name: "deploy",
            endpoint: "https://example.com/deploy",
            actions: ["story.published", "story.unpublished"],
            secret: SECRET,
          },
        },
      ]);
      expect(stdoutLines()).toEqual([{ id: api.webhooks[0].id, name: "deploy", action: "create" }]);
      expect(process.exitCode).toBeFalsy();
    });

    it("should skip a webhook that exists with --if-not-exists", async () => {
      const [existing] = preconditions.hasWebhooks({ name: "deploy" });

      await run(
        "create",
        "--space",
        SPACE,
        "--if-not-exists",
        "--set",
        "name=deploy",
        "--set",
        "endpoint=https://example.com/other",
        "--set",
        "actions=story.published",
      );

      expect(api.writes).toEqual([]);
      expect(stdoutLines()).toEqual([
        { id: existing.id, name: "deploy", action: "skip", _skipped: true, _reason: "exists" },
      ]);
      expect(process.exitCode).toBeFalsy();
    });

    it("should pass a taken name through as an API error without --if-not-exists", async () => {
      preconditions.hasWebhooks({ name: "deploy" });

      await run(
        "create",
        "--space",
        SPACE,
        "--set",
        "name=deploy",
        "--set",
        "endpoint=https://example.com/x",
        "--set",
        "actions=story.published",
      );

      expect(process.exitCode).toBe(1);
      expect(stderrErrors()[0]).toMatchObject({
        status: 422,
        details: { name: ["has already been taken"] },
      });
    });

    it("should copy piped webhooks without their read-only fields", async () => {
      const source = [makeWebhook({ name: "a" }), makeWebhook({ name: "b" })];
      preconditions.stdinCarries(asListOutput(source));

      await run("create", "--space", SPACE, "-");

      expect(api.writes.map((write) => write.body)).toEqual(
        source.map(({ name, description, endpoint, actions, activated }) => ({
          name,
          description,
          endpoint,
          actions,
          activated,
        })),
      );
      expect(stdoutLines().map((line) => line.action)).toEqual(["create", "create"]);
    });

    it("should apply --set to every piped webhook", async () => {
      preconditions.stdinCarries(asListOutput([makeWebhook({ name: "a" })]));

      await run("create", "--space", SPACE, "--set", "activated=false", "-");

      expect(api.writes[0].body).toMatchObject({ name: "a", activated: false });
    });

    it("should not read stdin without -, even when it is piped", async () => {
      const read = preconditions.stdinCarries(asListOutput([makeWebhook({ name: "piped" })]));

      await run(
        "create",
        "--space",
        SPACE,
        "--set",
        "name=flag",
        "--set",
        "endpoint=https://example.com/flag",
        "--set",
        "actions=story.published",
      );

      expect(read).not.toHaveBeenCalled();
      expect(api.writes.map((write) => write.body?.name)).toEqual(["flag"]);
    });

    it("should ask for - when piped data comes without it", async () => {
      preconditions.stdinCarries(asListOutput([makeWebhook()]));

      await run("create", "--space", SPACE);

      expect(process.exitCode).toBe(2);
      expect(stderrErrors()[0].error).toContain("`-` to read webhooks from stdin");
      expect(api.writes).toEqual([]);
    });

    it("should name the required fields a create lacks, without a request", async () => {
      await run("create", "--space", SPACE, "--set", "name=x");

      expect(api.writes).toEqual([]);
      expect(process.exitCode).toBe(1);
      expect(stderrErrors()[0].error).toBe("Missing required fields: endpoint, actions.");
    });

    it("should add the allowed actions to an invalid action error", async () => {
      await run(
        "create",
        "--space",
        SPACE,
        "--set",
        "name=x",
        "--set",
        "endpoint=https://example.com/x",
        "--set",
        "actions=story.typo",
      );

      expect(stderrErrors()[0].details).toMatchObject({
        actions: ["not allowed"],
        allowed_values: { actions: ALLOWED_ACTIONS },
      });
    });

    it("should keep the API error when the allowed actions cannot be read", async () => {
      server.use(http.get(`${BASE}/allowed_actions`, () => HttpResponse.json({}, { status: 403 })));
      preconditions.stdinCarries(
        [
          JSON.stringify({ name: "a", endpoint: "https://example.com/a", actions: ["story.typo"] }),
          JSON.stringify({
            name: "b",
            endpoint: "https://example.com/b",
            actions: ["story.published"],
          }),
        ].join("\n"),
      );

      await run("create", "--space", SPACE, "-");

      expect(stderrErrors()).toEqual([
        expect.objectContaining({ line: 1, status: 422, details: { actions: ["not allowed"] } }),
      ]);
      expect(stdoutLines().map((line) => line.name)).toEqual(["b"]);
    });

    it("should skip a repeated name with the id of the webhook just created", async () => {
      const webhook = {
        name: "a",
        endpoint: "https://example.com/a",
        actions: ["story.published"],
      };
      preconditions.stdinCarries([webhook, webhook].map((line) => JSON.stringify(line)).join("\n"));

      await run("create", "--space", SPACE, "--if-not-exists", "-");

      const [created, skipped] = stdoutLines();
      expect(skipped).toMatchObject({ action: "skip", _reason: "exists", id: created.id });
      expect(created.id).toEqual(expect.any(Number));
    });

    it("should validate a dry run without writing, printing the would-be result", async () => {
      preconditions.hasWebhooks({ name: "taken" });
      preconditions.stdinCarries(
        [
          JSON.stringify({
            name: "fine",
            endpoint: "https://example.com/1",
            actions: ["story.published"],
          }),
          JSON.stringify({
            name: "taken",
            endpoint: "https://example.com/2",
            actions: ["story.published"],
          }),
          JSON.stringify({
            name: "typo",
            endpoint: "https://example.com/3",
            actions: ["story.typo"],
          }),
          JSON.stringify({ name: "incomplete" }),
        ].join("\n"),
      );

      await run("create", "--space", SPACE, "--dry-run", "-");

      expect(api.writes).toEqual([]);
      expect(stdoutLines()).toEqual([
        expect.objectContaining({ id: null, name: "fine", action: "create", _dry_run: true }),
      ]);
      expect(stderrErrors().map((error) => error.line)).toEqual([2, 3, 4]);
      expect(stderrErrors()[2].error).toMatch(/endpoint, actions/);
      // A dry run reports what a real run would get from the API.
      expect(stderrErrors()[1].details).toMatchObject({ actions: ["not allowed"] });
      expect(process.exitCode).toBe(1);
    });
  });

  describe("update", () => {
    it("should send only the fields that change", async () => {
      const [webhook] = preconditions.hasWebhooks({ name: "deploy", activated: true });

      await run(
        "update",
        "deploy",
        "--space",
        SPACE,
        "--set",
        "activated=false",
        "--set",
        "name=deploy",
      );

      expect(api.writes).toEqual([{ method: "PATCH", id: webhook.id, body: { activated: false } }]);
      expect(stdoutLines()).toEqual([{ id: webhook.id, name: "deploy", action: "update" }]);
    });

    it("should skip a webhook nothing would change on", async () => {
      const [webhook] = preconditions.hasWebhooks({ name: "deploy" });

      await run("update", String(webhook.id), "--space", SPACE, "--set", `secret=${SECRET}`);

      expect(api.writes).toEqual([]);
      expect(stdoutLines()).toEqual([
        { id: webhook.id, name: "deploy", action: "skip", _skipped: true, _reason: "unchanged" },
      ]);
    });

    it("should clear a field with --unset", async () => {
      const [webhook] = preconditions.hasWebhooks({ description: "old" });

      await run("update", String(webhook.id), "--space", SPACE, "--unset", "description");

      expect(api.writes[0].body).toEqual({ description: null });
    });

    it("should refuse to --unset a field the API cannot clear", async () => {
      const [webhook] = preconditions.hasWebhooks({});

      await run("update", String(webhook.id), "--space", SPACE, "--unset", "endpoint");

      expect(process.exitCode).toBe(2);
      expect(api.writes).toEqual([]);
    });

    it("should write edited lines piped from list", async () => {
      const webhooks = preconditions.hasWebhooks({ name: "a" }, { name: "b" });
      const edited = webhooks.map((webhook) => ({ ...webhook, activated: false }));
      preconditions.stdinCarries(asListOutput(edited));

      await run("update", "--space", SPACE, "-");

      expect(api.writes).toEqual(
        webhooks.map(({ id }) => ({ method: "PATCH", id, body: { activated: false } })),
      );
    });

    it("should print names intact when another webhook's secret is a short word", async () => {
      preconditions.hasWebhooks({ secret: "test" }, { name: "test-hook", secret: null });

      await run("update", "test-hook", "--space", SPACE, "--set", "activated=false");

      expect(stdoutLines()).toEqual([expect.objectContaining({ name: "test-hook" })]);
    });

    it("should refuse a line read before the webhook last changed, until --ignore-stale", async () => {
      const [webhook] = preconditions.hasWebhooks({ name: "deploy" });
      const stale = { ...webhook, updated_at: "2020-01-01T00:00:00.000Z", activated: false };
      preconditions.stdinCarries(asListOutput([stale]));

      await run("update", "--space", SPACE, "-");

      expect(api.writes).toEqual([]);
      expect(process.exitCode).toBe(1);
      expect(stderrErrors()[0]).toMatchObject({ id: webhook.id, line: 1 });
      expect(stderrErrors()[0].error).toContain("--ignore-stale");

      process.exitCode = undefined;
      preconditions.stdinCarries(asListOutput([stale]));
      await run("update", "--space", SPACE, "--ignore-stale", "-");

      expect(api.writes).toEqual([{ method: "PATCH", id: webhook.id, body: { activated: false } }]);
    });

    it("should keep writing past a failing record and exit 1", async () => {
      const webhooks = preconditions.hasWebhooks({ name: "a" }, { name: "b" }, { name: "c" });
      const edited = webhooks.map((webhook, index) => ({
        ...webhook,
        endpoint: index === 1 ? "https://fails.example.com" : "https://example.com/new",
      }));
      preconditions.stdinCarries(asListOutput(edited));

      await run("update", "--space", SPACE, "-");

      expect(stdoutLines().map((line) => line.id)).toEqual([webhooks[0].id, webhooks[2].id]);
      expect(stderrErrors()).toEqual([
        expect.objectContaining({ line: 2, id: webhooks[1].id, status: 422 }),
      ]);
      expect(process.exitCode).toBe(1);
    });

    it("should skip a piped webhook the space no longer has", async () => {
      preconditions.stdinCarries(asListOutput([makeWebhook({ name: "gone" })]));

      await run("update", "--space", SPACE, "--set", "activated=false", "-");

      expect(stdoutLines()).toEqual([
        expect.objectContaining({ action: "skip", _skipped: true, _reason: "not_found" }),
      ]);
      expect(process.exitCode).toBeFalsy();
    });

    it("should show a dry run's changes without the secret's value", async () => {
      const [webhook] = preconditions.hasWebhooks({ name: "deploy", activated: true });

      await run(
        "update",
        "deploy",
        "--space",
        SPACE,
        "--dry-run",
        "--set",
        "activated=false",
        "--set",
        "secret=a-new-secret-value",
      );

      expect(api.writes).toEqual([]);
      expect(stdoutLines()).toEqual([
        {
          id: webhook.id,
          name: "deploy",
          action: "update",
          _dry_run: true,
          _diff: { activated: { from: true, to: false }, secret: "[changed]" },
        },
      ]);
      expect(stdoutText() + stderrText()).not.toContain("a-new-secret-value");
      expect(stdoutText() + stderrText()).not.toContain(SECRET);
    });

    it("should ask for - when piped data comes without a target", async () => {
      preconditions.stdinCarries(asListOutput([makeWebhook()]));

      await run("update", "--space", SPACE, "--set", "activated=false");

      expect(process.exitCode).toBe(2);
      expect(stderrErrors()[0].error).toContain("`-` to read webhooks from stdin");
    });
  });

  describe("delete", () => {
    it("should delete after the person at the terminal confirms", async () => {
      const [webhook] = preconditions.hasWebhooks({ name: "deploy" });
      preconditions.stdinIsATerminal();
      preconditions.stderrIsATerminal();
      vi.mocked(confirm).mockResolvedValue(true);

      await run("delete", "deploy", "--space", SPACE);

      expect(confirm).toHaveBeenCalled();
      expect(api.writes).toEqual([{ method: "DELETE", id: webhook.id }]);
      expect(api.webhooks).toEqual([]);
    });

    it("should end quietly when the person cancels the prompt", async () => {
      preconditions.hasWebhooks({ name: "deploy" });
      preconditions.stdinIsATerminal();
      preconditions.stderrIsATerminal();
      vi.mocked(confirm).mockRejectedValue(
        Object.assign(new Error("User force closed the prompt"), { name: "ExitPromptError" }),
      );

      await run("delete", "deploy", "--space", SPACE);

      expect(process.exitCode).toBeFalsy();
      expect(stderrText()).not.toContain("force closed");
      expect(api.writes).toEqual([]);
    });

    it("should require --yes when nobody is at a terminal to confirm", async () => {
      preconditions.hasWebhooks({ name: "deploy" });

      await run("delete", "deploy", "--space", SPACE);

      expect(process.exitCode).toBe(2);
      expect(stderrErrors()[0].error).toContain("--yes");
      expect(api.writes).toEqual([]);
    });

    it("should delete every webhook piped from list with --yes", async () => {
      const webhooks = preconditions.hasWebhooks({}, {});
      preconditions.stdinCarries(asListOutput(webhooks));

      await run("delete", "--space", SPACE, "--yes", "-");

      expect(api.webhooks).toEqual([]);
      expect(stdoutLines().map((line) => line.action)).toEqual(["delete", "delete"]);
    });

    it("should require --yes with -, since stdin cannot answer a prompt", async () => {
      const webhooks = preconditions.hasWebhooks({});
      preconditions.stdinCarries(asListOutput(webhooks));
      preconditions.stderrIsATerminal();

      await run("delete", "--space", SPACE, "-");

      expect(process.exitCode).toBe(2);
      expect(confirm).not.toHaveBeenCalled();
      expect(api.writes).toEqual([]);
    });

    it("should neither prompt nor write on a dry run", async () => {
      const webhooks = preconditions.hasWebhooks({}, {});
      preconditions.stdinCarries(asListOutput([...webhooks, makeWebhook({ name: "gone" })]));
      preconditions.stderrIsATerminal();

      await run("delete", "--space", SPACE, "--dry-run", "-");

      expect(confirm).not.toHaveBeenCalled();
      expect(api.writes).toEqual([]);
      expect(stdoutLines()).toHaveLength(3);
      expect(stdoutLines().every((line) => line._dry_run === true)).toBe(true);
      expect(stderrText()).toContain("Would delete 2 webhooks (dry run)");
    });
  });

  describe("errors", () => {
    it("should report a usage error as JSON when stderr is not a terminal", async () => {
      await run("list", "--space", SPACE, "--bogus").catch(() => {});

      expect(process.exitCode).toBe(2);
      expect(stderrErrors()).toEqual([{ error: expect.stringContaining("--bogus") }]);
    });

    it("should leave the error output of other commands as it is", async () => {
      await getProgram()
        .parseAsync(["node", "test", "languages", "pull", "--bogus"])
        .catch(() => {});

      expect(stderrErrors()).toEqual([]);
      expect(stderrText()).toContain("unknown option '--bogus'");
    });

    it("should not echo the value of an unknown option", async () => {
      await run("create", "--space", SPACE, "--secret=hunter2").catch(() => {});

      expect(stderrErrors()).toEqual([{ error: expect.stringContaining("--secret") }]);
      expect(stderrText()).not.toContain("hunter2");
    });

    it("should report a missing login as JSON and exit 2", async () => {
      preconditions.loggedOut();

      await run("list", "--space", SPACE);

      expect(process.exitCode).toBe(2);
      expect(stderrErrors()[0].error).toContain("storyblok login");
    });

    it("should report errors as text when stderr is a terminal", async () => {
      preconditions.stderrIsATerminal();

      await run("get", "missing", "--space", SPACE);

      expect(stderrErrors()).toEqual([]);
      expect(stderrText()).toContain("No webhook matches the given ID or name.");
    });

    it("should fail a malformed record before writing anything", async () => {
      preconditions.stdinCarries(
        '{"name":"a","endpoint":"https://example.com","actions":[]}\n{oops',
      );

      await run("create", "--space", SPACE, "-");

      expect(api.writes).toEqual([]);
      expect(stderrErrors()[0].error).toContain("record 2");
    });

    it("should keep secrets out of the log and report files", async () => {
      const [webhook] = preconditions.hasWebhooks({ name: "deploy" });

      await run(
        "update",
        String(webhook.id),
        "--space",
        SPACE,
        "--set",
        "secret=flag-secret-value",
        "--data",
        '{"secret":"data-secret-value","description":"d"}',
      );

      const files = [
        getLogFileContents("storyblok-webhooks-update-", { space: SPACE }),
        JSON.stringify(getReport("storyblok-webhooks-update-", SPACE)),
      ];
      expect(files[0]).toBeTruthy();
      expect(files[1]).toContain("description");
      for (const file of files) {
        expect(file).not.toContain("flag-secret-value");
        expect(file).not.toContain("data-secret-value");
        expect(file).not.toContain(SECRET);
      }
    });

    it("should keep the secret out of an API error about it", async () => {
      const [webhook] = preconditions.hasWebhooks({ name: "deploy" });
      server.use(
        http.patch(`${BASE}/:id`, () =>
          HttpResponse.json(
            { secret: [`flag-secret-value is not allowed on this plan`] },
            { status: 422 },
          ),
        ),
      );

      await run(
        "update",
        String(webhook.id),
        "--space",
        SPACE,
        "--set",
        "secret=flag-secret-value",
      );

      expect(stderrErrors()[0].details).toEqual({
        secret: ["[redacted] is not allowed on this plan"],
      });
      expect(stderrText()).not.toContain("flag-secret-value");
    });
  });

  describe("secrets in mistakes", () => {
    const LEAKED = "mistyped-secret-value";

    function filesAndStreams(): string {
      return [
        stdoutText(),
        stderrText(),
        ...Object.values(vol.toJSON()).map((content) => String(content)),
      ].join("\n");
    }

    it("should keep a value out of the log and report files when its field name is mistyped", async () => {
      const [webhook] = preconditions.hasWebhooks({ name: "deploy" });

      await run(
        "update",
        String(webhook.id),
        "--space",
        SPACE,
        "--set",
        `Secret=${LEAKED}`,
        "--data",
        `{"secrets":"${LEAKED}"}`,
      );

      expect(process.exitCode).toBe(2);
      expect(filesAndStreams()).not.toContain(LEAKED);
    });

    it("should not echo a value passed without = as an argument", async () => {
      preconditions.hasWebhooks({ name: "deploy" });

      await run("create", "--space", SPACE, "--set", "secret", LEAKED);
      await run("update", "--space", SPACE, "--set", "secret", LEAKED);

      expect(filesAndStreams()).not.toContain(LEAKED);
    });

    it("should not echo an unknown option's value that contains a quote", async () => {
      await run("create", "--space", SPACE, `--secret=it's-${LEAKED}`).catch(() => {});

      expect(stderrText()).not.toContain(LEAKED);
    });
  });

  describe("payload rules", () => {
    it("should send every writable field of the generated field list", async () => {
      const [webhook] = preconditions.hasWebhooks({ name: "deploy" });
      const sets = {
        name: "renamed",
        description: "d",
        endpoint: "https://example.com/new",
        secret: "a-new-secret-value",
        activated: "false",
        actions: "story.unpublished",
      };

      await run(
        "update",
        String(webhook.id),
        "--space",
        SPACE,
        ...Object.entries(sets).flatMap(([field, value]) => ["--set", `${field}=${value}`]),
      );

      expect(Object.keys(api.writes[0].body ?? {}).sort()).toEqual(
        Object.keys(webhookFields.writable).sort(),
      );
    });

    it("should refuse a field set twice or set and cleared", async () => {
      const [webhook] = preconditions.hasWebhooks({});

      await run(
        "update",
        String(webhook.id),
        "--space",
        SPACE,
        "--set",
        "actions=story.published",
        "--set",
        "actions=story.unpublished",
      );
      expect(process.exitCode).toBe(2);

      process.exitCode = undefined;
      await run(
        "update",
        String(webhook.id),
        "--space",
        SPACE,
        "--set",
        "description=x",
        "--unset",
        "description",
      );
      expect(process.exitCode).toBe(2);
      expect(api.writes).toEqual([]);
    });

    it("should apply two piped lines for the same webhook in order", async () => {
      const [webhook] = preconditions.hasWebhooks({ activated: true });
      const line = ({ activated }: { activated: boolean }) =>
        JSON.stringify({ id: webhook.id, activated });
      preconditions.stdinCarries([line({ activated: false }), line({ activated: true })].join("\n"));

      await run("update", "--space", SPACE, "-");

      expect(stdoutLines().map((result) => result.action)).toEqual(["update", "update"]);
      expect(api.webhooks[0].activated).toBe(true);
    });

    it("should treat an empty required field as missing", async () => {
      await run(
        "create",
        "--space",
        SPACE,
        "--dry-run",
        "--set",
        "name=",
        "--set",
        "endpoint=https://example.com",
        "--set",
        "actions=",
      );

      expect(stderrErrors()[0].error).toBe("Missing required fields: name, actions.");
    });

    it("should check renames in one dry run against each other", async () => {
      const webhooks = preconditions.hasWebhooks({ name: "a" }, { name: "b" });
      preconditions.stdinCarries(
        webhooks.map(({ id }) => JSON.stringify({ id, name: "same" })).join("\n"),
      );

      await run("update", "--space", SPACE, "--dry-run", "-");

      expect(stdoutLines()).toHaveLength(1);
      expect(stderrErrors()).toEqual([
        expect.objectContaining({ line: 2, details: { name: ["has already been taken"] } }),
      ]);
    });

    it("should show a dry-run create's fields, without the secret's value", async () => {
      await run(
        "create",
        "--space",
        SPACE,
        "-d",
        "--set",
        "name=x",
        "--set",
        "endpoint=https://example.com/x",
        "--set",
        "actions=story.published",
        "--set",
        `secret=${SECRET}`,
      );

      expect(stdoutLines()[0]._diff).toEqual({
        name: { from: null, to: "x" },
        endpoint: { from: null, to: "https://example.com/x" },
        actions: { from: null, to: ["story.published"] },
        secret: "[changed]",
      });
    });

    it("should show from and to values in a dry run's table", async () => {
      preconditions.hasWebhooks({ name: "deploy", description: "old" });
      preconditions.stdoutIsATerminal();

      await run("update", "deploy", "--space", SPACE, "--dry-run", "--set", "description=new");

      expect(stdoutText()).toContain("description: old → new");
    });
  });

  describe("targets and failures", () => {
    it("should fail a piped name that several webhooks share, even when it looks like an ID", async () => {
      const [unrelated] = preconditions.hasWebhooks({ name: "other" });
      preconditions.hasWebhooks({ name: String(unrelated.id) }, { name: String(unrelated.id) });
      preconditions.stdinCarries(JSON.stringify({ name: String(unrelated.id) }));

      await run("delete", "--space", SPACE, "--yes", "-");

      expect(api.writes).toEqual([]);
      expect(stderrErrors()[0].error).toContain("share the name");
    });

    it("should name a piped id that is not a number", async () => {
      preconditions.stdinCarries(JSON.stringify({ id: "12", activated: false }));

      await run("update", "--space", SPACE, "-");

      expect(stderrErrors()[0].error).toBe('"id" takes a number.');
    });

    it("should skip a webhook deleted while the run is going", async () => {
      const [webhook] = preconditions.hasWebhooks({});
      server.use(
        http.patch(`${BASE}/:id`, () => HttpResponse.json({ error: "Not found" }, { status: 404 })),
      );

      await run("update", String(webhook.id), "--space", SPACE, "--set", "activated=false");

      expect(stdoutLines()).toEqual([
        expect.objectContaining({ action: "skip", _reason: "not_found", id: webhook.id }),
      ]);
      expect(process.exitCode).toBeFalsy();
    });

    it("should stop a batch once the access token is rejected", async () => {
      server.use(
        http.post(BASE, async ({ request }) => {
          api.writes.push({ method: "POST", body: {} });
          await request.text();
          return HttpResponse.json({ error: "Unauthorized" }, { status: 401 });
        }),
      );
      const line = (name: string) =>
        JSON.stringify({ name, endpoint: "https://example.com", actions: ["story.published"] });
      preconditions.stdinCarries([line("a"), line("b"), line("c")].join("\n"));

      await run("create", "--space", SPACE, "-");

      expect(api.writes).toHaveLength(1);
      expect(process.exitCode).toBe(1);
    });

    it("should report a wrong type in --data as a usage error", async () => {
      const [webhook] = preconditions.hasWebhooks({});

      await run("update", String(webhook.id), "--space", SPACE, "--data", '{"activated":"no"}');

      expect(process.exitCode).toBe(2);
    });
  });

  describe("stderr", () => {
    it("should hold only JSON error lines when stderr is not a terminal", async () => {
      preconditions.stdinCarries(JSON.stringify({ name: "incomplete" }));

      await run("create", "--space", SPACE, "--dry-run", "-");

      const lines = stderrText()
        .split("\n")
        .filter((line) => line.trim() !== "");
      expect(lines.length).toBeGreaterThan(0);
      for (const line of lines) {
        expect(() => JSON.parse(line)).not.toThrow();
      }
    });

    it("should keep control sequences in a webhook's fields off the terminal", async () => {
      preconditions.hasWebhooks({ name: "deploy", description: "\u001b]0;pwned\u0007" });
      preconditions.stdoutIsATerminal();

      await run("get", "deploy", "--space", SPACE);

      expect(stdoutText()).not.toContain("\u001b]0;");
    });

    it("should print an API error's details with the UI turned off", async () => {
      preconditions.hasWebhooks({ name: "deploy" });
      preconditions.stderrIsATerminal();

      await getProgram()
        .parseAsync([
          "node",
          "test",
          "--no-ui-enabled",
          "webhooks",
          "create",
          "--space",
          SPACE,
          "--set",
          "name=deploy",
          "--set",
          "endpoint=https://example.com",
          "--set",
          "actions=story.published",
        ])
        .catch(() => {});

      expect(stderrText()).toContain("has already been taken");
    });
  });
});
