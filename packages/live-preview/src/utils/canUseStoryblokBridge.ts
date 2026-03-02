import { isBrowser } from './isBrowser';
import { isInEditor } from './isInEditor';

export function canUseStoryblokBridge(): boolean {
  if (!isBrowser()) {
    return false;
  }
  return isInEditor(new URL(window.location.href));
}
