<script setup>
import { withdrawalPlanYears } from '../../composables/useInvestmentStore.js';
import { withdrawalTaxInfo } from '../../composables/useWithdrawalPlan.js';
</script>

<template>
  <div class="stats-grid stats-grid--split">
    <div class="stat-card">
      <label>Annual Net Income</label>
      <h2>{{ withdrawalTaxInfo.annualNet.toLocaleString() }} €</h2>
      <span class="tax-note">over {{ withdrawalPlanYears }} years</span>
    </div>

    <div class="stat-card highlighted final-balance-card">
      <label>Monthly Net Income</label>
      <h2 class="final-balance-headline">{{ withdrawalTaxInfo.monthlyNet.toLocaleString() }} €</h2>

      <dl class="balance-breakdown">
        <div class="breakdown-row">
          <dt>Gross monthly withdrawal</dt>
          <dd>
            <span class="delta">before tax</span>
            <span class="amount">{{ withdrawalTaxInfo.monthlyGross.toLocaleString() }} €</span>
          </dd>
        </div>

        <div v-if="withdrawalTaxInfo.totalTax > 0" class="breakdown-row">
          <dt>After tax <span class="muted">(DE ETF)</span></dt>
          <dd>
            <span class="delta delta-neg">−{{ (withdrawalTaxInfo.monthlyGross - withdrawalTaxInfo.monthlyNet).toLocaleString() }} € · {{ withdrawalTaxInfo.effectiveRate }}%</span>
            <span class="amount">{{ withdrawalTaxInfo.monthlyNet.toLocaleString() }} €</span>
          </dd>
        </div>
      </dl>
    </div>
  </div>

  <RouterLink to="/growth" class="withdrawal-cta withdrawal-cta--back">
    <span class="cta-arrow" aria-hidden="true">←</span>
    <div class="cta-text">
      <span class="cta-label">Back to growth phase</span>
      <span class="cta-headline">Adjust contributions &amp; returns</span>
    </div>
  </RouterLink>
</template>
