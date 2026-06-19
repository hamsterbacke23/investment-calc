<script setup>
import { computed } from 'vue';
import { withdrawalModeComparison } from '../../composables/useWithdrawalPlan.js';
import { withdrawalMode } from '../../composables/useInvestmentStore.js';
import { formatEUR } from '../../utils/tax.js';

const LABELS = {
  nominal: 'Nominal konstant',
  real: 'Real konstant',
  dynamic: 'Dynamisch (VPW)',
};
const NOTE = {
  nominal: 'fester €-Betrag · Kaufkraft sinkt',
  real: 'fester realer Betrag · konstant',
  dynamic: 'folgt dem Depot · zehrt auf',
};

const rows = computed(() => withdrawalModeComparison.value);
const select = (m) => { withdrawalMode.value = m; };
</script>

<template>
  <section v-if="rows.length" class="card mode-compare">
    <h3>Strategien im Vergleich <span class="muted">· monatlich netto · heutige Kaufkraft</span></h3>
    <div class="compare-scroll">
      <table class="compare-table">
        <thead>
          <tr>
            <th>Strategie</th>
            <th title="Monatliches Nettoeinkommen im 1. Jahr (heutige Kaufkraft)">Start</th>
            <th title="Median-Nettoeinkommen im letzten Jahr (heutige Kaufkraft)">Ende (Median)</th>
            <th title="Median-Depotwert am Ende der Laufzeit (heutige Kaufkraft)">Restkapital</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="r in rows"
            :key="r.mode"
            :class="{ active: r.mode === withdrawalMode }"
            @click="select(r.mode)"
            tabindex="0"
            role="button"
            @keydown.enter="select(r.mode)"
          >
            <td class="strat">
              <span class="strat-name">{{ LABELS[r.mode] }}</span>
              <span class="strat-note">{{ NOTE[r.mode] }}</span>
            </td>
            <td class="num">{{ r.infeasible ? '–' : formatEUR(r.startReal) }}</td>
            <td class="num">{{ r.infeasible ? '–' : formatEUR(r.endReal) }}</td>
            <td class="num" :class="{ 'goal-hit': r.isDynamic }">{{ formatEUR(r.endCapitalReal) }}</td>
          </tr>
        </tbody>
      </table>
    </div>
    <p class="compare-note">
      Zeile anklicken wechselt die Strategie. Dynamisch startet höher und zehrt das Kapital auf
      (Restkapital ~0), kostet aber schwankendes Einkommen; konstante Modi lassen mehr übrig.
    </p>
  </section>
</template>
