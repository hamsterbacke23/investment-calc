import { computed } from 'vue';
import {
  initialCapital,
  durationYears,
  reinvestGains,
  inflationRate,
  withdrawalRate,
  yieldPhases,
  transactions,
} from './useInvestmentStore.js';
import { calculateTax, inflationAdjusted } from '../utils/tax.js';
import { etfData } from '../data/etfBenchmarks.js';

export const calculateData = computed(() => {
  const results = [];
  let currentBalance = initialCapital.value;
  let totalGains = 0;

  for (let year = 1; year <= durationYears.value; year++) {
    const matchingPhases = yieldPhases.value.filter(
      (p) => year >= p.startYear && year <= p.endYear,
    );
    const phase = matchingPhases.length > 0 ? matchingPhases[matchingPhases.length - 1] : { rate: 0 };
    const annualRate = phase.rate / 100;
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
      rate: phase.rate,
      deposits: Math.round(yearDeposits),
      returns: Math.round(yearReturns),
    });
  }
  return results;
});

export const maxBalance = computed(() => Math.max(...calculateData.value.map((x) => x.balance)));

export const totalInvested = computed(() => {
  return initialCapital.value + transactions.value.reduce((acc, t) => {
    const effectiveEnd = !t.customDuration && t.type === 'monthly' ? durationYears.value : t.endYear;
    return acc + (t.amount * (t.type === 'monthly' ? (effectiveEnd - t.startYear + 1) * 12 : 1));
  }, 0);
});

export const finalBalance = computed(() => calculateData.value[calculateData.value.length - 1].balance);

export const taxInfo = computed(() => {
  const fb = finalBalance.value;
  const { gains, tax, afterTax, effectiveRate } = calculateTax(fb, totalInvested.value);
  const inTodaysMoney = inflationAdjusted(tax > 0 ? afterTax : fb, inflationRate.value, durationYears.value);
  const safeRate = Number.isFinite(Number(withdrawalRate.value))
    ? Math.min(10, Math.max(1, Number(withdrawalRate.value)))
    : 4;
  const withdrawalRateDecimal = safeRate / 100;
  const withdrawalAnnualNominal = Math.round(fb * withdrawalRateDecimal);
  const withdrawalAnnualAfterTax = Math.round(afterTax * withdrawalRateDecimal);
  const withdrawalAnnualReal = Math.round(inTodaysMoney * withdrawalRateDecimal);
  return {
    gains,
    tax,
    afterTax,
    inTodaysMoney,
    withdrawalAnnualNominal,
    withdrawalMonthlyNominal: Math.round(withdrawalAnnualNominal / 12),
    withdrawalAnnualAfterTax,
    withdrawalMonthlyAfterTax: Math.round(withdrawalAnnualAfterTax / 12),
    withdrawalAnnualReal,
    withdrawalMonthlyReal: Math.round(withdrawalAnnualReal / 12),
    effectiveRate,
  };
});

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
  const max = maxBalance.value;
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
