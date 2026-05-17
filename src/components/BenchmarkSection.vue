<script setup>
import { durationYears } from '../composables/useInvestmentStore.js';
import { etfBenchmarks } from '../composables/useGrowthCalculations.js';
</script>

<template>
  <footer class="benchmark-section">
    <h4>
      ETF Benchmark Reference
      <span class="benchmark-sub">— Historical annualized returns (EUR), last {{ durationYears }} years</span>
    </h4>
    <div class="benchmark-grid">
      <div v-for="etf in etfBenchmarks" :key="etf.isin" class="benchmark-card">
        <div class="benchmark-name">
          {{ etf.name }} <span class="benchmark-ticker">{{ etf.ticker }}</span>
        </div>
        <div v-if="etf.cagr !== null" class="benchmark-return">
          <span :class="parseFloat(etf.cagr) >= 0 ? 'bm-pos' : 'bm-neg'">
            {{ parseFloat(etf.cagr) >= 0 ? '+' : '' }}{{ etf.cagr }}%&thinsp;p.a.
          </span>
          <span class="benchmark-total">
            ({{ parseFloat(etf.totalReturn) >= 0 ? '+' : '' }}{{ etf.totalReturn }}% total)
          </span>
        </div>
        <div v-if="etf.cagr !== null" class="benchmark-meta">
          {{ etf.fromYear }}–{{ etf.toYear }}
          <span v-if="etf.yearsAvailable < etf.yearsRequested" class="benchmark-warn">
            (only {{ etf.yearsAvailable }}y of data)
          </span>
          · TER {{ etf.ter }}%
        </div>
        <div v-else class="benchmark-na">No data for this period</div>
      </div>
    </div>
    <p class="benchmark-disclaimer">
      Past performance is not indicative of future results. Returns include dividends, denominated in EUR. Source: justETF, Feb 2026.
    </p>
  </footer>
</template>
