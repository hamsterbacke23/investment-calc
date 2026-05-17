<script setup>
import { computed } from 'vue';
import {
  withdrawalPlanYears,
  inflationRate,
  durationYears,
} from '../../composables/useInvestmentStore.js';
import { withdrawalTaxInfo } from '../../composables/useWithdrawalPlan.js';
import { inflationAdjusted } from '../../utils/tax.js';

const monthlyTax = computed(() =>
  withdrawalTaxInfo.value.monthlyGross - withdrawalTaxInfo.value.monthlyNet,
);

const monthlyNetToday = computed(() =>
  Math.round(
    inflationAdjusted(
      withdrawalTaxInfo.value.monthlyNet,
      inflationRate.value,
      durationYears.value,
    ),
  ),
);
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
        <div v-if="withdrawalTaxInfo.totalTax > 0" class="breakdown-row">
          <dt>Gross monthly <span class="muted">(before tax)</span></dt>
          <dd>
            <span class="delta delta-neg">−{{ monthlyTax.toLocaleString() }} € tax · {{ withdrawalTaxInfo.effectiveRate }}%</span>
            <span class="amount">{{ withdrawalTaxInfo.monthlyGross.toLocaleString() }} €</span>
          </dd>
        </div>

        <div class="breakdown-row">
          <dt>Today's purchasing power</dt>
          <dd>
            <span class="delta">at {{ inflationRate.toFixed(1) }}% inflation</span>
            <span class="amount">{{ monthlyNetToday.toLocaleString() }} €</span>
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
