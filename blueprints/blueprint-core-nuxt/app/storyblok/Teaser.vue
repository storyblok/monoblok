<script setup>
defineProps({ blok: Object });
</script>

<template>
	<div class="teaser" v-editable="blok">
		<h2>{{ blok.headline }}</h2>
	</div>
</template>
