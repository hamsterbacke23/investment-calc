import { computed } from 'vue';
import {
  allowCapitalDecay,
  withdrawalPlanYears,
  withdrawalReturnRate,
  taxCouple,
} from './useInvestmentStore.js';
import { EFFECTIVE_GAIN_TAX_RATE, freibetragFor } from '../utils/tax.js';
import { finalBalance, totalInvested } from './useGrowthCalculations.js';

export const calculateWithdrawalData = computed(() => {
  const startingBalance = finalBalance.value;
  const startingBasis = Math.min(totalInvested.value, startingBalance);
  const results = [];

  let depot = startingBalance;
  let basis = startingBasis;
  const monthlyReturnRate = Math.pow(1 + withdrawalReturnRate.value / 100, 1 / 12) - 1;
  const nMonths = withdrawalPlanYears.value * 12;
  const monthlyGross = allowCapitalDecay.value
    ? Math.round(
        depot /
          (((1 - Math.pow(1 + monthlyReturnRate, -nMonths)) / monthlyReturnRate) || nMonths),
      )
    : Math.round((depot * (withdrawalReturnRate.value / 100)) / 12);

  const pauschbetrag = freibetragFor(taxCouple.value);
  const T = EFFECTIVE_GAIN_TAX_RATE;

  for (let year = 1; year <= withdrawalPlanYears.value; year++) {
    let yearWithdrawals = 0;
    let yearReturns = 0;
    let yearRealizedGain = 0;

    for (let month = 1; month <= 12; month++) {
      const monthlyReturn = depot * monthlyReturnRate;
      yearReturns += monthlyReturn;
      depot += monthlyReturn;

      if (depot > 0) {
        const withdrawal = Math.min(monthlyGross, depot);
        const g = Math.max(0, (depot - basis) / depot);
        const realized = withdrawal * g;
        const principalPart = withdrawal - realized;
        yearRealizedGain += realized;
        basis = Math.max(0, basis - principalPart);
        depot -= withdrawal;
        yearWithdrawals += withdrawal;
      }
    }

    const taxableGain = Math.max(0, yearRealizedGain - pauschbetrag);
    const yearTax = taxableGain * T;
    const yearNet = yearWithdrawals - yearTax;

    results.push({
      year,
      balance: Math.round(depot),
      withdrawal: Math.round(yearWithdrawals),
      returns: Math.round(yearReturns),
      realizedGain: Math.round(yearRealizedGain),
      tax: Math.round(yearTax),
      net: Math.round(yearNet),
      depleted: depot <= 0,
    });

    if (depot <= 0) break;
  }
  return results;
});

export const maxWithdrawalBalance = computed(() => {
  const values = calculateWithdrawalData.value.map((x) => x.balance);
  return Math.max(...values, 1);
});

export const withdrawalTaxInfo = computed(() => {
  const rows = calculateWithdrawalData.value;
  if (rows.length === 0) {
    return {
      monthlyGross: 0,
      monthlyNet: 0,
      monthlyNetEnd: 0,
      annualGross: 0,
      annualNet: 0,
      annualNetEnd: 0,
      lastYear: 0,
      totalTax: 0,
      totalRealizedGain: 0,
      effectiveRate: '0.0',
      endBalance: finalBalance.value,
      depletionYear: null,
    };
  }
  const first = rows[0];
  const last = rows[rows.length - 1];
  const totalTax = rows.reduce((acc, r) => acc + r.tax, 0);
  const totalRealizedGain = rows.reduce((acc, r) => acc + r.realizedGain, 0);
  const depletionRow = rows.find((r) => r.depleted);
  return {
    monthlyGross: Math.round(first.withdrawal / 12),
    monthlyNet: Math.round(first.net / 12),
    monthlyNetEnd: Math.round(last.net / 12),
    annualGross: first.withdrawal,
    annualNet: first.net,
    annualNetEnd: last.net,
    lastYear: last.year,
    totalTax: Math.round(totalTax),
    totalRealizedGain: Math.round(totalRealizedGain),
    effectiveRate:
      totalRealizedGain > 0
        ? ((totalTax / totalRealizedGain) * 100).toFixed(1)
        : '0.0',
    endBalance: last.balance,
    depletionYear: depletionRow ? depletionRow.year : null,
  };
});

export function withdrawalBarStyle(d) {
  const max = maxWithdrawalBalance.value;
  const heightPct = (d.balance / max) * 100;
  const withdrawalRatio = d.balance > 0 ? Math.abs(d.withdrawal) / d.balance : 0;
  const returnRatio = d.balance > 0 ? Math.abs(d.returns) / d.balance : 0;
  const withdrawalPct = withdrawalRatio * 100;
  const returnPct = returnRatio * 100;
  const basePct = 100 - withdrawalPct - returnPct;
  return {
    height: heightPct + '%',
    background: `linear-gradient(to top, var(--bar-base) ${basePct}%, var(--bar-return) ${basePct}% ${basePct + returnPct}%, rgba(74, 158, 168, 0.4) ${basePct + returnPct}%)`,
  };
}
