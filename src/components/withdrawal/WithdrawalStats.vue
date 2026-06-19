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
  if (t.isDynamic) return 'Ziel erreicht: planmäßig aufgezehrt, statt reich zu sterben';
  if (t.depletedEarly) return 'in ungünstigen Märkten vorzeitig erschöpft';
  if (allowCapitalDecay.value) return 'Verzehr erlaubt – Puffer bleibt im Normalfall';
  return t.mode === 'real' ? 'real erhalten' : 'nominal erhalten';
});
</script>

<template>
  <div class="stats-grid stats-grid--split">
    <div class="stat-card capital-card safety-card">
      <template v-if="isDynamic">
        <label title="VPW: Du entnimmst jedes Jahr einen neu berechneten Anteil des AKTUELLEN Depots. Der Anteil steigt mit dem Alter und zehrt das Kapital planmäßig bis zum Endalter auf.">Dynamische Entnahme · VPW</label>
        <p class="safety-pct success--neutral">{{ info.vpwStartRatePct }} %</p>
        <p class="safety-caption">
          Start-Entnahmerate · jährlich neu auf den aktuellen Depotstand gerechnet
        </p>
      </template>
      <template v-else>
        <label title="Anteil der 1.000 simulierten Marktverläufe, in denen die feste Entnahme die ganze Laufzeit durchhält.">Plan-Sicherheit</label>
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
            <dt title="Bis zu diesem Alter trägt das Depot die Entnahme. Das ist deine Langlebigkeits-Annahme (Entnahmedauer) – eher konservativ wählen; danach bleibt die Rente.">Reichweite</dt>
            <dd>{{ reach.headline }}</dd>
          </div>
          <p v-if="reach.sub" class="fact-sub">{{ reach.sub }}</p>
        </div>

        <div class="plan-fact">
          <div class="plan-fact-row">
            <dt title="Median-Depotwert am Ende der Laufzeit. Bei dynamischer Entnahme ~0 € – genau das Ziel: das Kapital nutzen statt reich zu sterben.">Median-Restkapital</dt>
            <dd :class="{ 'goal-hit': info.isDynamic }">{{ formatEUR(info.endBalance) }}</dd>
          </div>
          <p class="fact-sub">{{ capitalNote }}</p>
        </div>

        <div v-if="info.isDynamic && info.vpwLateAge" class="plan-fact">
          <div class="plan-fact-row">
            <dt title="Median über alle Marktverläufe: der stärkste reale Einkommensrückgang über ein 5-Jahres-Fenster. So stark kann das Einkommen in einer Schwächephase fallen.">Einkommens-Risiko</dt>
            <dd>{{ info.vpwWorst5DropPct }} %</dd>
          </div>
          <p class="fact-sub">
            stärkster realer 5‑Jahres‑Rückgang · im schlechten Markt mit {{ info.vpwLateAge }} ab {{ formatEUR(info.vpwIncomeP10Late) }}/M
          </p>
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

      <p
        v-if="isDynamic && info.monthlyRealEnd < info.monthlyRealStart"
        class="drag-note"
        title="Der Median-Verlauf liegt unter dem Mittelwert, weil Schwankung die typische (geometrische) Rendite drückt – und weil die Kalkulations-Rendite g über der Marktrendite liegt. Ein niedrigeres g glättet den Verlauf."
      >
        Der Median sinkt mit der Zeit – das ist normal (Volatility Drag + g über Marktrendite), kein Fehler. Niedrigeres g = gleichmäßiger.
      </p>

      <p v-if="info.hasPension && info.bridgeActive" class="split-line">
        Jahr 1: <strong>{{ formatEUR(info.atRiskMonthlyReal) }}</strong> aus dem Depot
        <span class="split-sep">·</span>
        Brücke gleicht den Rentenbeginn (Alter {{ info.pensionStartAge }}) aus – kein Sprung
      </p>
      <p v-else-if="info.hasPension" class="split-line">
        Jahr 1: <strong>{{ formatEUR(info.atRiskMonthlyReal) }}</strong> aus dem Depot
        <span class="split-sep">·</span>
        + <strong>{{ formatEUR(info.guaranteedMonthlyReal) }}</strong> Rente ab Alter {{ info.pensionStartAge }}
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
