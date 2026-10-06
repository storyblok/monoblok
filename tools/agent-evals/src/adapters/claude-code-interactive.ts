import fs from "node:fs";
import path from "node:path";
import { getAdapter } from "@netlify/axis";
import { EVALS_DIR } from "../arms.ts";
import { createArmAdapter } from "./claude-code-arm.ts";
import { createInteractiveAdapter } from "./interactive.ts";
import { createSimulator } from "./simulator.ts";

const AUTH_FILES = [".claude.json", ".credentials.json"];

export default createInteractiveAdapter(createArmAdapter(getAdapter("claude-code")), {
  briefFor: (caseId) =>
    fs.readFileSync(path.join(EVALS_DIR, "fixtures/briefs", `${caseId}.md`), "utf8"),
  // Called after the first agent turn, once the base adapter has written the auth files.
  simulatorFor: (input) => {
    const armConfig = input.env?.CLAUDE_CONFIG_DIR ?? "";
    const simConfig = path.join(input.homeDirectory, ".claude-sim");
    fs.mkdirSync(simConfig, { recursive: true });
    for (const file of AUTH_FILES) {
      const from = path.join(armConfig, file);
      if (fs.existsSync(from)) fs.copyFileSync(from, path.join(simConfig, file));
    }
    return createSimulator({ configDir: simConfig });
  },
});
