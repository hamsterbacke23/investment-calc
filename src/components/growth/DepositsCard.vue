<script setup>
import { Plus, Trash2, Calendar } from 'lucide-vue-next';
import {
  transactions,
  durationYears,
  addTransaction,
  removeTransaction,
  toggleCustomDuration,
} from '../../composables/useInvestmentStore.js';
</script>

<template>
  <section class="card">
    <div class="card-header">
      <h3>Deposits</h3>
      <button @click="addTransaction" class="btn-icon"><Plus size="16" /></button>
    </div>
    <div v-for="t in transactions" :key="t.id" class="item-box">
      <div class="flex-row">
        <span class="item-label">
          {{ t.amount.toLocaleString() }} € / {{ t.type === 'monthly' ? 'mo' : 'once' }}
        </span>
        <button @click="removeTransaction(t.id)" class="btn-delete"><Trash2 size="14" /></button>
      </div>
      <div class="grid-2">
        <input type="number" v-model.number="t.amount" step="50" />
        <select v-model="t.type">
          <option value="monthly">monthly</option>
          <option value="once">one-time</option>
        </select>
      </div>
      <input v-if="t.type === 'monthly'" type="range" v-model.number="t.amount" max="10000" step="50" />
      <div v-if="t.type === 'monthly' && !t.customDuration" class="duration-toggle">
        <button @click="toggleCustomDuration(t)" class="btn-link">
          <Calendar size="12" /> Set custom period
        </button>
      </div>
      <div v-if="t.type === 'monthly' && t.customDuration" class="year-range-row">
        <div class="small-label-input">
          <label>From year</label>
          <input type="number" v-model.number="t.startYear" min="1" :max="t.endYear" class="year-input" />
        </div>
        <div class="small-label-input">
          <label>To year</label>
          <input type="number" v-model.number="t.endYear" :min="t.startYear" :max="durationYears" class="year-input" />
        </div>
        <button @click="toggleCustomDuration(t)" class="btn-link btn-link-reset" title="Reset to always">✕</button>
      </div>
      <div v-if="t.type === 'once'" class="year-range-row">
        <div class="small-label-input">
          <label>In year</label>
          <input type="number" v-model.number="t.startYear" min="1" :max="durationYears" class="year-input" />
        </div>
      </div>
    </div>
  </section>
</template>
