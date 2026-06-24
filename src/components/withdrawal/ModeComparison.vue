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
    <h3>Strategien im Vergleich <span class="muted">· monatlich netto · nominal, klein: heutige Kaufkraft</span></h3>
    <div class="compare-scroll">
      <table class="compare-table">
        <thead>
          <tr>
            <th>Strategie</th>
            <th title="Monatliches Nettoeinkommen im 1. Jahr (nominal; klein: heutige Kaufkraft)">Start</th>
            <th title="Median-Nettoeinkommen im letzten Jahr (nominal; klein: heutige Kaufkraft)">Ende (Median)</th>
            <th title="Median-Depotwert am Ende der Laufzeit (nominal; klein: heutige Kaufkraft)">Restkapital</th>
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
            <td class="num">
              <template v-if="r.infeasible">–</template>
              <template v-else>
                <span class="num-nominal">{{ formatEUR(r.startNominal) }}</span>
                <span class="num-real">~{{ formatEUR(r.startReal) }}</span>
              </template>
            </td>
            <td class="num">
              <template v-if="r.infeasible">–</template>
              <template v-else>
                <span class="num-nominal">{{ formatEUR(r.endNominal) }}</span>
                <span class="num-real">~{{ formatEUR(r.endReal) }}</span>
              </template>
            </td>
            <td class="num" :class="{ 'goal-hit': r.isDynamic }">
              <span class="num-nominal">{{ formatEUR(r.endCapitalNominal) }}</span>
              <span v-if="r.endCapitalNominal > 0" class="num-real">~{{ formatEUR(r.endCapitalReal) }}</span>
            </td>
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
