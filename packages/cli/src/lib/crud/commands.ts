// `list`, `get`, `create`, `update` and `delete` for one resource, with the
// conventions every CRUD command shares: targets by ID or name,
// `--set`/`--unset`/`--data` payloads, `-` for records on stdin, result lines
// on stdout, and JSON errors on stderr when a program reads it.
//
// Commander shares one output configuration object between a command and every
// command created from it with `.command()`, and `configureOutput` changes that
// object in place. So each command here is built standalone and attached with
// `addCommand`, which copies nothing: configuring it otherwise would change the
// errors of every other command.

import { Command } from "commander";
import { isDeepStrictEqual } from "node:util";
import { session } from "../../session";
import { notLoggedInMessage } from "../../utils/auth";
import { EXIT_CODE_USAGE_ERROR, isPromptCancellation } from "../../utils/error";
import { getReporter } from "../reporter/reporter";
import { MalformedInputError, readRecords } from "../pipe/input";
import type { InputRecord } from "../pipe/input";
import type { ResultLine } from "../pipe";
import { getStdoutTarget, getUI, page, renderFields, sanitize } from "../ui";
import { getStdinTarget } from "../ui/stream-target";
import { confirmWrite } from "./confirm";
import { CrudError, reportError, toCrudError, usageError } from "./errors";
import { composePayload, missingRequired, parseFlagPatch } from "./fields";
import type { FlagPatch, Payload } from "./fields";
import { RedactedOption, redactedData, redactedSet, SecretScrubber, stripSecrets } from "./redact";
import { announce, createResultWriter, runBatch } from "./run";
import type { BatchContext, BatchItem } from "./run";
import { ambiguousName, resolveTarget, targetId } from "./target";
import type { CrudOperations, CrudResource, CrudVerb, ResourceRecord } from "./types";

const STDIN_ARGUMENT = "-";

const CRUD_VERBS: readonly CrudVerb[] = ["list", "get", "create", "update", "delete"];

/**
 * What a dry run's copy of an updated record holds as `updated_at`: the real
 * write changes it, so a later line read before that write is stale in both.
 */
const DRY_RUN_UPDATED_AT = "(updated by an earlier line of this dry run)";

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

/** What the helpers below read of a resource, whatever its record type. */
type ResourceInfo = Pick<CrudResource, "noun" | "fields" | "secretFields" | "nameField">;

/** What every verb needs once the caller is logged in and has named a space. */
type RunContext<T extends ResourceRecord> = {
  resource: CrudResource<T>;
  operations: CrudOperations<T>;
};

/** Allowed values are looked up at most once per run, however many records need them. */
function lookUpOnce<T extends ResourceRecord>(operations: CrudOperations<T>): CrudOperations<T> {
  if (!operations.allowedValues) {
    return operations;
  }
  const lookups = Object.entries(operations.allowedValues).map(
    ([field, lookup]): [string, () => Promise<string[]>] => {
      let values: Promise<string[]> | undefined;
      return [field, () => (values ??= lookup())];
    },
  );
  return { ...operations, allowedValues: Object.fromEntries(lookups) };
}

function connect<T extends ResourceRecord>(
  resource: CrudResource<T>,
  options: CommonOptions,
): RunContext<T> {
  const { state } = session();
  if (!state.isLoggedIn || !state.password || !state.region) {
    throw usageError(notLoggedInMessage());
  }
  if (!options.space) {
    throw usageError("Pass the ID of the space with --space <space-id>.");
  }
  const spaceId = Number(options.space);
  if (!Number.isInteger(spaceId) || spaceId <= 0) {
    throw usageError("--space takes a numeric space ID.");
  }
  return { resource, operations: lookUpOnce(resource.connect({ spaceId })) };
}

/**
 * Runs a verb, reporting whatever stops it through the CRUD error path.
 * Ctrl-C at a prompt is the person's answer, not a failure: exit 0, as for
 * every other command.
 */
