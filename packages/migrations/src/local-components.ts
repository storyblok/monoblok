import type { Component } from '@storyblok/management-api-client/resources/components';

import { readLocalJsonFiles, writeLocalJsonFile } from './local-utils';

function getComponentFilename(component: Pick<Component, 'name'>): string {
  return `${component.name}.json`;
}

export async function getLocalComponents(dir: string): Promise<Component[]> {
  return readLocalJsonFiles<Component>(dir);
}

export async function updateLocalComponent(
  dir: string,
  component: Component,
): Promise<void> {
  await writeLocalJsonFile(dir, getComponentFilename(component), component);
}
