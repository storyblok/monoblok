import unjs from "eslint-config-unjs";

export default [
  {
    ignores: ["**/node_modules/**", "**/coverage/**", "**/dist/**"],
  },
  ...unjs(),
];