function action<T extends ResourceRecord, Args extends unknown[]>(
  resource: CrudResource<T>,
  run: (scrubber: SecretScrubber, ...args: Args) => Promise<void>,
) {
  return async (...args: Args) => {
    const scrubber = new SecretScrubber(resource.secretFields);
    try {
      await run(scrubber, ...args);
    } catch (maybeError) {
      if (maybeError instanceof Error && isPromptCancellation(maybeError)) {
        getUI().info("Canceled. Nothing was written.");
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

function readFlagPatch(resource: ResourceInfo, options: PayloadOptions): FlagPatch {
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

async function readItems(scrubber: SecretScrubber): Promise<BatchItem<InputRecord>[]> {
  if (getStdinTarget() === "terminal") {
    throw usageError(
      "`-` reads records from stdin, but stdin is a terminal. Pipe records in, or redirect a file with `< records.jsonl`.",
    );
  }
  try {
    const items = await readRecords();
    for (const { value } of items) {
      scrubber.collect(value);
    }
    return items;
  } catch (maybeError) {
    if (maybeError instanceof MalformedInputError) {
      throw usageError(maybeError.message);
    }
    throw maybeError;
  }
}

/** The argument is never repeated: a value misplaced on the command line can be a secret. */
function assertDashArgument(argument: string | undefined): void {
  if (argument !== undefined && argument !== STDIN_ARGUMENT) {
    throw usageError("Unexpected argument. Pass `-` to read records from stdin.");
  }
}

/** Staleness needs a record read earlier, which only stdin carries. */
function assertIgnoreStaleFitsTarget(ignoreStale: boolean | undefined, readsStdin: boolean): void {
  if (ignoreStale && !readsStdin) {
    throw usageError("--ignore-stale applies to records read from stdin with `-`.");
  }
}

function nameOf(resource: ResourceInfo, record: Record<string, unknown> | undefined): unknown {
  return resource.nameField ? record?.[resource.nameField] : undefined;
}

function isSecret(resource: ResourceInfo, field: string): boolean {
  return resource.secretFields.some((secret) => secret === field);
}

/**
 * The server record a piped line addresses, by `id`, or by name for a line
 * without one. `undefined` when the space does not have it.
 */
function findForLine<T extends ResourceRecord>(
  resource: CrudResource<T>,
  line: InputRecord,
  records: T[],
): T | undefined {
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
  resource: ResourceInfo,
  line: InputRecord | undefined,
  server: ResourceRecord,
  ignoreStale: boolean,
): void {
  if (ignoreStale || line?.updated_at === undefined || line.updated_at === server.updated_at) {
    return;
  }
  throw new CrudError(
    `The ${resource.noun.singular} changed since this record was read (updated_at ${String(server.updated_at)}, the record has ${String(line.updated_at)}). Pass --ignore-stale to go ahead anyway.`,
  );
}

const sameValue = (a: unknown, b: unknown) => isDeepStrictEqual(a ?? null, b ?? null);

function changedFields(desired: Payload, server: ResourceRecord): Payload {
  return Object.fromEntries(
    Object.entries(desired).filter(([field, value]) => !sameValue(value, server[field])),
  );
}

function toDiff(resource: ResourceInfo, changes: Payload, server: Record<string, unknown>) {
  return Object.fromEntries(
    Object.entries(changes).map(([field, to]) => [
      field,
      isSecret(resource, field) ? "[changed]" : { from: server[field] ?? null, to },
    ]),
  );
}

/**
 * The record as it would be after the write, checked before sending it.
 * Exit 2 when the flags alone hold the payload: the call itself is wrong.
 */
function assertRequired(
  resource: ResourceInfo,
  record: Payload,
  { fromFlags }: { fromFlags: boolean },
): void {
  const missing = missingRequired(resource.fields, record);
  if (missing.length > 0) {
    const message = `Missing required fields: ${missing.join(", ")}.`;
    throw fromFlags ? usageError(message) : new CrudError(message);
  }
}

/**
 * Client-side checks for a dry run: what the API would reject that the CLI can
 * know without writing. Plan limits and address rules are only caught by a
 * real run. Only values the write adds are checked: the API keeps values a
 * record already has, even ones the allowed list leaves out, such as an action
 * the space's plan no longer includes.
 */
async function validateForDryRun<T extends ResourceRecord>(
  context: RunContext<T>,
  payload: Payload,
  { takenNames, current }: { takenNames: (name: unknown) => boolean; current?: T },
): Promise<void> {
  const { resource, operations } = context;
  const name = nameOf(resource, payload);
  if (resource.nameField && name !== undefined && takenNames(name)) {
    throw new CrudError(`A ${resource.noun.singular} with this ${resource.nameField} exists.`, {
      details: { [resource.nameField]: ["has already been taken"] },
    });
  }
  for (const [field, lookup] of Object.entries(operations.allowedValues ?? {})) {
    const kept = toList(current?.[field]);
    const added = toList(payload[field]).filter((item) => !kept.includes(item));
    if (added.length === 0) {
      continue;
    }
    const allowed = await lookup();
    const invalid = added.filter((item) => !allowed.includes(String(item)));
    if (invalid.length > 0) {
      throw new CrudError(`${field} has values the API does not accept: ${invalid.join(", ")}.`, {
        details: { [field]: ["not allowed"], allowed_values: { [field]: allowed } },
      });
    }
  }
}

function announceDryRun(dryRun: boolean | undefined): void {
  if (dryRun) {
    announce("Dry run: nothing will be written.");
  }
}

/** A 404: the record is not there, or went away after this run listed it. */
function isGone(maybeError: unknown): boolean {
  return toCrudError(maybeError).status === 404;
}

/**
 * A delete of a record that is not there: what the delete was for, so a rerun
 * passes. An update of one fails instead.
 */
function alreadyDeleted(
  resource: ResourceInfo,
  line: InputRecord | undefined,
  id?: number,
): ResultLine {
  return {
    id: id ?? (typeof line?.id === "number" ? line.id : null),
    name: nameOf(resource, line),
    action: "skip",
    _skipped: true,
    _reason: "not_found",
  };
}

function notFoundForLine(resource: ResourceInfo, line: InputRecord): CrudError {
  const key = line.id !== undefined ? "ID" : (resource.nameField ?? "ID");
  return new CrudError(`No ${resource.noun.singular} matches the record's ${key}.`);
}

/** Keeps the run's copy of the space current, so a later line sees an earlier write. */
function replaceRecord<T extends ResourceRecord>(records: T[], next: T): void {
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

/** By ID with one request; by name, or an all-digit name, through the list. */
async function findTarget<T extends ResourceRecord>(
  context: RunContext<T>,
  target: string,
): Promise<T> {
  const { resource, operations } = context;
  const id = targetId(target);
  if (id !== undefined) {
    try {
      return await operations.get(id);
    } catch (maybeError) {
      if (!isGone(maybeError)) {
        throw maybeError;
      }
    }
  }
  return operations.get(resolveTarget(target, await operations.listAll(), resource).id);
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

/** Errors from commander itself (an unknown flag, a missing argument) take the CRUD error path. */
function withCrudErrors(command: Command): Command {
  return command
    .helpOption("-h, --help", "Display help for command")
    .exitOverride()
    .configureOutput({
      outputError: (text) => reportError(usageError(toUsageMessage(text))),
      // Only help shown for a missing subcommand reaches here: help text, not an error line.
      writeErr: (text) => {
        process.stderr.write(text);
        process.exitCode = EXIT_CODE_USAGE_ERROR;
      },
    });
}

function addVerbCommand(parent: Command, name: CrudVerb): Command {
  const command = withCrudErrors(new Command(name));
  parent.addCommand(command);
  return command;
}

function addSpaceOption(command: Command): Command {
  return command.option("-s, --space <space>", "space ID");
}

function addDryRunOption(command: Command, description: string): Command {
  return command.option("-d, --dry-run", description);
}

function addPayloadOptions(
  command: Command,
  resource: ResourceInfo,
  { unset, dataHelp }: { unset: boolean; dataHelp: string },
): Command {
  const fields = Object.keys(resource.fields.writable);
  const visibleFields = fields.filter((field) => !isSecret(resource, field));
  command
    .option(
      "--set <field=value>",
      `set a field, repeatable. Fields: ${fields.join(", ")}. Lists are comma-separated`,
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

const STDIN_HELP = "JSONL, a JSON object, or objects back to back";

/**
 * A top-level command for a resource that has none yet, such as `webhooks`.
 * Its own errors (an unknown subcommand) take the CRUD error path too.
 */
export function createCrudCommand(
  program: Command,
  { name, description }: { name: string; description: string },
): Command {
  const command = withCrudErrors(new Command(name)).description(description);
  program.addCommand(command);
  return command;
}

/**
 * Adds `list`, `get`, `create`, `update` and `delete` for `resource` to
 * `parent`, or the subset `verbs` names, for a parent that already has some of
 * them.
 */
export function addCrudVerbs<T extends ResourceRecord>(
  parent: Command,
  resource: CrudResource<T>,
  { verbs = CRUD_VERBS }: { verbs?: readonly CrudVerb[] } = {},
): void {
  const { noun } = resource;
  const targetHelp = resource.nameField
    ? `${noun.singular} ID or ${resource.nameField}`
    : `${noun.singular} ID`;

  const builders: Record<CrudVerb, () => void> = {
    list: () => {
      const command = addSpaceOption(
        addVerbCommand(parent, "list").description(`List the space's ${noun.plural}`),
      );
      command.action(
        action(resource, async (_scrubber, _options: CommonOptions, cmd: Command) => {
          const { operations } = connect(resource, optionsOf<CommonOptions>(cmd));
          const records = await operations.listAll();
          if (records.length === 0 && getStdoutTarget() === "terminal") {
            getUI().info(`No ${noun.plural} in this space.`);
            return;
          }
          const writer = createResultWriter(resource.columns);
          for (const record of records) {
            await writer.write(stripSecrets(record, resource.secretFields));
          }
          await writer.end();
        }),
      );
    },

    get: () => {
      const command = addSpaceOption(
        addVerbCommand(parent, "get")
          .description(`Print one ${noun.singular}`)
          .argument(`<${noun.singular}>`, targetHelp),
      );
      command.action(
        action(
          resource,
          async (_scrubber, target: string, _options: CommonOptions, cmd: Command) => {
            const context = connect(resource, optionsOf<CommonOptions>(cmd));
            const record = stripSecrets(await findTarget(context, target), resource.secretFields);
            if (getStdoutTarget() === "terminal") {
              await page(`${renderFields(record)}\n`);
            } else {
              getUI().writeMachineOutput(JSON.stringify(record));
            }
          },
        ),
      );
    },

    create: () => {
      const command = addSpaceOption(
        addPayloadOptions(
          addVerbCommand(parent, "create")
            .description(`Create a ${noun.singular} from flags, or one per record on stdin with -`)
            .argument("[-]", `read ${noun.plural} from stdin: ${STDIN_HELP}`),
          resource,
          {
            unset: false,
            dataHelp:
              "fields as a JSON object, applied to each record from stdin; --set wins over it",
          },
        ).option(
          "--if-not-exists",
          `skip a ${noun.singular} whose ${resource.nameField ?? "name"} exists, so reruns pass`,
        ),
      );
      command.action(
        action(
          resource,
          async (scrubber, input: string | undefined, _options: CreateOptions, cmd: Command) => {
            const options = optionsOf<CreateOptions>(cmd);
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
                assertRequired(resource, payload, { fromFlags: line === undefined });
                if (options.dryRun) {
                  await validateForDryRun(context, payload, {
                    takenNames: (candidate) => takenNames.has(candidate),
                  });
                  takenNames.set(name, null);
                  return { id: null, name, action: "create", _diff: toDiff(resource, payload, {}) };
                }
                const created = await context.operations.create(payload);
                takenNames.set(name, created.id);
                return { id: created.id, name: nameOf(resource, created), action: "create" };
              },
            });
          },
        ),
      );
    },

    update: () => {
      const command = addSpaceOption(
        addPayloadOptions(
          addVerbCommand(parent, "update")
            .description(`Update a ${noun.singular}, or one per record on stdin with -`)
            .argument(`[${noun.singular}]`, `${targetHelp}, or - to read ${STDIN_HELP} from stdin`)
            // The argument is optional only so a missing one gets the hint about `-`.
            .usage(`[options] <${noun.singular}>`),
          resource,
          {
            unset: true,
            dataHelp:
              "fields as a JSON object, merged into the record as a JSON Merge Patch; --set wins over it",
          },
        ).option(
          "--ignore-stale",
          `write records whose ${noun.singular} changed since they were read`,
        ),
      );
      command.action(
        action(
          resource,
          async (scrubber, target: string | undefined, _options: UpdateOptions, cmd: Command) => {
            const options = optionsOf<UpdateOptions>(cmd);
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
            assertIgnoreStaleFitsTarget(options.ignoreStale, readsStdin);
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
                  throw notFoundForLine(resource, line ?? {});
                }
                batch.id = server.id;
                scrubber.collect(server);
                assertFresh(resource, line, server, Boolean(options.ignoreStale));

                const desired = composePayload(resource.fields, line, patch, server);
                scrubber.collect(desired);
                const changes = changedFields(desired, server);
                const name = nameOf(resource, server);
                if (Object.keys(changes).length === 0) {
                  return {
                    id: server.id,
                    name,
                    action: "skip",
                    _skipped: true,
                    _reason: "unchanged",
                  };
                }
                assertRequired(resource, desired, { fromFlags: line === undefined });
                if (options.dryRun) {
                  await validateForDryRun(context, changes, {
                    takenNames: (candidate) =>
                      records.some(
                        (record) =>
                          record.id !== server.id && nameOf(resource, record) === candidate,
                      ),
                    current: server,
                  });
                  // Later lines see this one's changes, as they would in a real run.
                  replaceRecord(records, { ...server, ...changes, updated_at: DRY_RUN_UPDATED_AT });
                  return {
                    id: server.id,
                    name,
                    action: "update",
                    _diff: toDiff(resource, changes, server),
                  };
                }
                const updated = await context.operations.update(server.id, changes);
                replaceRecord(records, updated);
                return { id: updated.id, name: nameOf(resource, updated), action: "update" };
              },
            });
          },
        ),
      );
    },

    delete: () => {
      const command = addSpaceOption(
        addDryRunOption(
          addVerbCommand(parent, "delete")
            .description(`Delete a ${noun.singular}, or one per record on stdin with -`)
            .argument(`[${noun.singular}]`, `${targetHelp}, or - to read ${STDIN_HELP} from stdin`)
            // The argument is optional only so a missing one gets the hint about `-`.
            .usage(`[options] <${noun.singular}>`)
            .option("--yes", "skip the confirmation prompt; required with -")
            .option(
              "--ignore-stale",
              `delete records whose ${noun.singular} changed since they were read`,
            ),
          "print what would be deleted, without deleting",
        ),
      );
      command.action(
        action(
          resource,
          async (scrubber, target: string | undefined, _options: DeleteOptions, cmd: Command) => {
            const options = optionsOf<DeleteOptions>(cmd);
            if (target === undefined) {
              throw usageError(
                `Pass the ${noun.singular} to delete, or \`-\` to read ${noun.plural} from stdin.`,
              );
            }
            const readsStdin = target === STDIN_ARGUMENT;
            assertIgnoreStaleFitsTarget(options.ignoreStale, readsStdin);
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
                  return alreadyDeleted(resource, line);
                }
                batch.id = server.id;
                scrubber.collect(server);
                assertFresh(resource, line, server, Boolean(options.ignoreStale));
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
                    return alreadyDeleted(resource, line ?? server, server.id);
                  }
                  throw maybeError;
                }
                return { id: server.id, name, action: "delete" };
              },
            });
          },
        ),
      );
    },
  };

  for (const verb of verbs) {
    builders[verb]();
  }
}
