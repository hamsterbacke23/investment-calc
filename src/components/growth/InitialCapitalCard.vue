<script setup>
import { initialCapital, durationYears, reinvestGains } from '../../composables/useInvestmentStore.js';
</script>

<template>
  <section class="card">
    <h3>Startkapital</h3>
    <div class="input-group">
      <input type="number" v-model.number="initialCapital" step="5000" />
      <input type="range" v-model.number="initialCapital" min="0" max="1000000" step="5000" />
    </div>
    <label>Laufzeit: {{ durationYears }} Jahre</label>
    <input type="range" v-model.number="durationYears" min="1" max="50" />
    <div class="toggle-row">
      <label class="toggle-label">
        <input type="checkbox" v-model="reinvestGains" />
        <span>Erträge wiederanlegen</span>
      </label>
    </div>
  </section>
</template>
