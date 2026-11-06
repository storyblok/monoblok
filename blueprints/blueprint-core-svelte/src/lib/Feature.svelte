<script>
	let { block, editable } = $props();
</script>

<div class="feature" {...editable}>
	<span>{block.name}</span>
</div>
