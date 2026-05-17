<script setup>
import { RouterView } from 'vue-router';
import AppHeader from './components/AppHeader.vue';
import TabNav from './components/TabNav.vue';
import { useTouchDevice } from './composables/useTouchDevice.js';
import { initInvestmentStore } from './composables/useInvestmentStore.js';

initInvestmentStore();
const { isTouchDevice } = useTouchDevice();
</script>

<template>
  <div class="app-container" :class="{ 'touch-device': isTouchDevice }">
    <AppHeader />
    <TabNav />
    <RouterView />
  </div>
</template>
