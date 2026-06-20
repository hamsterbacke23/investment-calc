<script setup>
import { ref } from 'vue';
import { Link } from 'lucide-vue-next';
import { encodeState } from '../composables/useInvestmentStore.js';
import ScenarioManager from './ScenarioManager.vue';

const copied = ref(false);

const copyShareLink = async () => {
  const hash = window.location.hash.split('?')[0];
  const url = `${window.location.origin}${window.location.pathname}${hash}?s=${encodeState()}`;
  await navigator.clipboard.writeText(url);
  copied.value = true;
  setTimeout(() => (copied.value = false), 2000);
};
</script>

<template>
  <header class="main-header">
    <div>
      <h1>ETF-Rechner</h1>
      <p>Plane deinen langfristigen Vermögensaufbau</p>
    </div>
    <div class="header-actions">
      <ScenarioManager />
      <button @click="copyShareLink" class="btn-secondary" :class="{ copied }">
        <Link size="18" />{{ copied ? 'Kopiert!' : 'Teilen' }}
      </button>
    </div>
  </header>
</template>
