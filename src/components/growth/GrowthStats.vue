<script setup>
import { inflationRate, withdrawalPlanYears, durationYears } from '../../composables/useInvestmentStore.js';
import { totalInvested, finalBalance, finalBalanceReal } from '../../composables/useGrowthCalculations.js';
import { withdrawalTaxInfo } from '../../composables/useWithdrawalPlan.js';
import { formatEUR } from '../../utils/tax.js';
</script>

<template>
  <div class="stats-grid stats-grid--split">
    <div class="stat-card">
      <label>Eingezahlt insgesamt</label>
      <h2>{{ formatEUR(totalInvested) }}</h2>
    </div>

    <div class="stat-card highlighted final-balance-card">
      <label>Endkapital</label>
      <h2 class="final-balance-headline">{{ formatEUR(finalBalance) }}</h2>

      <dl class="balance-breakdown">
        <div class="breakdown-row">
          <dt>Heutige Kaufkraft</dt>
          <dd>
            <span class="delta">bei {{ inflationRate.toFixed(1) }}% Inflation über {{ durationYears }} Jahre</span>
            <span class="amount">{{ formatEUR(finalBalanceReal) }}</span>
          </dd>
        </div>
      </dl>
    </div>
  </div>

  <RouterLink to="/withdrawal" class="withdrawal-cta">
    <div class="cta-text">
      <span class="cta-label">Entnahmephase planen</span>
      <span class="cta-headline">
        ≈ {{ formatEUR(withdrawalTaxInfo.monthlyNet) }} / Monat
        <span class="cta-detail">netto über {{ withdrawalPlanYears }} Jahre</span>
      </span>
    </div>
    <span class="cta-arrow" aria-hidden="true">→</span>
  </RouterLink>
</template>
