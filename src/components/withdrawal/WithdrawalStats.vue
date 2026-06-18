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
      <label>Jährliches Nettoeinkommen</label>
      <h2>{{ withdrawalTaxInfo.annualNet.toLocaleString() }} €</h2>
      <span class="tax-note">Jahr 1 · über {{ withdrawalPlanYears }} Jahre</span>

      <dl class="balance-breakdown">
        <div v-if="withdrawalTaxInfo.totalTax > 0" class="breakdown-row">
          <dt>Steuern gesamt <span class="muted">(Lebenszeit)</span></dt>
          <dd>
            <span class="delta delta-neg">∅ {{ withdrawalTaxInfo.effectiveRate }}% auf Gewinne</span>
            <span class="amount">{{ withdrawalTaxInfo.totalTax.toLocaleString() }} €</span>
          </dd>
        </div>
        <div v-if="withdrawalTaxInfo.depletionYear" class="breakdown-row">
          <dt>Kapital erschöpft</dt>
          <dd>
            <span class="delta delta-neg">nach {{ withdrawalTaxInfo.depletionYear }} Jahren</span>
          </dd>
        </div>
      </dl>
    </div>

    <div class="stat-card highlighted final-balance-card">
      <label>Monatliches Nettoeinkommen</label>
      <h2 class="final-balance-headline">{{ withdrawalTaxInfo.monthlyNet.toLocaleString() }} €</h2>

      <dl class="balance-breakdown">
        <div v-if="monthlyTax > 0" class="breakdown-row">
          <dt>Brutto monatlich <span class="muted">(vor Steuern)</span></dt>
          <dd>
            <span class="delta delta-neg">−{{ monthlyTax.toLocaleString() }} € Steuer auf Gewinn</span>
            <span class="amount">{{ withdrawalTaxInfo.monthlyGross.toLocaleString() }} €</span>
          </dd>
        </div>

        <div class="breakdown-row">
          <dt>Heutige Kaufkraft</dt>
          <dd>
            <span class="delta">bei {{ inflationRate.toFixed(1) }}% Inflation</span>
            <span class="amount">{{ monthlyNetToday.toLocaleString() }} €</span>
          </dd>
        </div>
      </dl>
    </div>
  </div>

  <RouterLink to="/growth" class="withdrawal-cta withdrawal-cta--back">
    <span class="cta-arrow" aria-hidden="true">←</span>
    <div class="cta-text">
      <span class="cta-label">Zurück zur Ansparphase</span>
      <span class="cta-headline">Einzahlungen &amp; Rendite anpassen</span>
    </div>
  </RouterLink>
</template>
