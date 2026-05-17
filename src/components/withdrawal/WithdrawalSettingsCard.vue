<script setup>
import {
  allowCapitalDecay,
  withdrawalPlanYears,
  withdrawalReturnRate,
} from '../../composables/useInvestmentStore.js';
</script>

<template>
  <section class="card">
    <h3>Withdrawal Settings</h3>
    <div class="setting-group">
      <label class="setting-label">
        <input type="checkbox" v-model="allowCapitalDecay" />
        <span>Allow capital decay</span>
      </label>
      <span class="setting-help">
        {{ allowCapitalDecay ? 'Withdraw all money including principal' : 'Withdraw only returns' }}
      </span>
    </div>

    <div class="setting-group">
      <label class="setting-label-text">Withdrawal Duration</label>
      <div class="setting-row">
        <input type="number" v-model.number="withdrawalPlanYears" min="1" max="100" step="1" />
        <span class="setting-value">{{ withdrawalPlanYears }} years</span>
      </div>
      <input type="range" v-model.number="withdrawalPlanYears" min="1" max="100" />
    </div>

    <div class="setting-group">
      <label class="setting-label-text">Assumed Annual Return</label>
      <div class="setting-row">
        <input type="number" v-model.number="withdrawalReturnRate" min="0" max="15" step="0.1" />
        <span class="setting-value">{{ withdrawalReturnRate.toFixed(1) }}%</span>
      </div>
      <input type="range" v-model.number="withdrawalReturnRate" min="0" max="15" step="0.1" />
    </div>
  </section>
</template>
