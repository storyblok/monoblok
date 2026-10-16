<script>
	let { children } = $props();
</script>

<svelte:head>
	<link
		rel="stylesheet"
		href="https://a.storyblok.com/f/212319/x/e6ccda03b8/blueprint-blank.css"
	/>
</svelte:head>

{@render children()}
