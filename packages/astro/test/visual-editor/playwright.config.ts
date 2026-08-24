import { createPlaywrightConfig } from "@storyblok/visual-editor-qa";
import { QA_CONFIG } from "./qa.config";

// `astro dev` daemonizes when stdout is not a TTY, so a bare `astro dev` exits
// immediately and Playwright would call that an early exit. `qa:dev` starts the
// daemon and then follows its logs, which is the long-running process Playwright
// waits on. Teardown kills the log tail, not the server; `reuseExistingServer`
// picks it up next run, and `qa:stop` ends it.
export default createPlaywrightConfig(QA_CONFIG);
