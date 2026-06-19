<script setup>
import { ref, computed } from 'vue';
import StartingBalanceCard from '../components/withdrawal/StartingBalanceCard.vue';
import WithdrawalSettingsCard from '../components/withdrawal/WithdrawalSettingsCard.vue';
import WithdrawalStats from '../components/withdrawal/WithdrawalStats.vue';
import BarChart from '../components/BarChart.vue';
import FanChart from '../components/FanChart.vue';
import {
  calculateWithdrawalData,
  withdrawalBarStyle,
  withdrawalRealLine,
  maxWithdrawalIncome,
  withdrawalFanBands,
  withdrawalTaxInfo,
} from '../composables/useWithdrawalPlan.js';
import { sidebarInert } from '../composables/useSettingsPanel.js';

// 'income' = net income bars (the plan); 'wealth' = Monte-Carlo depot cone.
const chartMode = ref('income');

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

      <BarChart
        v-if="chartMode === 'income'"
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
        caption="Alter · Depotwert (nominal) — Median und 10–90 %-Bandbreite aus 1.000 Marktszenarien"
      />

      <WithdrawalStats />
    </div>
  </main>
</template>
