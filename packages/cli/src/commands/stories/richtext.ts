/**
 * Walks a richtext AST and invokes `onBlok` for every content node embedded in
 * a `type: 'blok'` attrs.body array. Read-only: does not reconstruct the tree.
 *
 * Ref-mapper has its own richtext traversal because it also remaps `type: 'link'`
 * story uuids and must return a new tree with mapped references. Extract a
 * shared map-with-rebuild helper only once that walker grows a second consumer.
 */
export const walkRichtextBloks = (node: unknown, onBlok: (blok: unknown) => void): void => {
  if (Array.isArray(node)) {
    for (const item of node) {
      walkRichtextBloks(item, onBlok);
    }
    return;
  }
  if (!node || typeof node !== "object") {
    return;
  }

  const obj = node as Record<string, unknown>;
  if (obj.type === "blok" && obj.attrs && typeof obj.attrs === "object") {
    const body = (obj.attrs as Record<string, unknown>).body;
    if (Array.isArray(body)) {
      for (const blok of body) {
        onBlok(blok);
      }
    }
  }
  for (const value of Object.values(obj)) {
    walkRichtextBloks(value, onBlok);
  }
};
