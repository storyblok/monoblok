"use client";

import type { ReactNode } from "react";
import { getStoryblokApi } from "@/lib/storyblok";

// Mirrors the blueprint's client provider on purpose: it also runs
// `storyblokInit` in the SSR and browser module graphs, which must not
// interfere with live editing.
export default function StoryblokProvider({ children }: { children: ReactNode }) {
  getStoryblokApi();
  return children;
}
