<script setup>
import { ref, computed } from 'vue';
import { formatEUR, formatNumber, formatCompactEUR } from '../utils/tax.js';

const props = defineProps({
  data: { type: Array, required: true },
  barStyleFn: { type: Function, required: true },
  variant: { type: String, default: 'growth' }, // 'growth' | 'withdrawal'
  maxValue: { type: Number, default: 0 },
  overlayFn: { type: Function, default: null }, // d => line height in % of plot, or null
  overlayLabel: { type: String, default: '' },
  legend: { type: Array, default: () => [] }, // [{ label, color }]
  xLabelFn: { type: Function, default: null },
  caption: { type: String, default: '' },
});

const activeYear = ref(null);
const toggle = (year) => {
  activeYear.value = activeYear.value === year ? null : year;
};

const activeData = computed(() =>
  activeYear.value === null ? null : props.data.find((d) => d.year === activeYear.value) || null,
);

const currentYear = new Date().getFullYear();

const clearTooltip = () => {
  activeYear.value = null;
};

defineExpose({ clearTooltip });

// --- Axes ---
const maxScale = computed(() => {
  if (props.maxValue > 0) return props.maxValue;
  const key = props.variant === 'withdrawal' ? 'totalNet' : 'balance';
  return Math.max(1, ...props.data.map((d) => d[key] ?? 0));
});

const yTicks = computed(() => {
  const max = maxScale.value;
  return [1, 0.75, 0.5, 0.25, 0].map((f) => ({
    frac: f,
    label: formatCompactEUR(max * f),
  }));
});

const xStep = computed(() => Math.max(1, Math.ceil(props.data.length / 8)));
const showXLabel = (i) => i % xStep.value === 0 || i === props.data.length - 1;
const xLabel = (d) => (props.xLabelFn ? props.xLabelFn(d) : String(d.year));

// --- Real-income line overlay (withdrawal only) ---
const linePoints = computed(() => {
  if (!props.overlayFn || props.data.length === 0) return '';
  const n = props.data.length;
  return props.data
    .map((d, i) => {
      const x = ((i + 0.5) / n) * 100;
      const y = 100 - Math.max(0, Math.min(100, props.overlayFn(d)));
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(' ');
});

// --- Tooltip rows (shared by hover tooltip + mobile tooltip) ---
function tooltipRows(d) {
  if (!d) return [];
  if (props.variant === 'withdrawal') {
    return [
      { head: `Jahr ${d.year} · Alter ${d.age}` },
      { amount: `${formatEUR(d.totalNet)} /Jahr`, label: 'Gesamt netto', cls: 'gain-total' },
      { amount: formatEUR(d.net), label: 'Entnahme netto', cls: 'gain-deposit' },
      d.pensionActive
        ? { sign: '+ ', amount: formatEUR(d.pension), label: 'gesetzl. Rente', cls: 'gain-pension' }
        : null,
      { sign: '≈ ', amount: formatEUR(d.totalNetReal), label: 'Kaufkraft heute', cls: 'gain-real' },
      d.tax > 0
        ? { amount: `−${formatNumber(d.tax)} €`, label: 'Steuer auf Gewinn', cls: 'gain-neg' }
        : { amount: 'steuerfrei', label: 'Freibetrag', cls: 'gain-pos' },
      { amount: formatEUR(d.balance), label: 'Depotwert', cls: 'tt-muted' },
    ].filter(Boolean);
  }
  return [
    { head: `Jahr ${d.year} (${currentYear + d.year})` },
    { amount: formatEUR(d.balance), label: 'Depotstand', cls: 'gain-total' },
    { sign: d.deposits >= 0 ? '+ ' : '', amount: `${formatNumber(d.deposits)} €`, label: 'Einzahlungen', cls: 'gain-deposit' },
    { sign: d.returns >= 0 ? '+ ' : '', amount: `${formatNumber(d.returns)} €`, label: 'Rendite', cls: d.returns >= 0 ? 'gain-pos' : 'gain-neg' },
  ];
}
</script>

<template>
  <div class="chart" :class="`chart--${variant}`">
    <div v-if="legend.length || overlayLabel" class="chart-legend">
      <span v-for="item in legend" :key="item.label" class="legend-item">
        <span class="legend-swatch" :style="{ background: item.color }"></span>{{ item.label }}
      </span>
      <span v-if="overlayLabel" class="legend-item">
        <span class="legend-swatch legend-swatch--line"></span>{{ overlayLabel }}
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

        <div class="bars">
          <div
            v-for="d in data"
            :key="d.year"
            class="bar"
            :class="{ active: activeYear === d.year }"
            :style="barStyleFn(d)"
            @click.stop="toggle(d.year)"
            @keydown.enter.stop.prevent="toggle(d.year)"
            @keydown.space.stop.prevent="toggle(d.year)"
            tabindex="0"
            role="button"
            :aria-label="`Details für Jahr ${d.year}`"
          >
            <span class="tooltip">
              <span
                v-for="(r, ri) in tooltipRows(d)"
                :key="ri"
                class="tt-row"
                :class="r.cls"
              >
                <strong v-if="r.head" class="tt-head">{{ r.head }}</strong>
                <template v-else>
                  <span class="tt-amount">{{ r.sign }}{{ r.amount }}</span>
                  <span v-if="r.label" class="tt-label">{{ r.label }}</span>
                </template>
              </span>
            </span>
          </div>
        </div>

        <svg
          v-if="overlayFn"
          class="line-overlay"
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <polyline :points="linePoints" vector-effect="non-scaling-stroke" />
        </svg>

        <div v-if="activeData" class="mobile-tooltip" aria-live="polite">
          <span
            v-for="(r, ri) in tooltipRows(activeData)"
            :key="ri"
            class="tt-row"
            :class="r.cls"
          >
            <strong v-if="r.head" class="tt-head">{{ r.head }}</strong>
            <template v-else>
              <span class="tt-amount">{{ r.sign }}{{ r.amount }}</span>
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
