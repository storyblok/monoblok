// `list`, `get`, `create`, `update` and `delete` for one resource, with the
// conventions every CRUD command shares: targets by ID or name,
// `--set`/`--unset`/`--data` payloads, `-` for records on stdin, result lines
// on stdout, and JSON errors on stderr when a program reads it.

import { Command } from "commander";
import { isDeepStrictEqual } from "node:util";
import { session } from "../../session";
import { EXIT_CODE_USAGE_ERROR } from "../../utils/error/exit-code";
import { getReporter } from "../reporter/reporter";
import { readRecords } from "../pipe/input";
import type { InputRecord } from "../pipe/input";
import type { ResultLine } from "../pipe";
import { getStderrTarget, getStdoutTarget, getUI, page, renderFields, sanitize } from "../ui";
import { confirmWrite } from "./confirm";
import { CrudError, reportError, toCrudError, usageError } from "./errors";
import { composePayload, missingRequired, parseFlagPatch } from "./fields";
import type { FlagPatch, Payload } from "./fields";
import { RedactedOption, redactedData, redactedSet, SecretScrubber, stripSecrets } from "./redact";
import { createResultWriter, runBatch } from "./run";
import type { BatchContext, BatchItem } from "./run";
import { ambiguousName, resolveTarget } from "./target";
import type { CrudOperations, CrudResource, ResourceRecord } from "./types";

const STDIN_ARGUMENT = "-";

/** What a payload flag holds: a redacting value from the command line, or a value from a config file. */
type FlagValue = RedactedOption | string;

type CommonOptions = {
  space?: string;
};

type PayloadOptions = {
  set?: FlagValue | FlagValue[];
  unset?: string | string[];
  data?: unknown;
  dryRun?: boolean;
};

type CreateOptions = CommonOptions & PayloadOptions & { ifNotExists?: boolean };

type UpdateOptions = CommonOptions & PayloadOptions & { ignoreStale?: boolean };

type DeleteOptions = CommonOptions & { yes?: boolean; ignoreStale?: boolean; dryRun?: boolean };

/** What every verb needs once the caller is logged in and has named a space. */
type RunContext = {
  resource: CrudResource;
  operations: CrudOperations;
};

function connect(resource: CrudResource, options: CommonOptions): RunContext {
  const { state } = session();
  if (!state.isLoggedIn || !state.password || !state.region) {
    throw usageError(
      "You are currently not logged in. Run `storyblok login` to authenticate, or `storyblok signup` to sign up.",
    );
  }
  if (!options.space) {
    throw usageError("Pass the space with --space <space-id>.");
  }
  const spaceId = Number(options.space);
  if (!Number.isInteger(spaceId) || spaceId <= 0) {
    throw usageError("--space takes a numeric space ID.");
  }
  return { resource, operations: resource.connect(spaceId) };
}

/** Ctrl+C or Esc at a confirmation prompt: the person's answer, not a failure. */
const PROMPT_CANCELLATIONS = new Set(["ExitPromptError", "AbortPromptError", "CancelPromptError"]);

function isPromptCancellation(maybeError: unknown): boolean {
  return maybeError instanceof Error && PROMPT_CANCELLATIONS.has(maybeError.name);
}

/** Runs a verb, reporting whatever stops it through the CRUD error path. */
function action<Args extends unknown[]>(
  resource: CrudResource,
  run: (scrubber: SecretScrubber, ...args: Args) => Promise<void>,
) {
  return async (...args: Args) => {
    const scrubber = new SecretScrubber(resource.secretFields);
    try {
      await run(scrubber, ...args);
    } catch (maybeError) {
      if (isPromptCancellation(maybeError)) {
        getUI().info("Cancelled. Nothing was written.");
        return;
      }
      reportError(maybeError, { scrubber });
      getReporter().finalize(new Error(scrubber.scrubText(String(maybeError))));
    }
  };
}

