// STUB #1 (of 2) — the live-preview bridge.
//
// Mimics `@storyblok/live-preview`'s `onStoryblokEditorEvent(cb): () => cleanup`
// contract with a plain in-page event emitter. In production this file is
// deleted and the island imports `onStoryblokEditorEvent` instead; the editor
// iframe delivers `input` events with the updated story.
import type { Story } from '../_sdk/types';

type Listener = (story: Story) => void;

const listeners = new Set<Listener>();

// Real shape: subscribe a callback, get an unsubscribe function back.
export function subscribeToLivePreview(callback: Listener): () => void {
  listeners.add(callback);
  return () => {
    listeners.delete(callback);
  };
}

// Stub-only: the bridge controls call this to fake an editor `input` event.
// The real bridge has no client-side emitter — the editor pushes the event.
export function emitStoryUpdate(story: Story): void {
  listeners.forEach((listener) => listener(story));
}
