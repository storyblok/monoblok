import { defineConfig } from "oxlint";
import vue from "./vue";

/**
 * Storyblok Nuxt preset.
 *
 * Nuxt's auto-imports require disabling `no-undef`. Vue-plugin rules
 * without an Oxlint port are listed below as comments for future reference.
 */
export default defineConfig({
  extends: [vue],
  rules: {
    "eslint/no-undef": "off",

    // --- Unsupported in Oxlint ---
    //
    // Vue-plugin rules with no Oxlint port:
    //   overrides:
    //     - files: ['**/components/**/*.{js,ts,jsx,tsx,vue}']
    //       rules: { 'vue/multi-word-component-names': 'warn' }
    //     - files: ['**/{pages,layouts}/**/*.{js,ts,jsx,tsx,vue}']
    //       rules: { 'vue/no-multiple-template-root': 'error' }
  },
});
