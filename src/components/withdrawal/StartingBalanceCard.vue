<script setup>
import { finalBalance } from '../../composables/useGrowthCalculations.js';
</script>

<template>
  <section class="card">
    <h3>Startguthaben</h3>
    <div class="balance-display">
      <h2 class="balance-value">{{ finalBalance.toLocaleString() }} €</h2>
      <span class="balance-note">aus der Ansparphase</span>
    </div>
  </section>
</template>
