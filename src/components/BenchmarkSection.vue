<script setup>
import { durationYears } from '../composables/useInvestmentStore.js';
import { etfBenchmarks } from '../composables/useGrowthCalculations.js';
</script>

<template>
  <footer class="benchmark-section">
    <h4>
      ETF-Benchmark-Referenz
      <span class="benchmark-sub">— Historische annualisierte Renditen (EUR), letzte {{ durationYears }} Jahre</span>
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
            ({{ parseFloat(etf.totalReturn) >= 0 ? '+' : '' }}{{ etf.totalReturn }}% gesamt)
          </span>
        </div>
        <div v-if="etf.cagr !== null" class="benchmark-meta">
          {{ etf.fromYear }}–{{ etf.toYear }}
          <span v-if="etf.yearsAvailable < etf.yearsRequested" class="benchmark-warn">
            (nur {{ etf.yearsAvailable }} J. verfügbar)
          </span>
          · TER {{ etf.ter }}%
        </div>
        <div v-else class="benchmark-na">Keine Daten für diesen Zeitraum</div>
      </div>
    </div>
    <p class="benchmark-disclaimer">
      Wertentwicklungen der Vergangenheit sind keine Garantie für zukünftige Ergebnisse. Renditen inkl. Dividenden, in EUR. Quelle: justETF, Feb. 2026.
    </p>
  </footer>
</template>
