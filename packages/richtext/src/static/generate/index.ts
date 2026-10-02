import fs from "node:fs";
import path from "pathe";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { generateRenderMap } from "./richtext-render-map";
import { generateElementTypes } from "./richtext-element-types";
import { execFileSync } from "node:child_process";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const require = createRequire(import.meta.url);

const RENDER_MAP_PATH = path.join(__dirname, "../render-map.generated.ts");
const ELEMENT_TYPES_PATH = path.join(__dirname, "../richtext-element-types.generated.ts");
const TYPES_GEN_PATH = path.join(__dirname, "../../generated/overlay/types.gen.ts");
const OXFMT_BIN = path.join(path.dirname(require.resolve("oxfmt/package.json")), "bin/oxfmt");

// Run the oxfmt bin with Node directly: no shell to split paths that contain
// spaces, and no `pnpm.cmd` shim to resolve on Windows.
function format(filePath: string): void {
  execFileSync(process.execPath, [OXFMT_BIN, filePath], {
    stdio: "inherit",
  });
}

const renderMaps = generateRenderMap();
fs.writeFileSync(RENDER_MAP_PATH, renderMaps, "utf-8");
format(RENDER_MAP_PATH);

const elementTypes = generateElementTypes(TYPES_GEN_PATH);
fs.writeFileSync(ELEMENT_TYPES_PATH, elementTypes, "utf-8");
format(ELEMENT_TYPES_PATH);