/** Options as the action sees them, merged with the global ones (`--space` from config). */
function optionsOf<T>(command: Command): T {
  return command.optsWithGlobals<T & Record<string, unknown>>();
}

/** A config file can give a single value where the command line gives a list. */
function toList<T>(value: T | T[] | undefined): T[] {
  if (value === undefined) {
    return [];
  }
  return Array.isArray(value) ? value : [value];
}

function readFlagPatch(resource: CrudResource, options: PayloadOptions): FlagPatch {
  const { data } = options;
  return parseFlagPatch(resource.fields, {
    // `String()` rather than `.raw`: a value from a config file is a plain string.
    set: toList(options.set).map(String),
    unset: toList(options.unset),
    data: data === undefined ? undefined : stringifyData(data),
  });
}

/** `--data` from the command line is JSON text; from a config file it can be an object. */
function stringifyData(data: unknown): string {
  return typeof data === "string" || data instanceof RedactedOption
    ? String(data)
    : JSON.stringify(data);
}

function hasFlagPatch(options: PayloadOptions): boolean {
  return Boolean(
    toList(options.set).length || toList(options.unset).length || options.data !== undefined,
  );
}

/** Records from stdin, each remembering its position for error reports. */
async function readItems(scrubber: SecretScrubber): Promise<BatchItem<InputRecord>[]> {
  const records = await readRecords();
  return records.map((value, index) => {
    scrubber.collect(value);
    return { line: index + 1, value };
  });
}

/** The argument is never repeated: a value misplaced on the command line can be a secret. */
function assertDashArgument(argument: string | undefined): void {
  if (argument !== undefined && argument !== STDIN_ARGUMENT) {
    throw usageError("Unexpected argument. Pass `-` to read records from stdin.");
  }
}

function nameOf(resource: CrudResource, record: Record<string, unknown> | undefined): unknown {
  return resource.nameField ? record?.[resource.nameField] : undefined;
}

/**
 * The server record a piped line addresses, by `id`, or by name for a line
 * without one. `undefined` when the space no longer has it.
 */
function findForLine(
  resource: CrudResource,
  line: InputRecord,
  records: ResourceRecord[],
): ResourceRecord | undefined {
  if (line.id !== undefined) {
    if (typeof line.id !== "number") {
      throw new CrudError('"id" takes a number.');
    }
    return records.find((record) => record.id === line.id);
  }
  const { nameField } = resource;
  const name = nameOf(resource, line);
  if (nameField && typeof name === "string") {
    const matches = records.filter((record) => record[nameField] === name);
    if (matches.length > 1) {
      throw ambiguousName(matches, { nameField, noun: resource.noun });
    }
    return matches[0];
  }
  throw new CrudError(
    nameField ? `The record has neither an ID nor a ${nameField}.` : "The record has no ID.",
  );
}

/**
 * Refuses to write a record whose server copy changed since the line was
 * read: the line still holds the old values of fields someone else changed,
 * and writing them back would undo those changes.
 */
function assertFresh(
  line: InputRecord | undefined,
  server: ResourceRecord,
  ignoreStale: boolean,
): void {
  if (ignoreStale || line?.updated_at === undefined || line.updated_at === server.updated_at) {
    return;
  }
  throw new CrudError(
    `Changed since this record was read (updated_at ${String(server.updated_at)}, the record has ${String(line.updated_at)}). Pass --ignore-stale to write it anyway.`,
  );
}

const sameValue = (a: unknown, b: unknown) => isDeepStrictEqual(a ?? null, b ?? null);

function changedFields(desired: Payload, server: ResourceRecord): Payload {
  return Object.fromEntries(
    Object.entries(desired).filter(([field, value]) => !sameValue(value, server[field])),
  );
}

/** Per field `{ from, to }`; a secret field only as `"[changed]"`. */
function toDiff(resource: CrudResource, changes: Payload, server: Record<string, unknown>) {
  return Object.fromEntries(
    Object.entries(changes).map(([field, to]) => [
      field,
      resource.secretFields.includes(field) ? "[changed]" : { from: server[field] ?? null, to },
    ]),
  );
}

