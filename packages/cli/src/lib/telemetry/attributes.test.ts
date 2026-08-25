import { Command } from "commander";
import { describe, expect, it } from "vitest";
import {
  buildCommandAttributes,
  buildErrorAttributes,
  buildResourceAttributes,
  collectExplicitFlags,
} from "./attributes";

describe("buildResourceAttributes", () => {
  it("should describe the release and the machine, and nothing else", () => {
    expect(
      buildResourceAttributes({
        serviceName: "storyblok-cli",
        cliVersion: "4.22.2",
        nodeVersion: "22.11.0",
        platform: "darwin",
        arch: "arm64",
        ci: true,
      }),
    ).toEqual({
      "service.name": "storyblok-cli",
      "service.version": "4.22.2",
      "process.runtime.name": "nodejs",
      "process.runtime.version": "22.11.0",
      "os.type": "darwin",
      "os.arch": "arm64",
      "sb.cli.ci": true,
    });
  });
});

describe("buildCommandAttributes", () => {
  it("should record the command path and the flags that were passed", () => {
    expect(
      buildCommandAttributes({
        command: "components pull",
        flags: ["--dry-run", "--space"],
        region: "eu",
        runId: 1737000000000,
      }),
    ).toEqual({
      "sb.cli.command": "components pull",
      "sb.cli.flags": ["--dry-run", "--space"],
      "sb.cli.region": "eu",
      "sb.cli.run_id": "1737000000000",
    });
  });

  it("should omit region and run id when they are unknown", () => {
    expect(buildCommandAttributes({ command: "login", flags: [] })).toEqual({
      "sb.cli.command": "login",
      "sb.cli.flags": [],
    });
  });
});

describe("buildErrorAttributes", () => {
  it("should classify an API failure by its error id and HTTP status", () => {
    const error = Object.assign(new Error("Space 12345 is not accessible"), {
      name: "API Error",
      errorId: "unauthorized",
      code: 401,
    });

    expect(buildErrorAttributes(error)).toEqual({
      "error.type": "API Error",
      "sb.cli.error.id": "unauthorized",
      "http.response.status_code": 401,
    });
  });

  it("should keep a symbolic code as a code, not as an HTTP status", () => {
    const error = Object.assign(new Error("no such file"), { code: "ENOENT" });

    expect(buildErrorAttributes(error)).toEqual({
      "error.type": "Error",
      "sb.cli.error.code": "ENOENT",
    });
  });

  it("should drop a status code that never came from a response", () => {
    const error = Object.assign(new Error("network down"), { name: "API Error", code: 0 });

    expect(buildErrorAttributes(error)).toEqual({ "error.type": "API Error" });
  });

  it("should never carry the error message", () => {
    const attributes = buildErrorAttributes(new Error("token sbp_123 rejected for space 456"));

    expect(Object.values(attributes).join(" ")).not.toContain("sbp_123");
  });

  it("should classify a thrown non-error", () => {
    expect(buildErrorAttributes("boom")).toEqual({ "error.type": "string" });
  });
});

describe("collectExplicitFlags", () => {
  function parse(argv: string[]): Command {
    const command = new Command();
    command
      .option("--verbose")
      .option("--space <id>")
      .option("--dry-run")
      .option("--api-rate-limit <number>", "", "6")
      // A negatable boolean, declared the way the global options are: two options sharing
      // one attribute name.
      .option("--ui-enabled")
      .option("--no-ui-enabled");
    command.parse(argv, { from: "user" });
    return command;
  }

  it("should report the flags typed on the command line, sorted and without values", () => {
    expect(collectExplicitFlags([parse(["--space", "12345", "--verbose"])])).toEqual([
      "--space",
      "--verbose",
    ]);
  });

  it("should ignore options that only carry their default value", () => {
    expect(collectExplicitFlags([parse([])])).toEqual([]);
  });

  it("should report only the half of a negatable pair that was typed", () => {
    expect(collectExplicitFlags([parse(["--no-ui-enabled"])])).toEqual(["--no-ui-enabled"]);
    expect(collectExplicitFlags([parse(["--ui-enabled"])])).toEqual(["--ui-enabled"]);
  });

  it("should merge the flags of every command in the chain", () => {
    const root = parse(["--verbose"]);
    const subcommand = parse(["--dry-run"]);

    expect(collectExplicitFlags([root, subcommand])).toEqual(["--dry-run", "--verbose"]);
  });
});
