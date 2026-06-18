<script setup>
import { finalBalance } from '../../composables/useGrowthCalculations.js';
import { formatEUR } from '../../utils/tax.js';
</script>

<template>
  <section class="card">
    <h3>Startguthaben</h3>
    <div class="balance-display">
      <h2 class="balance-value">{{ formatEUR(finalBalance) }}</h2>
      <span class="balance-note">aus der Ansparphase</span>
    </div>
  </section>
</template>
