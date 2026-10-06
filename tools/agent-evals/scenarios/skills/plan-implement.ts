import { bugCase } from "../../src/cases.ts";
import { planImplementScenario } from "../../src/scenarios/plan-implement.ts";

export default planImplementScenario(
  [
    "cli-single-option-empty-type",
    "js-client-strip-version-mapi",
    "richtext-styled-link-shattered",
  ].map(bugCase),
);
