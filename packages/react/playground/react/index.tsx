import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";

// SDK is initialised in lib/storyblok.ts — imported transitively via pages/components.

const container = document.getElementById("app")!;
const root = createRoot(container);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
