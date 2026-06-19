<script setup>
import InitialCapitalCard from '../components/growth/InitialCapitalCard.vue';
import ReturnCard from '../components/growth/ReturnCard.vue';
import InflationCard from '../components/growth/InflationCard.vue';
import DepositsCard from '../components/growth/DepositsCard.vue';
import GrowthStats from '../components/growth/GrowthStats.vue';
import BarChart from '../components/BarChart.vue';
import BenchmarkSection from '../components/BenchmarkSection.vue';
import { computed } from 'vue';
import {
  calculateData,
  barStyle,
  growthChartMax,
  hasReturnBand,
  growthBandLower,
  growthBandUpper,
} from '../composables/useGrowthCalculations.js';
import { sidebarInert } from '../composables/useSettingsPanel.js';

const legend = computed(() => {
  const items = [
    { label: 'Bestand', color: 'var(--bar-base)' },
    { label: 'Einzahlungen', color: 'var(--bar-deposit)' },
    { label: 'Rendite', color: 'var(--bar-return)' },
  ];
  if (hasReturnBand.value) items.push({ label: 'Bandbreite (Worst–Best)', color: 'var(--bar-band)' });
  return items;
});
</script>

<template>
  <main class="grid-layout">
    <aside id="app-sidebar" class="sidebar" :inert="sidebarInert">
      <InitialCapitalCard />
      <ReturnCard />
      <InflationCard />
      <DepositsCard />
    </aside>

    <div class="dashboard">
      <BarChart
        :data="calculateData"
        :bar-style-fn="barStyle"
        variant="growth"
        :max-value="growthChartMax"
        :band-lower-fn="hasReturnBand ? growthBandLower : null"
        :band-upper-fn="hasReturnBand ? growthBandUpper : null"
        :legend="legend"
        caption="Jahr · Depotstand (nominal) — schattierte Spanne: Worst- bis Best-Case"
      />
      <GrowthStats />
    </div>
  </main>

  <BenchmarkSection />
</template>
