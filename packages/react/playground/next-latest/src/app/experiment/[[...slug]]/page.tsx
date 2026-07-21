// REAL — page wiring. The story comes from the client-response stub. Toggle
// preview with `?lp=1`. Production path renders the registry directly from an
// RSC; preview path delegates to the client-side `StoryblokPreview` which
// subscribes to the bridge and re-renders the whole tree client-side.
//
// The ONLY stubbed pieces are imports from `../_stub` (client response +
// fake bridge); the SDK (`_sdk`), registry, and bloks are Dipankar's actual
// pattern.
import { storyblok } from '../_bloks/registry';
import { StoryblokPreview } from '../_bloks/storyblok-preview';
import { initialStory } from '../_stub/client-response';
import { BridgeControls } from '../_stub/bridge-controls';

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function Route({ searchParams }: PageProps) {
  const sp = await searchParams;
  const livePreview = sp.lp === '1';
  const story = initialStory;

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
        <h1>Experiment: Dipankar-style live preview (client-rerender)</h1>
        <p style={{ fontSize: 14, color: '#1f2937', lineHeight: 1.5 }}>
          livePreview={String(livePreview)} (toggle with <code>?lp=1</code>). Blue =
          server blok, orange = client blok, purple = client context, green =
          async blok, red dashed = fallback / server-only loss. Only the{' '}
          <code>_stub/</code> client response and bridge are faked; the SDK
          (<code>_sdk/</code>), registry and bloks follow Dipankar&apos;s real
          design. In live preview, edit the JSON below and press Submit to fake
          a bridge update — the whole tree re-renders <em>on the client</em>.
        </p>
        {livePreview && <BridgeControls initialStory={story} />}
        {livePreview ? (
          <StoryblokPreview story={story} />
        ) : (
          <storyblok.StoryblokComponent blok={story.content} />
        )}
      </div>
    </main>
  );
}
