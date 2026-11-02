<script setup>
	const currentYear = new Date().getFullYear();
</script>
<template>
  <main>
    <Suspense>
      <template #default>
        <RouterView />
      </template>
    </Suspense>
  </main>
  <footer>All rights reserved © {{ currentYear }}</footer>
</template>
