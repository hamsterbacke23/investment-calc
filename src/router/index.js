import { createRouter, createWebHashHistory } from 'vue-router';
import GrowthView from '../views/GrowthView.vue';
import WithdrawalView from '../views/WithdrawalView.vue';

const routes = [
  { path: '/', redirect: '/growth' },
  { path: '/growth', name: 'growth', component: GrowthView },
  { path: '/withdrawal', name: 'withdrawal', component: WithdrawalView },
];

// Hash history avoids needing server-side rewrites under /investment-calc/
export const router = createRouter({
  history: createWebHashHistory(),
  routes,
});
