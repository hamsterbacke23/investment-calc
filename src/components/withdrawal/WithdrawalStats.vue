<script setup>
import { withdrawalTaxInfo } from '../../composables/useWithdrawalPlan.js';
</script>

<template>
  <div class="stats-grid">
    <div class="stat-card monthly-card">
      <label>Monthly Withdrawal</label>
      <h2>{{ withdrawalTaxInfo.monthlyNet.toLocaleString() }} €</h2>
      <span class="tax-note">{{ withdrawalTaxInfo.annualNet.toLocaleString() }} € per year</span>
      <RouterLink to="/growth" class="btn-back">← Back to Growth Phase</RouterLink>
    </div>
  </div>
</template>
