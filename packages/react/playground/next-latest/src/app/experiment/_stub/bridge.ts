// STUB #1 (of 2) — the live-preview bridge.
//
// Mimics `@storyblok/live-preview`'s `onStoryblokEditorEvent(cb): () => cleanup`
// contract with a plain in-page event emitter. In production this file is
// deleted and the hook imports `onStoryblokEditorEvent` instead.
import type { Story } from '../_sdk/types';

type Listener = (story: Story) => void;

const listeners = new Set<Listener>();

export function subscribeToLivePreview(callback: Listener): () => void {
  listeners.add(callback);
  return () => {
    listeners.delete(callback);
  };
}

export function emitStoryUpdate(story: Story): void {
  listeners.forEach((listener) => listener(story));
}
