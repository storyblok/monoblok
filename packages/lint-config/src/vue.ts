import { defineConfig } from "oxlint";
import base from "./base";

/**
 * Storyblok Vue preset.
 *
 * Stylistic Vue rules that would normally live here are deferred to
 * `vp fmt` (Oxfmt) and listed below as comments for future reference.
 */
export default defineConfig({
  extends: [base],
  plugins: ["vue"],
  rules: {
    // --- Unsupported in Oxlint ---
    //
    // Stylistic — formatter territory:
    //   'vue/max-attributes-per-line': ['error', { singleline: { max: 10 }, multiline: { max: 1 } }]
    //   'vue/singleline-html-element-content-newline': 'off'
    //   'vue/html-self-closing': ['warn', { html: { void: 'always', normal: 'never' } }]
    //   'vue/object-property-newline': ['error', { allowAllPropertiesOnSameLine: true }]
  },
});
