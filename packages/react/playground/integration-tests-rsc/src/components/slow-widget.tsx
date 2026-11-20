/**
 * Plain async Server Component with an artificial delay, standing in for a
 * slow data source. Not a Storyblok component, so it never goes through the
 * bridge. Proves the page streams the fallback and that live editing keeps
 * working while this is pending.
 */
export default async function SlowWidget({ delayMs = 2000 }: { delayMs?: number }) {
  await new Promise((resolve) => setTimeout(resolve, delayMs));

  return <div data-test="slow-widget">Weather: 21°C, sunny (loaded after {delayMs}ms)</div>;
}
