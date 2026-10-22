<script setup>
defineProps({ blok: Object });
</script>

<template>
	<div class="grid" v-editable="blok">
		<StoryblokComponent
			v-for="currentBlok in blok.columns"
			:key="currentBlok._uid"
			:blok="currentBlok"
		/>
	</div>
</template>
