<script setup>
import StartingBalanceCard from '../components/withdrawal/StartingBalanceCard.vue';
import WithdrawalSettingsCard from '../components/withdrawal/WithdrawalSettingsCard.vue';
import WithdrawalStats from '../components/withdrawal/WithdrawalStats.vue';
import BarChart from '../components/BarChart.vue';
import { calculateWithdrawalData, withdrawalBarStyle } from '../composables/useWithdrawalPlan.js';
</script>

<template>
  <main class="grid-layout">
    <aside class="sidebar">
      <StartingBalanceCard />
      <WithdrawalSettingsCard />
    </aside>

    <div class="dashboard">
      <BarChart :data="calculateWithdrawalData" :bar-style-fn="withdrawalBarStyle" variant="withdrawal" />
      <WithdrawalStats />
    </div>
  </main>
</template>
