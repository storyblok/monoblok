/**
 * Serverless lifetime simulation. An EXAMPLE to adapt, not a ready-to-run script.
 *
 * Referenced by ../runtime-checklist.md, section 1 (Prototype it).
 *
 * Adapt three things, then copy it to your scratchpad and run it from the repo root:
 *
 *   1. ENTRY: a path into the BUILT package. Run `pnpm nx build PACKAGE_NAME` first.
 *      Import the build output, not `src`, so a broken `exports` map shows up here.
 *   2. exercise(): the documented happy path, written from the docs only. If you had to
 *      read the source to write it, that is itself a finding worth reporting.
 *   3. The side-effect probe: this file counts outbound fetch calls. If the side effect
 *      under test is a DB write, a queue publish, or a log line, count that instead.
 *
 *   ENTRY=packages/PACKAGE_NAME/dist/index.js node scratchpad/serverless-sim.mjs
 */

import { pathToFileURL } from 'node:url';

const ENTRY = pathToFileURL(process.env.ENTRY ?? 'packages/PACKAGE_NAME/dist/index.js').href; // ADAPT

// --- Side-effect probe -------------------------------------------------------
// ADAPT if the side effect under test is not an outbound request.

const calls = [];
globalThis.fetch = async (input) => {
  calls.push(String(typeof input === 'string' ? input : (input?.url ?? input)));
  return new Response('{}', { status: 200, headers: { 'content-type': 'application/json' } });
};

// --- The documented happy path ----------------------------------------------

async function exercise(mod) {
  // ADAPT: the smallest thing that exercises the documented behavior end to end.
  const client = mod.createClient({ token: 'test-token' });
  return client.doThing({ id: 1 });
}

// --- One cold instance per request -------------------------------------------
// The query string defeats the ESM module cache, so each request gets a fresh module
// graph: the closest a single Node process gets to a cold serverless instance. It does
// NOT reset globals or `globalThis` caches. If the feature touches those, run one child
// process per request instead.

async function coldRequest(instance) {
  const before = calls.length;
  const mod = await import(`${ENTRY}?instance=${instance}`);
  const result = await exercise(mod);
  // Snapshot at the moment the handler resolves. Everything after this point is work a
  // frozen instance would drop, so do not await it settling.
  return { instance, result, landedByResponse: calls.length - before };
}

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

const first = await coldRequest(1);
const second = await coldRequest(2);
const atResponse = calls.length;

await sleep(1000);
const afterWaiting = calls.length;

// --- Assertions --------------------------------------------------------------

const findings = [];

if (first.landedByResponse === 0 || second.landedByResponse === 0) {
  findings.push('A request resolved having produced no side effect. On a frozen instance it never lands.');
}

if (afterWaiting > atResponse) {
  findings.push(`${afterWaiting - atResponse} side effect(s) arrived after the response. A frozen instance drops these: the caller needs a way to await them.`);
}

// ADAPT: assert that request 2 saw none of request 1's state. What "state" means is
// package-specific, so compare the fields that would leak (ids, session handles, counters).
console.log(JSON.stringify({ first, second, atResponse, afterWaiting }, null, 2));

if (findings.length > 0) {
  console.error(`\nFindings:\n${findings.map(f => `  - ${f}`).join('\n')}`);
  process.exitCode = 1;
}
else {
  console.log('\nNo lifetime findings from this harness. Cold-instance boxes only: the warm-instance and browser boxes are separate.');
}
