<script setup>
defineProps({blok: Object})
</script>

<template>
	<StoryblokComponent v-for="currentBlok in blok.body":key="currentBlok._uid" :blok="currentBlok" />
</template>