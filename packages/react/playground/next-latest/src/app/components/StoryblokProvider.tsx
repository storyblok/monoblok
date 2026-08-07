"use client";

import type { ReactNode } from "react";
import { getStoryblokApi } from "@/lib/storyblok";

export default function StoryblokProvider({ children }: { children: ReactNode }) {
  getStoryblokApi();
  return children;
}