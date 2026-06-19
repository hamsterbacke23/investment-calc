<script setup>
import { Plus, Trash2, TrendingUp, TrendingDown, Calendar } from 'lucide-vue-next';
import {
  yieldPhases,
  durationYears,
  returnScenario,
  scenarioRate,
  addPhase,
  removePhase,
  toggleCustomDuration,
} from '../../composables/useInvestmentStore.js';

// Slider bounds for the return band (long-run annual rate, %).
const RATE_MIN = -15;
const RATE_MAX = 20;

const SCENARIOS = [
  { key: 'worst', label: 'Worst Case' },
  { key: 'avg', label: 'Mittelwert' },
  { key: 'best', label: 'Best Case' },
];

const fmtPct = (n) =>
  `${(Math.round(n * 10) / 10).toLocaleString('de-DE', { maximumFractionDigits: 1 })} %`;

// The rate that actually feeds the projection for this phase + active scenario.
const activeRate = (p) => scenarioRate(p, returnScenario.value);

// Position the highlighted band on the rail (% of the [RATE_MIN, RATE_MAX] track).
const pct = (v) => ((Math.min(RATE_MAX, Math.max(RATE_MIN, v)) - RATE_MIN) / (RATE_MAX - RATE_MIN)) * 100;
const bandFillStyle = (p) => {
  const lo = pct(Math.min(p.rateMin, p.rateMax));
  const hi = pct(Math.max(p.rateMin, p.rateMax));
  return { left: `${lo}%`, width: `${Math.max(0, hi - lo)}%` };
};

// Keep min ≤ max while either thumb is dragged.
const onMin = (p) => { if (p.rateMin > p.rateMax) p.rateMin = p.rateMax; };
const onMax = (p) => { if (p.rateMax < p.rateMin) p.rateMax = p.rateMin; };
</script>

<template>
  <section class="card">
    <div class="card-header">
      <h3>Rendite-Bandbreite</h3>
      <button @click="addPhase" class="btn-icon" aria-label="Phase hinzufügen"><Plus size="16" /></button>
    </div>

    <div class="scenario-control">
      <span class="setting-label-text">Szenario fürs Endkapital</span>
      <div class="segmented segmented--triple" role="radiogroup" aria-label="Rendite-Szenario">
        <button
          v-for="s in SCENARIOS"
          :key="s.key"
          type="button"
          class="segmented-btn"
          :class="{ active: returnScenario === s.key }"
          :aria-pressed="returnScenario === s.key"
          @click="returnScenario = s.key"
        >
          {{ s.label }}
        </button>
      </div>
      <span class="setting-help">
        {{ returnScenario === 'avg'
          ? 'Endkapital aus dem Mittel jeder Bandbreite'
          : returnScenario === 'worst'
            ? 'Endkapital im pessimistischen Fall (untere Grenze)'
            : 'Endkapital im optimistischen Fall (obere Grenze)' }}
      </span>
    </div>

    <div v-for="p in yieldPhases" :key="p.id" class="item-box">
      <div class="flex-row">
        <div class="band-summary">
          <span class="yield-display" :class="{ negative: activeRate(p) < 0 }">
            <TrendingUp v-if="activeRate(p) >= 0" size="14" />
            <TrendingDown v-else size="14" />
            {{ fmtPct(activeRate(p)) }}
          </span>
          <span class="band-readout">{{ fmtPct(p.rateMin) }} – {{ fmtPct(p.rateMax) }}</span>
        </div>
        <button @click="removePhase(p.id)" class="btn-delete" aria-label="Phase entfernen"><Trash2 size="14" /></button>
      </div>

      <div class="band-slider">
        <span class="band-rail" aria-hidden="true">
          <span class="band-rail-fill" :style="bandFillStyle(p)"></span>
        </span>
        <input
          type="range"
          class="band-input band-input--min"
          :min="RATE_MIN" :max="RATE_MAX" step="0.5"
          v-model.number="p.rateMin"
          @input="onMin(p)"
          :aria-label="`Untere Rendite-Grenze (${fmtPct(p.rateMin)})`"
        />
        <input
          type="range"
          class="band-input band-input--max"
          :min="RATE_MIN" :max="RATE_MAX" step="0.5"
          v-model.number="p.rateMax"
          @input="onMax(p)"
          :aria-label="`Obere Rendite-Grenze (${fmtPct(p.rateMax)})`"
        />
      </div>

      <div v-if="!p.customDuration" class="duration-toggle">
        <button @click="toggleCustomDuration(p)" class="btn-link">
          <Calendar size="12" /> Zeitraum festlegen
        </button>
      </div>
      <div v-if="p.customDuration" class="year-range-row">
        <div class="small-label-input">
          <label>Ab Jahr</label>
          <input type="number" v-model.number="p.startYear" min="1" :max="p.endYear" class="year-input" />
        </div>
        <div class="small-label-input">
          <label>Bis Jahr</label>
          <input type="number" v-model.number="p.endYear" :min="p.startYear" :max="durationYears" class="year-input" />
        </div>
        <button @click="toggleCustomDuration(p)" class="btn-link btn-link-reset" title="Auf gesamte Laufzeit zurücksetzen">✕</button>
      </div>
    </div>
  </section>
</template>
