import { computed } from 'vue';
import {
  initialCapital,
  durationYears,
  reinvestGains,
  inflationRate,
  yieldPhases,
  transactions,
  returnScenario,
  scenarioRate,
} from './useInvestmentStore.js';
import { inflationAdjusted } from '../utils/tax.js';
import { etfData } from '../data/etfBenchmarks.js';

// Run the full year-by-year projection for one return scenario. Deposits are
// identical across scenarios — only the per-phase rate (resolved from the band)
// differs — so the three scenarios share this single pass.
function project(scenario) {
  const results = [];
  let currentBalance = initialCapital.value;
  let totalGains = 0;

  for (let year = 1; year <= durationYears.value; year++) {
    const matchingPhases = yieldPhases.value.filter(
      (p) => year >= p.startYear && year <= p.endYear,
    );
    const phase = matchingPhases.length > 0 ? matchingPhases[matchingPhases.length - 1] : null;
    const annualRatePct = phase ? scenarioRate(phase, scenario) : 0;
    const annualRate = annualRatePct / 100;
    const monthlyRate = Math.pow(1 + annualRate, 1 / 12) - 1;

    let yearDeposits = 0;
    let yearReturns = 0;

    for (let month = 1; month <= 12; month++) {
      transactions.value.forEach((t) => {
        const effectiveEnd =
          !t.customDuration && t.type === 'monthly' ? durationYears.value : t.endYear;
        const isActive =
          year >= t.startYear &&
          year <= (t.type === 'monthly' ? effectiveEnd : t.startYear);
        if (isActive) {
          if (t.type === 'monthly') {
            currentBalance += t.amount;
            yearDeposits += t.amount;
          } else if (t.type === 'once' && month === 1) {
            currentBalance += t.amount;
            yearDeposits += t.amount;
          }
        }
      });

      const monthlyGain = currentBalance * monthlyRate;
      yearReturns += monthlyGain;
      if (reinvestGains.value) {
        currentBalance += monthlyGain;
      }
      totalGains += monthlyGain;
    }

    results.push({
      year,
      balance: Math.round(reinvestGains.value ? currentBalance : currentBalance + totalGains),
      rate: Math.round(annualRatePct * 10) / 10,
      deposits: Math.round(yearDeposits),
      returns: Math.round(yearReturns),
    });
  }
  return results;
}

// Selected-scenario projection — drives the chart bars and the Endkapital that
// the withdrawal phase starts from.
export const calculateData = computed(() => project(returnScenario.value));

// Worst/best envelope, computed lazily and only consumed when a band exists.
export const projectionBand = computed(() => ({
  worst: project('worst'),
  best: project('best'),
}));

// True when at least one phase has a non-zero spread → there is a band to show.
export const hasReturnBand = computed(() =>
  yieldPhases.value.some((p) => Number(p.rateMin) !== Number(p.rateMax)),
);

export const maxBalance = computed(() => Math.max(...calculateData.value.map((x) => x.balance)));

// Chart scale must also fit the best-case line so the band never clips.
export const growthChartMax = computed(() => {
  const selected = calculateData.value.map((x) => x.balance);
  if (!hasReturnBand.value) return Math.max(1, ...selected);
  const best = projectionBand.value.best.map((x) => x.balance);
  return Math.max(1, ...selected, ...best);
});

export const totalInvested = computed(() => {
  return initialCapital.value + transactions.value.reduce((acc, t) => {
    const effectiveEnd = !t.customDuration && t.type === 'monthly' ? durationYears.value : t.endYear;
    return acc + (t.amount * (t.type === 'monthly' ? (effectiveEnd - t.startYear + 1) * 12 : 1));
  }, 0);
});

export const finalBalance = computed(() => calculateData.value[calculateData.value.length - 1].balance);

export const finalBalanceReal = computed(() =>
  inflationAdjusted(finalBalance.value, inflationRate.value, durationYears.value),
);

const lastBalance = (rows) => (rows.length ? rows[rows.length - 1].balance : 0);
export const finalBalanceWorst = computed(() => lastBalance(projectionBand.value.worst));
export const finalBalanceBest = computed(() => lastBalance(projectionBand.value.best));

// Height (% of plot) of the worst/best envelope lines for a given chart row.
// Reuse the matrix in projectionBand; n is small so a per-row lookup is fine.
function bandHeight(rows, year) {
  const row = rows.find((r) => r.year === year);
  return row ? (row.balance / growthChartMax.value) * 100 : 0;
}
export function growthBandLower(d) {
  return bandHeight(projectionBand.value.worst, d.year);
}
export function growthBandUpper(d) {
  return bandHeight(projectionBand.value.best, d.year);
}

export const etfBenchmarks = computed(() => {
  const endYear = 2025;
  const startYear = endYear - durationYears.value + 1;
  return etfData.map((etf) => {
    const years = [];
    let cumulative = 1;
    for (let y = startYear; y <= endYear; y++) {
      if (etf.returns[y] !== undefined) {
        cumulative *= 1 + etf.returns[y] / 100;
        years.push(y);
      }
    }
    const n = years.length;
    const cagr = n > 0 ? (Math.pow(cumulative, 1 / n) - 1) * 100 : null;
    const totalReturn = (cumulative - 1) * 100;
    return {
      ...etf,
      cagr: cagr !== null ? cagr.toFixed(1) : null,
      totalReturn: totalReturn.toFixed(0),
      yearsAvailable: n,
      yearsRequested: durationYears.value,
      fromYear: years.length > 0 ? years[0] : null,
      toYear: years.length > 0 ? years[years.length - 1] : null,
    };
  });
});

export function barStyle(d) {
  const max = growthChartMax.value;
  const heightPct = (d.balance / max) * 100;
  const depositRatio = d.balance > 0 ? Math.abs(d.deposits) / d.balance : 0;
  const returnRatio = d.balance > 0 ? Math.abs(d.returns) / d.balance : 0;
  const depositPct = depositRatio * 100;
  const returnPct = returnRatio * 100;
  const basePct = 100 - depositPct - returnPct;
  const returnVar = d.returns >= 0 ? 'var(--bar-return)' : 'var(--bar-return-neg)';
  return {
    height: heightPct + '%',
    background: `linear-gradient(to top, var(--bar-base) ${basePct}%, var(--bar-deposit) ${basePct}% ${basePct + depositPct}%, ${returnVar} ${basePct + depositPct}%)`,
  };
}
