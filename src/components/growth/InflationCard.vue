<script setup>
import { inflationRate } from '../../composables/useInvestmentStore.js';
</script>

<template>
  <section class="card">
    <div class="card-header">
      <h3>Inflation</h3>
    </div>
    <div class="item-box">
      <div class="flex-row">
        <span class="item-label">{{ inflationRate.toFixed(1) }}% / Jahr</span>
      </div>
      <input type="range" v-model.number="inflationRate" min="0" max="20" step="0.1" />
    </div>
  </section>
</template>
