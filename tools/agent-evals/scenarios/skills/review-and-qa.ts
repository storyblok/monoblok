import { bugCase } from "../../src/cases.ts";
import { reviewAndQaScenario } from "../../src/scenarios/review-and-qa.ts";

export default reviewAndQaScenario(
  ["cli-components-push-preview-tmpl", "react-rsc-bridge-exports", "richtext-vue-slot-warning"].map(
    bugCase,
  ),
);
