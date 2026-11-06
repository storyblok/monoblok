<script module lang="ts">
  let warned = false;
</script>

<script lang="ts">
  const { warnings }: { warnings: boolean } = $props();

  // Without a renderer the blok's content silently goes missing, so this warns
  // by default. Runs on the server and in the browser, printing once per
  // environment. `warned` is only set when the warning prints, so an instance
  // with `warnings={false}` doesn't silence the others.
  function warnOnce() {
    if (!warnings || warned) return;
    warned = true;
    console.warn('[storyblok] "blok" nodes require a custom renderer passed through `components.blok`.');
  }

  // Effects don't run during SSR, so check once up front on the server.
  if (typeof window === 'undefined') warnOnce();
  $effect(warnOnce);
</script>
