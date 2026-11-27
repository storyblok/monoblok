<script lang="ts">
  // Imports a block component before the registry that it imports back from.
  // Under Vite's dev/HMR output this is the order in which a registry that
  // reads `components` eagerly throws `Cannot access 'Page' before
  // initialization` in the browser. Guarded by `e2e/index.spec.ts`.
  import Page from '../../components/blocks/Page.svelte';

  const block = {
    _uid: 'page',
    component: 'page',
    richText: undefined,
    body: [{ _uid: 'teaser', component: 'teaser', headline: 'Rendered through the cycle' }],
  };
</script>

<Page {block} />
