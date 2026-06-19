<script setup>
import {
  allowCapitalDecay,
  withdrawalPlanYears,
  withdrawalReturnRate,
  withdrawalMode,
  pensionMonthly,
  pensionStartAge,
  withdrawalStartAge,
  pensionHasChildren,
  withdrawalVolatility,
  targetSuccessRate,
  etfCostRate,
  vpwReturn,
} from '../../composables/useInvestmentStore.js';
</script>

<template>
  <section class="card">
    <h3>Entnahme-Einstellungen</h3>

    <div class="setting-group">
      <span class="setting-label-text">Entnahme-Art</span>
      <div class="segmented segmented--3" role="radiogroup" aria-label="Entnahme-Art">
        <button
          type="button"
          class="segmented-btn"
          :class="{ active: withdrawalMode === 'nominal' }"
          :aria-pressed="withdrawalMode === 'nominal'"
          @click="withdrawalMode = 'nominal'"
        >
          Nominal
        </button>
        <button
          type="button"
          class="segmented-btn"
          :class="{ active: withdrawalMode === 'real' }"
          :aria-pressed="withdrawalMode === 'real'"
          @click="withdrawalMode = 'real'"
        >
          Real
        </button>
        <button
          type="button"
          class="segmented-btn"
          :class="{ active: withdrawalMode === 'dynamic' }"
          :aria-pressed="withdrawalMode === 'dynamic'"
          @click="withdrawalMode = 'dynamic'"
        >
          Dynamisch
        </button>
      </div>
      <span class="setting-help">
        {{ withdrawalMode === 'dynamic'
          ? 'VPW: jedes Jahr ein neu berechneter Anteil des aktuellen Depots – mehr in guten, weniger in schlechten Jahren. Zehrt das Kapital planmäßig bis zum Endalter auf, statt reich zu sterben.'
          : withdrawalMode === 'real'
            ? 'Auszahlung steigt mit der Inflation – Kaufkraft bleibt konstant'
            : 'Auszahlung in Euro bleibt konstant – Kaufkraft sinkt über die Zeit' }}
      </span>
    </div>

    <div v-if="withdrawalMode === 'dynamic'" class="setting-group">
      <label class="setting-label-text">Kalkulations-Rendite <span class="muted">(real)</span></label>
      <div class="setting-row">
        <input type="number" v-model.number="vpwReturn" min="0" max="10" step="0.1" />
        <span class="setting-value">{{ vpwReturn.toFixed(1) }} %</span>
      </div>
      <input type="range" v-model.number="vpwReturn" min="0" max="10" step="0.1" />
      <span class="setting-help">
        Bestimmt nur die Entnahmehöhe (Amortisation), nicht die simulierte Marktrendite. Höher = mehr jetzt, kleinerer Puffer.
      </span>
    </div>

    <div v-if="withdrawalMode !== 'dynamic'" class="setting-group">
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
      <span class="setting-help">In heutiger Kaufkraft (brutto) – netto nach KV/PV &amp; Steuer wird automatisch berechnet</span>

      <label v-if="pensionMonthly > 0" class="setting-label setting-label--inline">
        <input type="checkbox" v-model="pensionHasChildren" />
        <span>Ich habe (mind. ein) Kind</span>
        <span class="setting-hint">– sonst höherer Pflege-Beitrag</span>
      </label>

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

    <details class="advanced">
      <summary>
        <span>Erweiterte Einstellungen</span>
        <span class="advanced-chevron" aria-hidden="true">›</span>
      </summary>
      <div class="advanced-body">
        <p class="advanced-intro">
          Sinnvolle Voreinstellungen – nur anfassen, wenn du es genauer willst.
        </p>

        <div class="setting-group">
          <label class="setting-label-text">Ziel-Sicherheit</label>
          <div class="setting-row">
            <input type="number" v-model.number="targetSuccessRate" min="50" max="99" step="1" />
            <span class="setting-value">{{ targetSuccessRate }} %</span>
          </div>
          <input type="range" v-model.number="targetSuccessRate" min="50" max="99" step="1" />
          <span class="setting-help">
            Anteil der simulierten Marktverläufe, in denen der Plan aufgeht. Höher = vorsichtigere Entnahme.
          </span>
        </div>

        <div class="setting-group">
          <label class="setting-label-text">Schwankung (Volatilität)</label>
          <div class="setting-row">
            <input type="number" v-model.number="withdrawalVolatility" min="0" max="40" step="0.5" />
            <span class="setting-value">{{ withdrawalVolatility.toFixed(1) }} %</span>
          </div>
          <input type="range" v-model.number="withdrawalVolatility" min="0" max="40" step="0.5" />
          <span class="setting-help">
            Wie stark der Markt pro Jahr schwankt (Standardabweichung). Aktien-ETF ≈ 15 %.
          </span>
        </div>

        <div class="setting-group">
          <label class="setting-label-text">Produktkosten (TER)</label>
          <div class="setting-row">
            <input type="number" v-model.number="etfCostRate" min="0" max="3" step="0.05" />
            <span class="setting-value">{{ etfCostRate.toFixed(2) }} %</span>
          </div>
          <input type="range" v-model.number="etfCostRate" min="0" max="3" step="0.05" />
          <span class="setting-help">
            Jährliche ETF-Kosten – werden von der Rendite abgezogen. Breiter Welt-ETF ≈ 0,2 %.
          </span>
        </div>
      </div>
    </details>
  </section>
</template>
