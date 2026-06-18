<script setup>
import { computed } from 'vue';
import { inflationRate, allowCapitalDecay } from '../../composables/useInvestmentStore.js';
import { withdrawalTaxInfo } from '../../composables/useWithdrawalPlan.js';
import { formatEUR } from '../../utils/tax.js';

const info = computed(() => withdrawalTaxInfo.value);

const monthlyTax = computed(() => info.value.monthlyGross - info.value.monthlyNet);

// Capital status — driven by the chosen strategy, not the rounded end balance.
// Warning colour only when the depot empties BEFORE the planned duration.
const capitalStatus = computed(() => {
  const t = info.value;
  if (t.depletedEarly) {
    return { tone: 'warn', text: `erschöpft nach ${t.depletionYear} Jahren` };
  }
  if (allowCapitalDecay.value) {
    return { tone: 'neutral', text: 'planmäßig aufgebraucht' };
  }
  return t.mode === 'real'
    ? { tone: 'positive', text: 'real erhalten' }
    : { tone: 'neutral', text: 'nominal erhalten · real schrumpfend' };
});
</script>

<template>
  <div class="stats-grid stats-grid--split">
    <div class="stat-card capital-card">
      <label>Kapital nach {{ info.lastYear }} Jahren</label>
      <h2>{{ formatEUR(info.endBalance) }}</h2>

      <dl class="balance-breakdown balance-breakdown--single">
        <div class="breakdown-row">
          <dt>Substanz</dt>
          <dd>
            <span class="status-pill" :class="`status-pill--${capitalStatus.tone}`">
              {{ capitalStatus.text }}
            </span>
          </dd>
        </div>
        <div v-if="info.totalTax > 0" class="breakdown-row">
          <dt>Steuern <span class="muted">(Lebenszeit)</span></dt>
          <dd>
            <span class="amount amount--sm">{{ formatEUR(info.totalTax) }}</span>
            <span class="delta">∅ {{ info.effectiveRate }}% auf Gewinne</span>
          </dd>
        </div>
      </dl>
    </div>

    <div class="stat-card highlighted hero-income">
      <label>Monatliches Einkommen · heutige Kaufkraft</label>

      <div class="hero-progression" :aria-label="`von ${formatEUR(info.monthlyRealStart)} auf ${formatEUR(info.monthlyRealEnd)}`">
        <span class="hero-now">{{ formatEUR(info.monthlyRealStart) }}</span>
        <span class="hero-arrow" aria-hidden="true">→</span>
        <span class="hero-later">{{ formatEUR(info.monthlyRealEnd) }}</span>
      </div>
      <span class="hero-caption">
        Jahr 1 → Jahr {{ info.lastYear }} · bei {{ inflationRate.toFixed(1) }}% Inflation<template v-if="info.mode === 'real'"> · Entnahme wächst mit der Inflation</template>
      </span>

      <dl class="balance-breakdown">
        <div class="breakdown-row">
          <dt>Nominal <span class="muted">Jahr 1</span></dt>
          <dd>
            <span class="amount">{{ formatEUR(info.monthlyTotalIncome) }}</span>
            <span class="delta">pro Monat</span>
          </dd>
        </div>

        <div v-if="monthlyTax > 0" class="breakdown-row">
          <dt>Brutto-Entnahme <span class="muted">(vor Steuern)</span></dt>
          <dd>
            <span class="amount">{{ formatEUR(info.monthlyGross) }}</span>
            <span class="delta delta-neg">−{{ formatEUR(monthlyTax) }} Steuer</span>
          </dd>
        </div>

        <div v-if="info.hasPension" class="breakdown-row">
          <dt>Gesetzliche Rente</dt>
          <dd>
            <span class="amount">+{{ formatEUR(info.pensionMonthlyStart) }}</span>
            <span class="delta">/Monat ab Alter {{ info.pensionStartAge }}</span>
          </dd>
        </div>

        <div class="breakdown-row">
          <dt>Jährlich <span class="muted">Jahr 1</span></dt>
          <dd>
            <span class="amount">{{ formatEUR(info.annualTotalIncome) }}</span>
            <span class="delta">pro Jahr</span>
          </dd>
        </div>
      </dl>
    </div>
  </div>

  <RouterLink to="/growth" class="back-link">
    <span class="back-arrow" aria-hidden="true">←</span>
    Zurück zur Ansparphase
  </RouterLink>
</template>
