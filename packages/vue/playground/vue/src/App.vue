<script setup lang="ts">
import { watch } from 'vue';
import { useRoute } from 'vue-router';

const route = useRoute();
function setBodyClass(routeName: string) {
  document.title = `Core Playground - ${routeName}`;
  document.body.className = routeName;
}
watch([route], () => setBodyClass(route.name?.toString() ?? ''));
</script>

<template>
  <Suspense>
    <template #default>
      <div class="prose mx-auto">
        <nav>
          <ul class="flex gap-4 list-none">
            <li>
              <RouterLink to="/">Home</RouterLink>
            </li>
            <li>
              <RouterLink to="/vue/test-richtext">Richtext</RouterLink>
            </li>
          </ul>
        </nav>
        <RouterView />
      </div>
     
    </template>

    <template #fallback>
      <div>Loading...</div>
    </template>
  </Suspense>
</template>
