<script setup>
import { computed } from 'vue';
import { inflationRate, allowCapitalDecay } from '../../composables/useInvestmentStore.js';
import { withdrawalTaxInfo } from '../../composables/useWithdrawalPlan.js';
import { formatEUR } from '../../utils/tax.js';

const info = computed(() => withdrawalTaxInfo.value);

// All hero-card figures are in today's purchasing power (real), matching the
// card's "heutige Kaufkraft" framing; the nominal trajectory lives in the chart.
const monthlyTax = computed(() => info.value.monthlyTaxReal);

// How safe is the plan? Drives the colour of the headline success number.
const successTone = computed(() => {
  const s = info.value.successRate;
  if (s >= info.value.targetSuccess) return 'positive';
  if (s >= info.value.targetSuccess - 10) return 'neutral';
  return 'warn';
});

const isDynamic = computed(() => info.value.isDynamic);

// "Wie lange reicht das Geld?" — phrased from the simulated depletion ages.
const reach = computed(() => {
  const t = info.value;
  if (t.lastYear === 0) return { headline: '–', sub: '' };
  if (t.isDynamic) {
    return {
      headline: `volle ${t.lastYear} Jahre`,
      sub: `Depot bis Alter ${t.horizonEndAge} aufgezehrt – danach nur noch die Rente`,
    };
  }
  if (t.lastsFullHorizon) {
    return {
      headline: `volle ${t.lastYear} Jahre`,
      sub: t.depletedEarly
        ? `im Median bis Alter ${t.horizonEndAge} · schlechter Fall ab Alter ${t.p10ReachAge}`
        : `im Median bis Alter ${t.horizonEndAge}`,
    };
  }
  return {
    headline: `bis Alter ${t.medianReachAge}`,
    sub: t.depletedEarly
      ? `schlechter Fall (10 % der Märkte): ab Alter ${t.p10ReachAge}`
      : 'Median-Reichweite des Vermögens',
  };
});

// One short note describing what happens to the remaining capital.
const capitalNote = computed(() => {
  const t = info.value;
  if (t.isDynamic) return 'dynamisch aufgezehrt (VPW) – Median am Ende';
  if (t.depletedEarly) return 'in ungünstigen Märkten vorzeitig erschöpft';
  if (allowCapitalDecay.value) return 'Verzehr erlaubt – Puffer bleibt im Normalfall';
  return t.mode === 'real' ? 'real erhalten' : 'nominal erhalten';
});
</script>

<template>
  <div class="stats-grid stats-grid--split">
    <div class="stat-card capital-card safety-card">
      <template v-if="isDynamic">
        <label>Dynamische Entnahme · VPW</label>
        <p class="safety-pct success--neutral">{{ info.vpwStartRatePct }} %</p>
        <p class="safety-caption">
          Start-Entnahmerate · jährlich neu auf den aktuellen Depotstand gerechnet
        </p>
      </template>
      <template v-else>
        <label>Plan-Sicherheit</label>
        <p class="safety-pct" :class="`success--${successTone}`">{{ info.successRate }} %</p>
        <p class="safety-caption">
          aus 1.000 simulierten Marktverläufen · Ziel {{ info.targetSuccess }} %
        </p>
      </template>

      <p v-if="info.infeasible" class="infeasible-note">
        Ziel mit diesen Parametern nicht erreichbar – selbst ohne Entnahme bleibt das Kapital
        nicht mit {{ info.targetSuccess }} % Sicherheit erhalten. Senke die Ziel-Sicherheit oder
        erlaube „Kapital aufzehren".
      </p>

      <dl class="plan-facts">
        <div class="plan-fact">
          <div class="plan-fact-row">
            <dt>Reichweite</dt>
            <dd>{{ reach.headline }}</dd>
          </div>
          <p v-if="reach.sub" class="fact-sub">{{ reach.sub }}</p>
        </div>

        <div class="plan-fact">
          <div class="plan-fact-row">
            <dt>Median-Restkapital</dt>
            <dd>{{ formatEUR(info.endBalance) }}</dd>
          </div>
          <p class="fact-sub">{{ capitalNote }}</p>
        </div>

        <div v-if="info.totalTax > 0" class="plan-fact">
          <div class="plan-fact-row">
            <dt>Steuern <span class="muted">· Lebenszeit</span></dt>
            <dd>{{ formatEUR(info.totalTax) }}</dd>
          </div>
          <p class="fact-sub">∅ {{ info.effectiveRate }} % auf Gewinne</p>
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
        Jahr 1 → Jahr {{ info.lastYear }} · bei {{ inflationRate.toFixed(1) }}% Inflation<template v-if="info.mode === 'real'"> · Entnahme wächst mit der Inflation</template><template v-else-if="info.mode === 'dynamic'"> · Median; Entnahme folgt dem Depot (VPW)</template>
      </span>

      <p v-if="info.hasPension" class="split-line">
        davon <strong>{{ formatEUR(info.guaranteedMonthlyReal) }}</strong> garantiert (Rente)
        <span class="split-sep">·</span>
        <strong>{{ formatEUR(info.atRiskMonthlyReal) }}</strong> aus dem Depot
      </p>

      <dl class="balance-breakdown">
        <div class="breakdown-row">
          <dt>{{ isDynamic ? 'Start-Entnahmerate' : 'Sichere Entnahmerate' }}</dt>
          <dd>
            <span class="amount">{{ isDynamic ? info.vpwStartRatePct : info.withdrawalRatePct }} %</span>
            <span class="delta">{{ isDynamic ? 'des Depots · Jahr 1' : 'des Startkapitals · p.a.' }}</span>
          </dd>
        </div>

        <div v-if="monthlyTax > 0" class="breakdown-row">
          <dt>Brutto-Entnahme <span class="muted">(vor Steuern)</span></dt>
          <dd>
            <span class="amount">{{ formatEUR(info.monthlyGrossReal) }}</span>
            <span class="delta delta-neg">−{{ formatEUR(monthlyTax) }} Steuer</span>
          </dd>
        </div>

        <div v-if="info.hasPension" class="breakdown-row">
          <dt>Gesetzl. Rente <span class="muted">(netto)</span></dt>
          <dd>
            <span class="amount">+{{ formatEUR(info.guaranteedMonthlyReal) }}</span>
            <span class="delta">/Monat real · ab Alter {{ info.pensionStartAge }}</span>
          </dd>
        </div>

        <div class="breakdown-row">
          <dt>Jährlich <span class="muted">heute</span></dt>
          <dd>
            <span class="amount">{{ formatEUR(info.annualTotalIncomeReal) }}</span>
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
