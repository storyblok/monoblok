import { bugCase } from "../../src/cases.ts";
import { triageScenario } from "../../src/scenarios/triage.ts";

export default triageScenario(
  [
    "cli-components-push-preview-tmpl",
    "js-client-strip-version-mapi",
    "js-client-filter-query-brackets",
    "astro-circular-dependency-tdz",
  ].map(bugCase),
);
