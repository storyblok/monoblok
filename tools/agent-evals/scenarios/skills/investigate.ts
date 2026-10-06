import { bugCase } from "../../src/cases.ts";
import { investigateScenario } from "../../src/scenarios/investigate.ts";

export default investigateScenario(
  ["cli-single-option-empty-type", "js-client-strip-version-mapi", "richtext-vue-slot-warning"].map(
    bugCase,
  ),
);
