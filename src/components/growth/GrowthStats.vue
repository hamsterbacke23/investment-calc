<script setup>
import { inflationRate, withdrawalPlanYears, durationYears, returnScenario } from '../../composables/useInvestmentStore.js';
import {
  totalInvested,
  finalBalance,
  finalBalanceReal,
  finalBalanceWorst,
  finalBalanceBest,
  hasReturnBand,
} from '../../composables/useGrowthCalculations.js';
import { withdrawalTaxInfo } from '../../composables/useWithdrawalPlan.js';
import { formatEUR } from '../../utils/tax.js';

const scenarioLabel = { worst: 'Worst Case', avg: 'Mittelwert', best: 'Best Case' };
</script>

<template>
  <div class="stats-grid stats-grid--split">
    <div class="stat-card">
      <label>Eingezahlt insgesamt</label>
      <h2>{{ formatEUR(totalInvested) }}</h2>
    </div>

    <div class="stat-card highlighted final-balance-card">
      <label>
        Endkapital
        <span v-if="hasReturnBand" class="scenario-tag">{{ scenarioLabel[returnScenario] }}</span>
      </label>
      <h2 class="final-balance-headline">{{ formatEUR(finalBalance) }}</h2>

      <dl class="balance-breakdown">
        <div class="breakdown-row">
          <dt>Heutige Kaufkraft</dt>
          <dd>
            <span class="delta">bei {{ inflationRate.toFixed(1) }}% Inflation über {{ durationYears }} Jahre</span>
            <span class="amount">{{ formatEUR(finalBalanceReal) }}</span>
          </dd>
        </div>
        <div v-if="hasReturnBand" class="breakdown-row">
          <dt>Bandbreite <span class="muted">Worst – Best</span></dt>
          <dd>
            <span class="delta">je nach Renditeverlauf</span>
            <span class="amount amount--range">{{ formatEUR(finalBalanceWorst) }} – {{ formatEUR(finalBalanceBest) }}</span>
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
