import type { Component } from "../components/constants";
import type { Story } from "./constants";
import { loadComponents } from "../components/loader";
import { FileSystemError } from "../../utils/error/filesystem-error";

/**
 * @method isStoryPublishedWithoutChanges
 * @param  {object} story
 * @return {boolean}
 */
export const isStoryPublishedWithoutChanges = (story: Partial<Story>) => {
  return story.published && !story.unpublished_changes;
};

/**
 * @method isStoryWithUnpublishedChanges
 * @param  {object} story
 * @return {boolean}
 */
export const isStoryWithUnpublishedChanges = (story: Partial<Story>) => {
  return story.published && story.unpublished_changes;
};

export const findComponentSchemas = async (directoryPath: string) => {
  try {
    const { components } = await loadComponents(directoryPath);
    const schemas: Record<Component["name"], Component["schema"]> = {};
    for (const component of components) {
      schemas[component.name] = component.schema;
    }
    return schemas;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return {};
    }
    if (error instanceof FileSystemError) {
      error.message = `Failed to load component schemas for content validation.\n\n${error.message}`;
      throw error;
    }
    throw error;
  }
};

/**
 * A slug is remote data, so a path separator in it would escape the stories
 * directory. Replacing separators is enough to keep the result a single path
 * segment; anything else that survives here is a legal file name character and
 * must be preserved, or the file no longer round-trips to the story it came
 * from.
 */
const toPathSegment = (value: string): string => value.replace(/[/\\]+/g, "-");

/**
 * @method getStoryFilename
 * @param  {object} story - Story object with slug and uuid
 * @return {string} Filename in the format {slug}_{uuid}.json
 */
export const getStoryFilename = (story: Pick<Story, "slug" | "uuid">) => {
  return `${toPathSegment(story.slug)}_${toPathSegment(story.uuid)}.json`;
};
