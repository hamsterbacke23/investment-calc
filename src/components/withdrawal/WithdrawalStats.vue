<script setup>
import { computed } from 'vue';
import { allowCapitalDecay } from '../../composables/useInvestmentStore.js';
import { withdrawalTaxInfo } from '../../composables/useWithdrawalPlan.js';
import { formatEUR, formatNumber } from '../../utils/tax.js';

const info = computed(() => withdrawalTaxInfo.value);

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

// Plain-language headline, split into parts so the € amounts can share the same
// serif (old-style figures) treatment as the phase totals below — consistent.
const lead = computed(() => {
  const t = info.value;
  const ph = t.phases || [];
  if (!ph.length) return null;
  // Range over the "living" phases (everything but the final year); the end is
  // stated separately so a decline to the end isn't hidden inside the range.
  const early = (ph.length > 1 ? ph.slice(0, -1) : ph).map((p) => p.total);
  const end = ph[ph.length - 1].total;
  const lo = Math.min(...early);
  const hi = Math.max(...early);
  const range = hi - lo > Math.max(150, hi * 0.04)
    ? `${formatNumber(lo)}–${formatNumber(hi)} €`
    : `${formatNumber(hi)} €`;
  const penText = t.hasPension ? `, inkl. Rente ab ${t.pensionStartAge}` : '';
  // Build the sentence so all spacing/punctuation lives in the interpolated text
  // (Vue trims whitespace at element boundaries); only the € amounts are spans.
  const verb = end < lo * 0.97 ? 'Sinkt' : end > hi * 1.03 ? 'Steigt' : null;
  return {
    pre: 'Monatlich verfügbar: ~',
    range,
    mid: verb
      ? ` — netto, heutiges Geld${penText}. ${verb} bis zum Ende auf ~`
      : ` — netto, heutiges Geld${penText}.`,
    endAmount: verb ? `${formatNumber(end)} €` : null,
    post: verb ? '.' : '',
  };
});

// One sentence tying the number to the curve shape in the chart.
const shapeNote = computed(() => {
  const t = info.value;
  if (!(t.phases || []).length) return '';
  const hasGap = t.phases.some((p) => p.label === 'Vor Rente');
  if (t.isDynamic) {
    if (hasGap) {
      return t.bridgeActive
        ? `Kurve: die Brücke verhindert den Einkommenssprung bei Rentenbeginn (${t.pensionStartAge}); insgesamt sinkt das Einkommen langsam, weil das Depot planmäßig aufgezehrt wird.`
        : `Kurve: steigt bei Rentenbeginn (${t.pensionStartAge}, die Rente kommt dazu), sinkt sonst langsam, weil das Depot planmäßig aufgezehrt wird.`;
    }
    return 'Kurve: sinkt langsam, weil das Depot planmäßig aufgezehrt wird (Volatility Drag).';
  }
  if (t.mode === 'real') {
    return hasGap
      ? `Kurve: konstante reale Auszahlung, steigt nur bei Rentenbeginn (${t.pensionStartAge}).`
      : 'Kurve: konstante reale Auszahlung über die ganze Laufzeit.';
  }
  return t.hasPension
    ? `Kurve: nominal fester Betrag – reale Kaufkraft sinkt; Rente ab ${t.pensionStartAge}.`
    : 'Kurve: nominal fester Betrag – reale Kaufkraft sinkt über die Zeit.';
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
      <label>Monatliches Einkommen · netto · heutige Kaufkraft</label>

      <p v-if="lead" class="hero-klartext">{{ lead.pre }}<span class="klartext-amount">{{ lead.range }}</span>{{ lead.mid }}<span v-if="lead.endAmount" class="klartext-amount">{{ lead.endAmount }}</span>{{ lead.post }}</p>

      <dl class="phase-list">
        <div v-for="ph in info.phases" :key="ph.label" class="phase-row">
          <div class="phase-head">
            <dt class="phase-label">{{ ph.label }}</dt>
            <span class="phase-age">{{ ph.age }}</span>
          </div>
          <dd class="phase-dd">
            <span class="phase-total">{{ formatEUR(ph.total) }}<span class="per-month"> /Monat</span></span>
            <span class="phase-split">
              <template v-if="ph.pension > 0">
                {{ formatEUR(ph.depot) }} Depot + {{ formatEUR(ph.pension) }} Rente
                <span class="muted">ab {{ info.pensionStartAge }}</span>
              </template>
              <template v-else>nur Depot</template>
            </span>
          </dd>
        </div>
      </dl>

      <p v-if="shapeNote" class="hero-trend">{{ shapeNote }}</p>
    </div>
  </div>
</template>
