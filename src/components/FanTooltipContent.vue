<script setup>
// Renders the typed rows produced by FanChart.tooltipRows. Shared by the desktop
// hover tooltip and the mobile (tap) tooltip so both stay identical.
//
// Row kinds:
//   { head }                              → section header (age)
//   { kind: 'rate', label, value, note }  → the leading VPW withdrawal RATE
//   { kind: 'proj', label, value, split?, range? } → subordinate € projection
//   { amount, label, cls }                → generic percentile row (wealth chart)
defineProps({ rows: { type: Array, default: () => [] } });
</script>

<template>
  <template v-for="(r, ri) in rows" :key="ri">
    <strong v-if="r.head" class="tt-head">{{ r.head }}</strong>

    <span v-else-if="r.kind === 'rate'" class="tt-rate-block">
      <span class="tt-rate-label">{{ r.label }}</span>
      <span class="tt-rate">{{ r.value }}</span>
      <span class="tt-rate-note">{{ r.note }}</span>
    </span>

    <span v-else-if="r.kind === 'proj'" class="tt-proj-block">
      <span class="tt-proj-label">{{ r.label }}</span>
      <span class="tt-proj">{{ r.value }}</span>
      <span v-if="r.split" class="tt-sub">{{ r.split }}</span>
      <span v-if="r.range" class="tt-sub">{{ r.range }}</span>
    </span>

    <span v-else class="tt-row" :class="r.cls">
      <span class="tt-amount">{{ r.amount }}</span>
      <span v-if="r.label" class="tt-label">{{ r.label }}</span>
    </span>
  </template>
</template>
