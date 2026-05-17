<script setup>
import { inflationRate } from '../../composables/useInvestmentStore.js';
import { totalInvested, finalBalance, taxInfo } from '../../composables/useGrowthCalculations.js';
import { withdrawalTaxInfo } from '../../composables/useWithdrawalPlan.js';
</script>

<template>
  <div class="stats-grid stats-grid--split">
    <div class="stat-card">
      <label>Total Invested</label>
      <h2>{{ totalInvested.toLocaleString() }} €</h2>
    </div>

    <div class="stat-card highlighted final-balance-card">
      <label>Final Balance</label>
      <h2 class="final-balance-headline">{{ finalBalance.toLocaleString() }} €</h2>

      <dl class="balance-breakdown">
        <div v-if="taxInfo.tax > 0" class="breakdown-row">
          <dt>After tax <span class="muted">(DE ETF)</span></dt>
          <dd>
            <span class="delta delta-neg">−{{ taxInfo.tax.toLocaleString() }} € · {{ taxInfo.effectiveRate }}%</span>
            <span class="amount">{{ taxInfo.afterTax.toLocaleString() }} €</span>
          </dd>
        </div>

        <div class="breakdown-row">
          <dt>Today's purchasing power</dt>
          <dd>
            <span class="delta">at {{ inflationRate.toFixed(1) }}% inflation</span>
            <span class="amount">{{ taxInfo.inTodaysMoney.toLocaleString() }} €</span>
          </dd>
        </div>
      </dl>
    </div>
  </div>

  <RouterLink to="/withdrawal" class="withdrawal-cta">
    <div class="cta-text">
      <span class="cta-label">Plan the withdrawal phase</span>
      <span class="cta-headline">
        ≈ {{ withdrawalTaxInfo.monthlyNet.toLocaleString() }} € / month
        <span class="cta-detail">net for 30 years</span>
      </span>
    </div>
    <span class="cta-arrow" aria-hidden="true">→</span>
  </RouterLink>
</template>
