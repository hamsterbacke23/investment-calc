<script setup>
import {
  allowCapitalDecay,
  withdrawalPlanYears,
  withdrawalReturnRate,
  taxCouple,
} from '../../composables/useInvestmentStore.js';
</script>

<template>
  <section class="card">
    <h3>Entnahme-Einstellungen</h3>
    <div class="setting-group">
      <label class="setting-label">
        <input type="checkbox" v-model="allowCapitalDecay" />
        <span>Kapital aufzehren erlauben</span>
      </label>
      <span class="setting-help">
        {{ allowCapitalDecay ? 'Gesamtes Kapital inkl. Stamm wird entnommen' : 'Nur Renditen werden entnommen' }}
      </span>
    </div>

    <div class="setting-group">
      <label class="setting-label">
        <input type="checkbox" v-model="taxCouple" />
        <span>Gemeinsam veranlagt (Paar)</span>
      </label>
      <span class="setting-help">
        Sparerpauschbetrag: {{ taxCouple ? '2.000' : '1.000' }} € pro Jahr
      </span>
    </div>

    <div class="setting-group">
      <label class="setting-label-text">Entnahmedauer</label>
      <div class="setting-row">
        <input type="number" v-model.number="withdrawalPlanYears" min="1" max="100" step="1" />
        <span class="setting-value">{{ withdrawalPlanYears }} Jahre</span>
      </div>
      <input type="range" v-model.number="withdrawalPlanYears" min="1" max="100" />
    </div>

    <div class="setting-group">
      <label class="setting-label-text">Erwartete jährliche Rendite</label>
      <div class="setting-row">
        <input type="number" v-model.number="withdrawalReturnRate" min="0" max="15" step="0.1" />
        <span class="setting-value">{{ withdrawalReturnRate.toFixed(1) }}%</span>
      </div>
      <input type="range" v-model.number="withdrawalReturnRate" min="0" max="15" step="0.1" />
    </div>
  </section>
</template>
