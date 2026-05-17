<script setup>
import { ref, computed } from 'vue';

const props = defineProps({
  data: { type: Array, required: true },
  barStyleFn: { type: Function, required: true },
  variant: { type: String, default: 'growth' }, // 'growth' | 'withdrawal'
});

const activeYear = ref(null);
const toggle = (year) => {
  activeYear.value = activeYear.value === year ? null : year;
};

const activeData = computed(() =>
  activeYear.value === null ? null : props.data.find((d) => d.year === activeYear.value) || null,
);

const currentYear = new Date().getFullYear();

const clearTooltip = () => {
  activeYear.value = null;
};

defineExpose({ clearTooltip });
</script>

<template>
  <div class="chart-container">
    <div class="bars">
      <div
        v-for="d in data"
        :key="d.year"
        class="bar"
        :class="{ active: activeYear === d.year }"
        :style="barStyleFn(d)"
        @click.stop="toggle(d.year)"
        @keydown.enter.stop.prevent="toggle(d.year)"
        @keydown.space.stop.prevent="toggle(d.year)"
        tabindex="0"
        role="button"
        :aria-label="`Show details for year ${d.year}`"
      >
        <span class="tooltip">
          <strong>Year {{ d.year }} ({{ currentYear + d.year }})</strong><br>
          {{ d.balance.toLocaleString() }} €
          <template v-if="variant === 'growth'">
            <br>
            <span class="gain-deposit">{{ d.deposits >= 0 ? '+' : '' }}{{ d.deposits.toLocaleString() }} € deposits</span>
            <br>
            <span :class="d.returns >= 0 ? 'gain-pos' : 'gain-neg'">
              {{ d.returns >= 0 ? '+' : '' }}{{ d.returns.toLocaleString() }} € returns
            </span>
            <br>
            <span class="gain-total">
              = {{ d.deposits + d.returns >= 0 ? '+' : '' }}{{ (d.deposits + d.returns).toLocaleString() }} € total
            </span>
          </template>
          <template v-else>
            <br>
            <span class="gain-deposit">−{{ d.withdrawal.toLocaleString() }} € withdrawal</span>
            <br>
            <span class="gain-pos">+{{ d.returns.toLocaleString() }} € returns</span>
          </template>
        </span>
      </div>
    </div>
    <div v-if="activeData" class="mobile-tooltip" aria-live="polite">
      <strong>Year {{ activeData.year }} ({{ currentYear + activeData.year }})</strong><br>
      {{ activeData.balance.toLocaleString() }} €
      <template v-if="variant === 'growth'">
        <br>
        <span class="gain-deposit">{{ activeData.deposits >= 0 ? '+' : '' }}{{ activeData.deposits.toLocaleString() }} € deposits</span>
        <br>
        <span :class="activeData.returns >= 0 ? 'gain-pos' : 'gain-neg'">
          {{ activeData.returns >= 0 ? '+' : '' }}{{ activeData.returns.toLocaleString() }} € returns
        </span>
        <br>
        <span class="gain-total">
          = {{ activeData.deposits + activeData.returns >= 0 ? '+' : '' }}{{ (activeData.deposits + activeData.returns).toLocaleString() }} € total
        </span>
      </template>
      <template v-else>
        <br>
        <span class="gain-deposit">−{{ activeData.withdrawal.toLocaleString() }} € withdrawal</span>
        <br>
        <span class="gain-pos">+{{ activeData.returns.toLocaleString() }} € returns</span>
      </template>
    </div>
  </div>
</template>
