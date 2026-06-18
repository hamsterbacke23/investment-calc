<script setup>
import { computed } from 'vue';
import StartingBalanceCard from '../components/withdrawal/StartingBalanceCard.vue';
import WithdrawalSettingsCard from '../components/withdrawal/WithdrawalSettingsCard.vue';
import WithdrawalStats from '../components/withdrawal/WithdrawalStats.vue';
import BarChart from '../components/BarChart.vue';
import {
  calculateWithdrawalData,
  withdrawalBarStyle,
  withdrawalRealLine,
  maxWithdrawalIncome,
  withdrawalTaxInfo,
} from '../composables/useWithdrawalPlan.js';

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
    <aside class="sidebar">
      <StartingBalanceCard />
      <WithdrawalSettingsCard />
    </aside>

    <div class="dashboard">
      <BarChart
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
      <WithdrawalStats />
    </div>
  </main>
</template>
