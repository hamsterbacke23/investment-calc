<script setup>
import { ref, computed } from 'vue';
import { formatEUR, formatCompactEUR } from '../utils/tax.js';

// Depot-balance uncertainty cone from the Monte-Carlo simulation: a shaded
// 10–90 % band with the median (p50) line. Mirrors BarChart's container layout
// so both chart modes share the same frame, axes and tooltip styling.
const props = defineProps({
  data: { type: Array, required: true }, // [{ year, age, p10, p50, p90 }]
  xLabelFn: { type: Function, default: null },
  caption: { type: String, default: '' },
});

const activeYear = ref(null);
const toggle = (year) => {
  activeYear.value = activeYear.value === year ? null : year;
};
const clearTooltip = () => {
  activeYear.value = null;
};
defineExpose({ clearTooltip });

const currentYear = new Date().getFullYear();

const maxScale = computed(() => Math.max(1, ...props.data.map((d) => d.p90)));

const yTicks = computed(() => {
  const max = maxScale.value;
  return [1, 0.75, 0.5, 0.25, 0].map((f) => ({ frac: f, label: formatCompactEUR(max * f) }));
});

const count = computed(() => props.data.length);
const xStep = computed(() => Math.max(1, Math.ceil(count.value / 8)));
const showXLabel = (i) => i % xStep.value === 0 || i === count.value - 1;
const xLabel = (d) => (props.xLabelFn ? props.xLabelFn(d) : String(d.year));

const px = (i) => (count.value <= 1 ? 50 : (i / (count.value - 1)) * 100);
const py = (v) => 100 - Math.max(0, Math.min(100, (v / maxScale.value) * 100));

// Polygon between two percentile series: hi left→right, then lo right→left.
function bandBetween(loKey, hiKey) {
  if (!props.data.length) return '';
  const top = props.data.map((d, i) => `${px(i).toFixed(2)},${py(d[hiKey]).toFixed(2)}`);
  const bottom = props.data.map((d, i) => `${px(i).toFixed(2)},${py(d[loKey]).toFixed(2)}`).reverse();
  return [...top, ...bottom].join(' ');
}

const outerBandPoints = computed(() => bandBetween('p10', 'p90')); // 10–90 %
const innerBandPoints = computed(() => bandBetween('p25', 'p75')); // 25–75 % (likely range)

const seriesPoints = (key) =>
  props.data.map((d, i) => `${px(i).toFixed(2)},${py(d[key]).toFixed(2)}`).join(' ');
const medianPoints = computed(() => seriesPoints('p50'));
const p10Points = computed(() => seriesPoints('p10')); // "schlechter Markt" guide line

const activeData = computed(() =>
  activeYear.value === null ? null : props.data.find((d) => d.year === activeYear.value) || null,
);

function tooltipRows(d) {
  if (!d) return [];
  return [
    { head: `Alter ${d.age} (Jahr ${d.year})` },
    { amount: formatEUR(d.p90), label: 'günstig (90 %)', cls: 'gain-pos' },
    { amount: formatEUR(d.p50), label: 'Median', cls: 'gain-total' },
    { amount: `${formatEUR(d.p25)} – ${formatEUR(d.p75)}`, label: 'wahrscheinlich (25–75 %)', cls: 'tt-muted' },
    { amount: formatEUR(d.p10), label: 'schlechter Markt (10 %)', cls: d.p10 <= 0 ? 'gain-neg' : 'tt-muted' },
  ];
}
</script>

<template>
  <div class="chart chart--withdrawal">
    <div class="chart-legend">
      <span class="legend-item">
        <span class="legend-swatch legend-swatch--band"></span>10–90 %
      </span>
      <span class="legend-item">
        <span class="legend-swatch legend-swatch--band-inner"></span>25–75 %
      </span>
      <span class="legend-item">
        <span class="legend-swatch legend-swatch--line legend-swatch--median"></span>Median
      </span>
      <span class="legend-item">
        <span class="legend-swatch legend-swatch--line legend-swatch--p10"></span>schlechter Markt
      </span>
    </div>

    <div class="chart-container">
      <div class="y-axis" aria-hidden="true">
        <span v-for="t in yTicks" :key="t.frac" class="y-tick">{{ t.label }}</span>
      </div>

      <div class="plot">
        <div class="gridlines" aria-hidden="true">
          <span v-for="t in yTicks" :key="t.frac" class="gridline"></span>
        </div>

        <svg class="fan-svg" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
          <polygon class="fan-band" :points="outerBandPoints" />
          <polygon class="fan-band fan-band--inner" :points="innerBandPoints" />
          <polyline class="fan-p10" :points="p10Points" vector-effect="non-scaling-stroke" />
          <polyline class="fan-median" :points="medianPoints" vector-effect="non-scaling-stroke" />
        </svg>

        <div class="bars fan-hover">
          <div
            v-for="d in data"
            :key="d.year"
            class="bar fan-col"
            :class="{ active: activeYear === d.year }"
            @click.stop="toggle(d.year)"
            @keydown.enter.stop.prevent="toggle(d.year)"
            tabindex="0"
            role="button"
            :aria-label="`Details für Alter ${d.age}`"
          >
            <span class="tooltip">
              <span v-for="(r, ri) in tooltipRows(d)" :key="ri" class="tt-row" :class="r.cls">
                <strong v-if="r.head" class="tt-head">{{ r.head }}</strong>
                <template v-else>
                  <span class="tt-amount">{{ r.amount }}</span>
                  <span v-if="r.label" class="tt-label">{{ r.label }}</span>
                </template>
              </span>
            </span>
          </div>
        </div>

        <div v-if="activeData" class="mobile-tooltip" aria-live="polite">
          <span v-for="(r, ri) in tooltipRows(activeData)" :key="ri" class="tt-row" :class="r.cls">
            <strong v-if="r.head" class="tt-head">{{ r.head }}</strong>
            <template v-else>
              <span class="tt-amount">{{ r.amount }}</span>
              <span v-if="r.label" class="tt-label">{{ r.label }}</span>
            </template>
          </span>
        </div>
      </div>

      <div class="x-axis-spacer" aria-hidden="true"></div>
      <div class="x-axis">
        <span v-for="(d, i) in data" :key="d.year" class="x-tick">
          <span v-if="showXLabel(i)">{{ xLabel(d) }}</span>
        </span>
      </div>
    </div>

    <p v-if="caption" class="chart-caption">{{ caption }}</p>
  </div>
</template>
