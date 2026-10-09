import { createAccessibilityChecker } from "@storyblok/accessibility-checker";
import { createApp } from "vue";

import App from "./App.vue";

const accessibilityChecker = createAccessibilityChecker({
  // allowedOrigins: [/^https?:\/\/localhost(:\d+)?$/],
  // ruleTags: ["wcag2a", "wcag2aa"]
});
accessibilityChecker.enable();

createApp(App).mount("#app");
