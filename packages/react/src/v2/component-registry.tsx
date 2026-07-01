import type { ComponentType, ReactNode } from 'react';

export interface SbBlokData {
  _uid: string;
  component: string;
  _editable?: string;
  [key: string]: unknown;
}

type StoryblokComponentType = ComponentType<{ blok: any }>;

export interface RegistryConfig {
  components: Record<string, StoryblokComponentType>;
  fallback?: StoryblokComponentType;
}

export interface RegistryResult {
  StoryblokComponent: ComponentType<{ blok: SbBlokData }>;
  StoryblokBlocks: ComponentType<{ blocks: SbBlokData[] }>;
  resolve: (name: string) => StoryblokComponentType | null;
}

export function createRegistry(config: RegistryConfig): RegistryResult {
  const resolve = (name: string): StoryblokComponentType | null => {
    return config.components[name] ?? config.fallback ?? null;
  };

  function StoryblokComponent({ blok }: { blok: SbBlokData }): ReactNode {
    const Component = resolve(blok.component);
    if (!Component) {
      console.warn(`[Storyblok] Unknown component: ${blok.component}`);
      return null;
    }
    return <Component blok={blok} />;
  }

  function StoryblokBlocks({ blocks }: { blocks: SbBlokData[] }): ReactNode {
    if (!blocks || blocks.length === 0) {
      return null;
    }

    return (
      <>
        {blocks.map(blok => (
          <StoryblokComponent key={blok._uid} blok={blok} />
        ))}
      </>
    );
  }

  return {
    StoryblokComponent,
    StoryblokBlocks,
    resolve,
  };
}
