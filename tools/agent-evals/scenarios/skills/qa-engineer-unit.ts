import { bugCase } from "../../src/cases.ts";
import { qaEngineerUnitScenario } from "../../src/scenarios/qa-engineer-unit.ts";

export default qaEngineerUnitScenario(
  [
    "cli-components-push-preview-tmpl",
    "js-client-filter-query-brackets",
    "astro-circular-dependency-tdz",
  ].map(bugCase),
);
