<script setup>
import { inflationRate } from '../../composables/useInvestmentStore.js';
import { totalInvested, finalBalance, taxInfo } from '../../composables/useGrowthCalculations.js';
</script>

<template>
  <div class="stats-grid">
    <div class="stat-card">
      <label>Total Invested</label>
      <h2>{{ totalInvested.toLocaleString() }} €</h2>
    </div>
    <div class="stat-card highlighted">
      <label>Final Balance</label>
      <h2>{{ finalBalance.toLocaleString() }} €</h2>
      <span class="tax-note" v-if="taxInfo.tax > 0">
        After tax (DE): {{ taxInfo.afterTax.toLocaleString() }} €
        <small>(−{{ taxInfo.tax.toLocaleString() }} € · {{ taxInfo.effectiveRate }}% eff.)</small>
      </span>
      <span class="inflation-note">
        ≈ {{ taxInfo.inTodaysMoney.toLocaleString() }} € in today's money
        <small>({{ inflationRate.toFixed(1) }}% inflation)</small>
      </span>
    </div>
    <div class="stat-card monthly-card">
      <label>View Withdrawal Plan</label>
      <RouterLink to="/withdrawal" class="btn-view-plan">
        Entnahmeplan <span class="arrow">→</span>
      </RouterLink>
      <span class="plan-note">Calculate monthly income</span>
    </div>
  </div>
</template>
