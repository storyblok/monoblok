import { defineConfig } from "oxlint";
import base from "./src/base";

export default defineConfig({
  extends: [base],
  ignorePatterns: ["dist/", "node_modules/"],
});
