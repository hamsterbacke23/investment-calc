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
      <h3>Return</h3>
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
          <Calendar size="12" /> Set custom period
        </button>
      </div>
      <div v-if="p.customDuration" class="year-range-row">
        <div class="small-label-input">
          <label>From year</label>
          <input type="number" v-model.number="p.startYear" min="1" :max="p.endYear" class="year-input" />
        </div>
        <div class="small-label-input">
          <label>To year</label>
          <input type="number" v-model.number="p.endYear" :min="p.startYear" :max="durationYears" class="year-input" />
        </div>
        <button @click="toggleCustomDuration(p)" class="btn-link btn-link-reset" title="Reset to always">✕</button>
      </div>
    </div>
  </section>
</template>
