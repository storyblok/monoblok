"use client";
import React from "react";
import { StoryblokComponent } from "./StoryblokComponent";
import type * as StoryblokComponents from "@/lib/types";
import { useStory } from "@/lib/useStory";

type Component =
  | NonNullable<StoryblokComponents.DefaultPage["body"]>[number]
  | StoryblokComponents.DefaultPage
  | StoryblokComponents.HeadlineSegment
  | StoryblokComponents.Button
  | StoryblokComponents.NavItem
  | StoryblokComponents.ArticlePage;

export function Story({ slug }: { slug: string }) {
  const { story, error, isLoading } = useStory<Component>(slug);

  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>Error: {error.message}</div>;
  if (!story) return <div>No story found</div>;

  return <StoryblokComponent blok={story.content as Component} story={story} />;
}
