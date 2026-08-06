// REAL — page wiring. The story comes from the client-response stub; the
// `render` server action resolves it through the registry; `StoryblokView`
// renders it (and mounts the live-preview island when `?lp=1`). The only
// stubbed pieces are the imports from `../_stub` (client response + bridge).
import { StoryblokView } from '../_sdk/storyblok-view';
import { StoryblokServerComponent } from '../_sdk/storyblok-component';
import { components } from '../_bloks';
import { initialStory } from '../_stub/client-response';
import { BridgeControls } from '../_stub/bridge-controls';
import type { Story } from '../_sdk/types';

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function Route({ searchParams }: PageProps) {
  const sp = await searchParams;
  const livePreview = sp.lp === '1';

  const story = initialStory;

  // Single "use server" action that re-renders the whole story through the
  // registry. The live-preview island re-invokes it for each bridge update.
  async function render(updated: Story) {
    'use server';
    return <StoryblokServerComponent blok={updated.content} components={components} />;
  }

  return (
    <main
      style={{
        minHeight: '100vh',
        background: '#ffffff',
        color: '#111827',
        colorScheme: 'light',
      }}
    >
      <div style={{ padding: 24, fontFamily: 'system-ui', maxWidth: 880, margin: '0 auto' }}>
      <h1>Experiment: registry-driven RSC live preview</h1>
      <p style={{ fontSize: 14, color: '#1f2937', lineHeight: 1.5 }}>
        livePreview={String(livePreview)} (toggle with <code>?lp=1</code>). Blue =
        server blok, orange = client blok, purple = client context. Only the{' '}
        <code>_stub/</code> client response and bridge are faked; the registry,
        recursive resolver, blok components, <code>StoryblokView</code> and the
        live-preview island are real-SDK-shaped. In live preview, edit the story
        JSON below and press Submit to fake a bridge update — the whole nested
        tree re-renders while client state (card toggle, leaf input) survives.
      </p>
      {livePreview && <BridgeControls initialStory={story} />}
      <StoryblokView story={story} render={render} livePreview={livePreview} />
      </div>
    </main>
  );
}
