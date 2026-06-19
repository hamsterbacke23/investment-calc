<script setup>
import { ref, computed } from 'vue';
import StartingBalanceCard from '../components/withdrawal/StartingBalanceCard.vue';
import WithdrawalSettingsCard from '../components/withdrawal/WithdrawalSettingsCard.vue';
import WithdrawalStats from '../components/withdrawal/WithdrawalStats.vue';
import ModeComparison from '../components/withdrawal/ModeComparison.vue';
import BarChart from '../components/BarChart.vue';
import FanChart from '../components/FanChart.vue';
import {
  calculateWithdrawalData,
  withdrawalBarStyle,
  withdrawalRealLine,
  maxWithdrawalIncome,
  withdrawalFanBands,
  withdrawalIncomeBands,
  withdrawalTaxInfo,
} from '../composables/useWithdrawalPlan.js';
import { sidebarInert } from '../composables/useSettingsPanel.js';

// 'income' = net income (the plan); 'wealth' = Monte-Carlo depot cone.
const chartMode = ref('income');
// VPW income varies by path → the income view becomes a band chart too.
const isDynamic = computed(() => withdrawalTaxInfo.value.isDynamic);

const legend = computed(() => {
  const items = [{ label: 'Entnahme (netto)', color: 'var(--bar-deposit)' }];
  if (withdrawalTaxInfo.value.hasPension) {
    items.push({ label: 'Gesetzliche Rente', color: 'var(--bar-pension)' });
  }
  return items;
});

const ageLabel = (d) => String(d.age);
</script>

<template>
  <main class="grid-layout">
    <aside id="app-sidebar" class="sidebar" :inert="sidebarInert">
      <StartingBalanceCard />
      <WithdrawalSettingsCard />
    </aside>

    <div class="dashboard">
      <div class="chart-toggle" role="radiogroup" aria-label="Diagramm-Ansicht">
        <div class="segmented segmented--compact">
          <button
            type="button"
            class="segmented-btn"
            :class="{ active: chartMode === 'income' }"
            :aria-pressed="chartMode === 'income'"
            @click="chartMode = 'income'"
          >
            Einkommen
          </button>
          <button
            type="button"
            class="segmented-btn"
            :class="{ active: chartMode === 'wealth' }"
            :aria-pressed="chartMode === 'wealth'"
            @click="chartMode = 'wealth'"
          >
            Vermögen
          </button>
        </div>
      </div>

      <!-- Income view: fixed modes → net-income bars; VPW → income band (P10/P50/P90). -->
      <FanChart
        v-if="chartMode === 'income' && isDynamic"
        :data="withdrawalIncomeBands"
        :x-label-fn="ageLabel"
        caption="Alter · monatliches Nettoeinkommen (heutige Kaufkraft, inkl. Rente ab Renteneintritt) — Median + Spanne aus 1.000 Marktszenarien; gestrichelt = P10 (1 von 10 schlechter)"
      />
      <BarChart
        v-else-if="chartMode === 'income'"
        :data="calculateWithdrawalData"
        :bar-style-fn="withdrawalBarStyle"
        variant="withdrawal"
        :max-value="maxWithdrawalIncome"
        :overlay-fn="withdrawalRealLine"
        overlay-label="Kaufkraft heute"
        :legend="legend"
        :x-label-fn="ageLabel"
        caption="Alter · jährliches Nettoeinkommen — Balken nominal, Linie in heutiger Kaufkraft"
      />
      <FanChart
        v-else
        :data="withdrawalFanBands"
        :x-label-fn="ageLabel"
        caption="Alter · Depotwert (nominal) — Median + 10–90 %-Band aus 1.000 Marktszenarien; gestrichelt = P10 (1 von 10 schlechter)"
      />

      <WithdrawalStats />
      <ModeComparison />
    </div>
  </main>
</template>
