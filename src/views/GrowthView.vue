<script setup>
import InitialCapitalCard from '../components/growth/InitialCapitalCard.vue';
import ReturnCard from '../components/growth/ReturnCard.vue';
import InflationCard from '../components/growth/InflationCard.vue';
import DepositsCard from '../components/growth/DepositsCard.vue';
import GrowthStats from '../components/growth/GrowthStats.vue';
import BarChart from '../components/BarChart.vue';
import BenchmarkSection from '../components/BenchmarkSection.vue';
import { calculateData, barStyle } from '../composables/useGrowthCalculations.js';
</script>

<template>
  <main class="grid-layout">
    <aside class="sidebar">
      <InitialCapitalCard />
      <ReturnCard />
      <InflationCard />
      <DepositsCard />
    </aside>

    <div class="dashboard">
      <BarChart :data="calculateData" :bar-style-fn="barStyle" variant="growth" />
      <GrowthStats />
    </div>
  </main>

  <BenchmarkSection />
</template>
