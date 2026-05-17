<script setup>
import { Plus, Trash2, TrendingUp, TrendingDown, Calendar } from 'lucide-vue-next';
import {
  yieldPhases,
  durationYears,
  addPhase,
  removePhase,
  toggleCustomDuration,
} from '../../composables/useInvestmentStore.js';
</script>

<template>
  <section class="card">
    <div class="card-header">
      <h3>Rendite</h3>
      <button @click="addPhase" class="btn-icon"><Plus size="16" /></button>
    </div>
    <div v-for="p in yieldPhases" :key="p.id" class="item-box">
      <div class="flex-row">
        <div class="yield-display" :class="{ negative: p.rate < 0 }">
          <TrendingUp v-if="p.rate >= 0" size="14" />
          <TrendingDown v-else size="14" />
          {{ p.rate }}%
        </div>
        <button @click="removePhase(p.id)" class="btn-delete"><Trash2 size="14" /></button>
      </div>
      <input type="range" v-model.number="p.rate" min="-50" max="30" />
      <div v-if="!p.customDuration" class="duration-toggle">
        <button @click="toggleCustomDuration(p)" class="btn-link">
          <Calendar size="12" /> Zeitraum festlegen
        </button>
      </div>
      <div v-if="p.customDuration" class="year-range-row">
        <div class="small-label-input">
          <label>Ab Jahr</label>
          <input type="number" v-model.number="p.startYear" min="1" :max="p.endYear" class="year-input" />
        </div>
        <div class="small-label-input">
          <label>Bis Jahr</label>
          <input type="number" v-model.number="p.endYear" :min="p.startYear" :max="durationYears" class="year-input" />
        </div>
        <button @click="toggleCustomDuration(p)" class="btn-link btn-link-reset" title="Auf gesamte Laufzeit zurücksetzen">✕</button>
      </div>
    </div>
  </section>
</template>