function assertRequired(resource: CrudResource, payload: Payload): void {
  const missing = missingRequired(resource.fields, payload);
  if (missing.length > 0) {
    throw new CrudError(`Missing required fields: ${missing.join(", ")}.`);
  }
}

/**
 * Client-side checks for a dry run: what the API would reject that the CLI can
 * know without writing. Plan limits and address rules are only caught by a
 * real run.
 */
async function validateForDryRun(
  context: RunContext,
  payload: Payload,
  { takenNames, required }: { takenNames: (name: unknown) => boolean; required: boolean },
): Promise<void> {
  const { resource, operations } = context;
  if (required) {
    assertRequired(resource, payload);
  }
  const name = nameOf(resource, payload);
  if (resource.nameField && name !== undefined && takenNames(name)) {
    throw new CrudError(`A ${resource.noun.singular} with this ${resource.nameField} exists.`, {
      details: { [resource.nameField]: ["has already been taken"] },
    });
  }
  for (const [field, lookup] of Object.entries(operations.allowedValues ?? {})) {
    const value = payload[field];
    const values = Array.isArray(value) ? value : value === undefined ? [] : [value];
    if (values.length === 0) {
      continue;
    }
    const allowed = await lookup();
    const invalid = values.filter((item) => !allowed.includes(String(item)));
    if (invalid.length > 0) {
      throw new CrudError(`${field} has values the API does not accept: ${invalid.join(", ")}.`, {
        details: { [field]: ["not allowed"], allowed_values: { [field]: allowed } },
      });
    }
  }
}

/** On a terminal only: a program reading stderr gets error lines and nothing else. */
function announceDryRun(dryRun: boolean | undefined): void {
  if (dryRun && getStderrTarget() === "terminal") {
    getUI().info("Dry run: nothing will be written.");
  }
}

/** A 404 on the write itself: the record went away after this run listed it. */
function isGone(maybeError: unknown): boolean {
  return toCrudError(maybeError).status === 404;
}

function notFound(resource: CrudResource, line: InputRecord | undefined, id?: number): ResultLine {
  return {
    id: id ?? (typeof line?.id === "number" ? line.id : null),
    name: nameOf(resource, line),
    action: "skip",
    _skipped: true,
    _reason: "not_found",
  };
}

/** Keeps the run's copy of the space current, so a later line sees an earlier write. */
function replaceRecord(records: ResourceRecord[], next: ResourceRecord): void {
  const index = records.findIndex((record) => record.id === next.id);
  if (index !== -1) {
    records[index] = next;
  }
}

function removeRecord(records: ResourceRecord[], id: number): void {
  const index = records.findIndex((record) => record.id === id);
  if (index !== -1) {
    records.splice(index, 1);
  }
}

function addSpaceOption(command: Command): Command {
  return command.option("-s, --space <space>", "space ID");
}

function addDryRunOption(command: Command, description: string): Command {
  return command.option("-d, --dry-run", description);
}

function addPayloadOptions(
  command: Command,
  resource: CrudResource,
  { unset, dataHelp }: { unset: boolean; dataHelp: string },
): Command {
  const fields = Object.keys(resource.fields.writable);
  const visibleFields = fields.filter((field) => !resource.secretFields.includes(field));
  command
    .option(
      "--set <field=value>",
      `set a field, once per field. Fields: ${fields.join(", ")}. Lists are comma-separated`,
      (value: string, previous: RedactedOption[] = []) => [
        ...previous,
        redactedSet(value, visibleFields),
      ],
    )
    .option("--data <json>", dataHelp, (value: string) => redactedData(value, visibleFields));
  if (unset) {
    command.option(
      "--unset <field>",
      "clear a field, repeatable",
      (value: string, previous: string[] = []) => [...previous, value],
    );
  }
  return addDryRunOption(command, "validate and print what would change, without writing");
}

