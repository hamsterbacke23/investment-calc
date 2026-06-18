<script setup>
import {
  allowCapitalDecay,
  withdrawalPlanYears,
  withdrawalReturnRate,
  withdrawalMode,
  pensionMonthly,
  pensionStartAge,
  withdrawalStartAge,
} from '../../composables/useInvestmentStore.js';
</script>

<template>
  <section class="card">
    <h3>Entnahme-Einstellungen</h3>

    <div class="setting-group">
      <span class="setting-label-text">Entnahme-Art</span>
      <div class="segmented" role="radiogroup" aria-label="Entnahme-Art">
        <button
          type="button"
          class="segmented-btn"
          :class="{ active: withdrawalMode === 'nominal' }"
          :aria-pressed="withdrawalMode === 'nominal'"
          @click="withdrawalMode = 'nominal'"
        >
          Nominal konstant
        </button>
        <button
          type="button"
          class="segmented-btn"
          :class="{ active: withdrawalMode === 'real' }"
          :aria-pressed="withdrawalMode === 'real'"
          @click="withdrawalMode = 'real'"
        >
          Real konstant
        </button>
      </div>
      <span class="setting-help">
        {{ withdrawalMode === 'real'
          ? 'Auszahlung steigt mit der Inflation – Kaufkraft bleibt konstant'
          : 'Auszahlung in Euro bleibt konstant – Kaufkraft sinkt über die Zeit' }}
      </span>
    </div>

    <div class="setting-group">
      <label class="setting-label">
        <input type="checkbox" v-model="allowCapitalDecay" />
        <span>Kapital aufzehren erlauben</span>
      </label>
      <span class="setting-help">
        {{ allowCapitalDecay
          ? 'Depot wird über die Laufzeit auf 0 € gebracht'
          : (withdrawalMode === 'real'
              ? 'Depot wächst nominal mit der Inflation – die Kaufkraft der Substanz bleibt erhalten'
              : 'Depot bleibt nominal konstant – die reale Substanz schrumpft mit der Inflation') }}
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

    <div class="setting-group setting-group--pension">
      <span class="setting-label-text">Gesetzliche Rente <span class="muted">(optional)</span></span>

      <div class="setting-row">
        <input
          type="number"
          v-model.number="pensionMonthly"
          min="0"
          max="10000"
          step="50"
          aria-label="Gesetzliche Rente in heutiger Kaufkraft"
        />
        <span class="setting-value">€/Monat</span>
      </div>
      <span class="setting-help">In heutiger Kaufkraft – wird inflationsangepasst ausgezahlt</span>

      <div v-if="pensionMonthly > 0" class="setting-row pension-ages">
        <label class="age-input">
          <span class="age-label">Entnahme-Start</span>
          <input
            type="number"
            v-model.number="withdrawalStartAge"
            min="30"
            max="90"
            step="1"
          />
          <span class="age-suffix">Jahre</span>
        </label>
        <label class="age-input">
          <span class="age-label">Renten-Start</span>
          <input
            type="number"
            v-model.number="pensionStartAge"
            min="50"
            max="80"
            step="1"
          />
          <span class="age-suffix">Jahre</span>
        </label>
      </div>
      <span v-if="pensionMonthly > 0 && pensionStartAge > withdrawalStartAge" class="setting-help">
        Rente startet {{ pensionStartAge - withdrawalStartAge }} {{ pensionStartAge - withdrawalStartAge === 1 ? 'Jahr' : 'Jahre' }} nach Entnahmebeginn
      </span>
      <span v-else-if="pensionMonthly > 0" class="setting-help">
        Rente läuft ab dem ersten Entnahmejahr
      </span>
    </div>
  </section>
</template>
