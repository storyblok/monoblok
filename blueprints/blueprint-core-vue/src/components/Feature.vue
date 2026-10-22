<script setup>
defineProps({ blok: Object });
</script>

<template>
  <div class="feature" v-editable="blok">
    <span>{{ blok.name }}</span>
  </div>
</template>
