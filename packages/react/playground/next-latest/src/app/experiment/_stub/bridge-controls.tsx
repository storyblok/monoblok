'use client';

// STUB — the edit control for the faked bridge. Stands in for the Storyblok
// visual editor: edit the story JSON, press Submit, and it emits a bridge
// `input` event with the new story through the same path the real editor uses.
// Not part of the real SDK; deleted together with `bridge.ts` in production.
import { useState } from 'react';
import { emitStoryUpdate } from './bridge';
import type { Story } from '../_sdk/types';

const panel: React.CSSProperties = {
  margin: '16px 0',
  padding: 16,
  border: '2px dashed #6b7280',
  borderRadius: 8,
  background: '#f9fafb',
};

const textarea: React.CSSProperties = {
  width: '100%',
  minHeight: 220,
  fontFamily: 'ui-monospace, monospace',
  fontSize: 12,
  color: '#111827',
  background: '#ffffff',
  border: '1px solid #9ca3af',
  borderRadius: 6,
  padding: 10,
  boxSizing: 'border-box',
  resize: 'vertical',
};

const button: React.CSSProperties = {
  marginTop: 10,
  padding: '10px 18px',
  background: '#2563eb',
  color: '#ffffff',
  border: 'none',
  borderRadius: 8,
  fontSize: 14,
  fontWeight: 600,
  cursor: 'pointer',
};

export function BridgeControls({ initialStory }: { initialStory: Story }) {
  const [json, setJson] = useState(() => JSON.stringify(initialStory, null, 2));
  const [error, setError] = useState<string | null>(null);

  function submit() {
    try {
      const story = JSON.parse(json) as Story;
      setError(null);
      emitStoryUpdate(story);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  return (
    <div style={panel}>
      <div style={{ fontFamily: 'monospace', fontSize: 12, color: '#374151', marginBottom: 8 }}>
        [BridgeControls] (stub) — edit the story JSON and Submit to fake a
        live-preview bridge update
      </div>
      <textarea
        style={textarea}
        value={json}
        onChange={(e) => setJson(e.target.value)}
        spellCheck={false}
        data-testid="story-json"
      />
      <div>
        <button style={button} onClick={submit} data-testid="submit-story">
          Submit
        </button>
      </div>
      {error && (
        <div style={{ marginTop: 8, color: '#b91c1c', fontFamily: 'monospace', fontSize: 12 }}>
          Invalid JSON: {error}
        </div>
      )}
    </div>
  );
}
