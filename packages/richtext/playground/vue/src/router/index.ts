import { createMemoryHistory, createRouter } from 'vue-router';
import HomeView from '../components/HomeView.vue';
import NotFound from '../components/NotFound.vue';

const routes = [
  { path: '/', component: HomeView },
  { path: '/:pathMatch(.*)*', name: 'NotFound', component: NotFound },
];

export const router = createRouter({
  history: createMemoryHistory(),
  routes,
});
