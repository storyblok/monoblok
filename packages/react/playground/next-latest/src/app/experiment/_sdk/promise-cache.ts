// REAL — Dipankar's promise cache, inlined verbatim.
// Source: https://github.com/dipankarmaikap/storyblok-react-sdk/blob/main/packages/react/src/promise-cache.ts
export function createPromiseCache(maxSize = 1000) {
  const cache = new Map<string, Map<unknown, Promise<unknown>>>();

  function getOrSet(promise: Promise<unknown>, key: unknown, namespace: string) {
    let ns = cache.get(namespace);
    if (!ns) {
      ns = new Map();
      cache.set(namespace, ns);
    }
    let cached = ns.get(key);
    if (!cached) {
      if (ns.size >= maxSize) {
        const first = ns.keys().next().value;
        if (first !== undefined) ns.delete(first);
      }
      cached = promise.catch((err: unknown) => {
        ns!.delete(key);
        throw err;
      });
      ns.set(key, cached);
    }
    return cached;
  }

  return { getOrSet };
}
