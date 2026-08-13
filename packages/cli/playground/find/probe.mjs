/**
 * Entry point for the find scenario harness's timing probe. Load it ahead of the
 * CLI with `node --import ./probe.mjs dist/index.mjs …` and point
 * `FIND_PROBE_OUT` at the file the records should land in.
 */
import { register } from "node:module";

register("./probe-hooks.mjs", import.meta.url);
