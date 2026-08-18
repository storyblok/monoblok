// Asserts the scenario defines a component for every component the playground
// can render. A missing component does not fail the seed — the CLI pushes the
// stories happily and the playground renders an empty <component :is>.
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const scenarioDir = import.meta.dirname;
const playgroundComponentsDir = join(scenarioDir, "../../../playground/app/storyblok");

const toComponentName = (fileName) =>
  fileName
    .replace(/\.vue$/, "")
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .toLowerCase();

const collectPlaygroundComponents = (dir) =>
  readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    if (entry.isDirectory()) {
      // A directory component is named after the directory (iframe-embed/index.vue).
      const nested = readdirSync(join(dir, entry.name));
      return nested.includes("index.vue")
        ? [entry.name]
        : collectPlaygroundComponents(join(dir, entry.name));
    }
    return entry.name.endsWith(".vue") ? [toComponentName(entry.name)] : [];
  });

const seeded = readdirSync(join(scenarioDir, "components")).map((f) => f.replace(/\.json$/, ""));
const rendered = collectPlaygroundComponents(playgroundComponentsDir);
const missing = rendered.filter((name) => !seeded.includes(name));

// Every seeded component must also parse and carry the CLI's required key.
for (const file of readdirSync(join(scenarioDir, "components"))) {
  const json = JSON.parse(readFileSync(join(scenarioDir, "components", file), "utf8"));
  if (!("component_group_uuid" in json)) {
    console.log(JSON.stringify({ outcome: "FAIL", details: `${file} lacks component_group_uuid` }));
    process.exit(1);
  }
}

console.log(
  JSON.stringify({
    outcome: missing.length === 0 ? "PASS" : "FAIL",
    total: rendered.length,
    returned: rendered.length - missing.length,
    details: missing.length
      ? `missing components: ${missing.join(", ")}`
      : "all playground components seeded",
  }),
);
process.exit(missing.length === 0 ? 0 : 1);