/**
 * `unknown option '--secret=value'`: commander repeats the value, which can be
 * a secret. Greedy up to the last quote, so a quote inside the value does not
 * end the match early.
 */
const INLINE_OPTION_VALUE = /'(--?[^=' ]+)=.*'/g;

function toUsageMessage(text: string): string {
  return text
    .replace(/^error:\s*/i, "")
    .replace(INLINE_OPTION_VALUE, "'$1=…'")
    .trim();
}

const STDIN_HELP = "JSONL, a JSON object, or objects back to back";

/**
 * Adds `<name> list|get|create|update|delete` for a resource to `program`.
 *
 * Errors from commander itself (an unknown flag, a missing argument) take the
 * same path as every other error of these commands, so they are JSON too when
 * stderr is not a terminal. Commander shares one output configuration object
 * with every command that inherits settings, so the resource command is built
 * standalone and attached with `addCommand`, which copies nothing: configuring
 * it through `program.command()` would change every other command's errors.
 */
export function addCrudCommand(
  program: Command,
  { name, description, resource }: { name: string; description: string; resource: CrudResource },
): Command {
  const { noun } = resource;
  const targetHelp = resource.nameField
    ? `${noun.singular} ID or ${resource.nameField}`
    : `${noun.singular} ID`;
  const parent = new Command(name)
    .description(description)
    .helpOption("-h, --help", "Display help for command")
    .exitOverride()
    // Inherited by the subcommands created below, and only by them.
    .configureOutput({
      outputError: (text) => reportError(usageError(toUsageMessage(text))),
      // Only help shown for a missing subcommand reaches here: help text, not an error line.
      writeErr: (text) => {
        process.stderr.write(text);
        process.exitCode = EXIT_CODE_USAGE_ERROR;
      },
    });
  program.addCommand(parent);

  const listCommand = addSpaceOption(
    parent.command("list").description(`List the space's ${noun.plural}`),
  );
  listCommand.action(
    action(resource, async (_scrubber, _options: CommonOptions, command: Command) => {
      const { operations } = connect(resource, optionsOf<CommonOptions>(command));
      const records = await operations.listAll();
      const writer = createResultWriter(resource.columns);
      for (const record of records) {
        await writer.write(stripSecrets(record, resource.secretFields));
      }
      await writer.end();
    }),
  );

  const getCommand = addSpaceOption(
    parent
      .command("get")
      .description(`Print one ${noun.singular}`)
      .argument(`<${noun.singular}>`, targetHelp),
  );
  getCommand.action(
    action(
      resource,
      async (_scrubber, target: string, _options: CommonOptions, command: Command) => {
        const { operations } = connect(resource, optionsOf<CommonOptions>(command));
        const { id } = resolveTarget(target, await operations.listAll(), resource);
        const record = stripSecrets(await operations.get(id), resource.secretFields);
        if (getStdoutTarget() === "terminal") {
          await page(`${renderFields(record)}\n`);
        } else {
          getUI().writeMachineOutput(JSON.stringify(record));
        }
      },
    ),
  );

  const createCommand = addSpaceOption(
    addPayloadOptions(
      parent
        .command("create")
        .description(`Create a ${noun.singular} from flags, or one per record on stdin with -`)
        .argument("[-]", `read ${noun.plural} from stdin: ${STDIN_HELP}`),
      resource,
      {
        unset: false,
        dataHelp: "fields as a JSON object, applied to each record from stdin; --set wins over it",
      },
    ).option(
      "--if-not-exists",
      `skip a ${noun.singular} whose ${resource.nameField ?? "name"} exists, so reruns pass`,
    ),
  );
  createCommand.action(
    action(
      resource,
      async (scrubber, input: string | undefined, _options: CreateOptions, command: Command) => {
        const options = optionsOf<CreateOptions>(command);
        assertDashArgument(input);
        const patch = readFlagPatch(resource, options);
        if (input === undefined && !hasFlagPatch(options)) {
          throw usageError(
            `Pass fields with --set or --data, or \`-\` to read ${noun.plural} from stdin.`,
          );
        }
        if (options.ifNotExists && !resource.nameField) {
          throw usageError(`--if-not-exists needs a unique name, which ${noun.plural} lack.`);
        }
        const context = connect(resource, options);
        const items: BatchItem<InputRecord | undefined>[] =
          input === STDIN_ARGUMENT ? await readItems(scrubber) : [{ value: undefined }];
        announceDryRun(options.dryRun);

        const needsList = options.ifNotExists || options.dryRun;
        const existing = needsList ? await context.operations.listAll() : [];
        /** Taken names and their IDs, including those this run creates. A dry run has no IDs yet. */
        const takenNames = new Map<unknown, number | null>(
          existing.map((record) => [nameOf(resource, record), record.id]),
        );

        await runBatch({
          verb: "create",
          noun,
          items,
          dryRun: Boolean(options.dryRun),
          operations: context.operations,
          scrubber,
          handle: async ({ value: line }) => {
            const payload = composePayload(resource.fields, line, patch);
            scrubber.collect(payload);
            const name = nameOf(resource, payload);
            if (options.ifNotExists && takenNames.has(name)) {
              return {
                id: takenNames.get(name) ?? null,
                name,
                action: "skip",
                _skipped: true,
                _reason: "exists",
              };
            }
            if (options.dryRun) {
              await validateForDryRun(context, payload, {
                takenNames: (candidate) => takenNames.has(candidate),
                required: true,
              });
              takenNames.set(name, null);
              return {
                id: null,
                name,
                action: "create",
                _diff: toDiff(resource, payload, {}),
              };
            }
            assertRequired(resource, payload);
            const created = await context.operations.create(payload);
            takenNames.set(name, created.id);
            return { id: created.id, name: nameOf(resource, created), action: "create" };
          },
        });
      },
    ),
  );

  const updateCommand = addSpaceOption(
    addPayloadOptions(
      parent
        .command("update")
        .description(`Update a ${noun.singular}, or one per record on stdin with -`)
        .argument(`[${noun.singular}]`, `${targetHelp}, or - to read ${STDIN_HELP} from stdin`),
      resource,
      {
        unset: true,
        dataHelp: "fields as a JSON object, merged as a JSON Merge Patch; --set wins over it",
      },
    ).option("--ignore-stale", "write records whose webhook changed since they were read"),
  );
  updateCommand.action(
    action(
      resource,
      async (scrubber, target: string | undefined, _options: UpdateOptions, command: Command) => {
        const options = optionsOf<UpdateOptions>(command);
        if (target === undefined) {
          throw usageError(
            `Pass the ${noun.singular} to update, or \`-\` to read ${noun.plural} from stdin.`,
          );
        }
        const patch = readFlagPatch(resource, options);
        const readsStdin = target === STDIN_ARGUMENT;
        if (!readsStdin && !hasFlagPatch(options)) {
          throw usageError("Nothing to update: pass --set, --unset or --data.");
        }
        const context = connect(resource, options);
        const items = readsStdin ? await readItems(scrubber) : [{ value: undefined }];
        announceDryRun(options.dryRun);

        const records = await context.operations.listAll();

        await runBatch({
          verb: "update",
          noun,
          items,
          dryRun: Boolean(options.dryRun),
          operations: context.operations,
          scrubber,
          handle: async ({ value: line }, batch: BatchContext): Promise<ResultLine> => {
            const server = line
              ? findForLine(resource, line, records)
              : resolveTarget(target, records, resource);
            if (!server) {
              return notFound(resource, line);
            }
            batch.id = server.id;
            scrubber.collect(server);
            assertFresh(line, server, Boolean(options.ignoreStale));

            const desired = composePayload(resource.fields, line, patch);
            scrubber.collect(desired);
            const changes = changedFields(desired, server);
            const name = nameOf(resource, server);
            if (Object.keys(changes).length === 0) {
              return { id: server.id, name, action: "skip", _skipped: true, _reason: "unchanged" };
            }
            if (options.dryRun) {
              await validateForDryRun(context, changes, {
                takenNames: (candidate) =>
                  records.some(
                    (record) => record.id !== server.id && nameOf(resource, record) === candidate,
                  ),
                required: false,
              });
              // Later lines see this one's changes, as they would in a real run.
              replaceRecord(records, { ...server, ...changes });
              return {
                id: server.id,
                name,
                action: "update",
                _diff: toDiff(resource, changes, server),
              };
            }
            let updated: ResourceRecord;
            try {
              updated = await context.operations.update(server.id, changes);
            } catch (maybeError) {
              if (isGone(maybeError)) {
                removeRecord(records, server.id);
                return notFound(resource, line ?? server, server.id);
              }
              throw maybeError;
            }
            replaceRecord(records, updated);
            return { id: updated.id, name: nameOf(resource, updated), action: "update" };
          },
        });
      },
    ),
  );

  const deleteCommand = addSpaceOption(
    addDryRunOption(
      parent
        .command("delete")
        .description(`Delete a ${noun.singular}, or one per record on stdin with -`)
        .argument(`[${noun.singular}]`, `${targetHelp}, or - to read ${STDIN_HELP} from stdin`)
        .option("--yes", "skip the confirmation prompt; required with -")
        .option("--ignore-stale", "delete records whose webhook changed since they were read"),
      "print what would be deleted, without deleting",
    ),
  );
  deleteCommand.action(
    action(
      resource,
      async (scrubber, target: string | undefined, _options: DeleteOptions, command: Command) => {
        const options = optionsOf<DeleteOptions>(command);
        if (target === undefined) {
          throw usageError(
            `Pass the ${noun.singular} to delete, or \`-\` to read ${noun.plural} from stdin.`,
          );
        }
        const readsStdin = target === STDIN_ARGUMENT;
        if (readsStdin && !options.yes && !options.dryRun) {
          // Before reading stdin: the run cannot go ahead whatever it holds.
          await confirmWrite({ message: () => "", yes: false, dryRun: false, readsStdin });
        }
        const context = connect(resource, options);
        const items = readsStdin ? await readItems(scrubber) : [{ value: undefined }];
        const records = await context.operations.listAll();

        if (!readsStdin) {
          const record = resolveTarget(target, records, resource);
          const label = sanitize(String(nameOf(resource, record) ?? record.id));
          const confirmed = await confirmWrite({
            message: () => `Delete ${noun.singular} "${label}" (ID ${record.id})?`,
            yes: Boolean(options.yes),
            dryRun: Boolean(options.dryRun),
            readsStdin,
          });
          if (!confirmed) {
            getUI().info("Nothing deleted.");
            return;
          }
        }
        announceDryRun(options.dryRun);

        await runBatch({
          verb: "delete",
          noun,
          items,
          dryRun: Boolean(options.dryRun),
          operations: context.operations,
          scrubber,
          handle: async ({ value: line }, batch: BatchContext): Promise<ResultLine> => {
            const server = line
              ? findForLine(resource, line, records)
              : resolveTarget(target, records, resource);
            if (!server) {
              return notFound(resource, line);
            }
            batch.id = server.id;
            scrubber.collect(server);
            assertFresh(line, server, Boolean(options.ignoreStale));
            const name = nameOf(resource, server);
            // Removed in a dry run too, so a repeated line is reported as a real run would.
            removeRecord(records, server.id);
            if (options.dryRun) {
              return { id: server.id, name, action: "delete" };
            }
            try {
              await context.operations.delete(server.id);
            } catch (maybeError) {
              if (isGone(maybeError)) {
                return notFound(resource, line ?? server, server.id);
              }
              throw maybeError;
            }
            return { id: server.id, name, action: "delete" };
          },
        });
      },
    ),
  );
  return parent;
}
