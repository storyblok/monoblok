import { getComponentFilename } from "@storyblok/utils/local-files";

import type { Component } from "./types";

import { readLocalJsonFiles, writeLocalJsonFile } from "./local-utils";

export async function getLocalComponents(dir: string): Promise<Component[]> {
  return readLocalJsonFiles<Component>(dir);
}

export async function updateLocalComponent(dir: string, component: Component): Promise<void> {
  await writeLocalJsonFile(dir, getComponentFilename(component), component);
}
