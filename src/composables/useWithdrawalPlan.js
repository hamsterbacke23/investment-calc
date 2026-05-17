import { computed } from 'vue';
import {
  initialCapital,
  durationYears,
  transactions,
  allowCapitalDecay,
  withdrawalPlanYears,
  withdrawalReturnRate,
} from './useInvestmentStore.js';
import { calculateTax } from '../utils/tax.js';
import { calculateData, finalBalance } from './useGrowthCalculations.js';

export const calculateWithdrawalData = computed(() => {
  const startingBalance = finalBalance.value;
  const results = [];
  let currentBalance = startingBalance;
  const monthlyReturnRate = Math.pow(1 + withdrawalReturnRate.value / 100, 1 / 12) - 1;
  const nMonths = withdrawalPlanYears.value * 12;
  const monthlyWithdrawal = allowCapitalDecay.value
    ? Math.round(
        currentBalance /
          (((1 - Math.pow(1 + monthlyReturnRate, -nMonths)) / monthlyReturnRate) || nMonths),
      )
    : Math.round((currentBalance * (withdrawalReturnRate.value / 100)) / 12);

  for (let year = 1; year <= withdrawalPlanYears.value; year++) {
    let yearWithdrawals = 0;
    let yearReturns = 0;

    for (let month = 1; month <= 12; month++) {
      const monthlyReturn = currentBalance * monthlyReturnRate;
      yearReturns += monthlyReturn;
      currentBalance += monthlyReturn;

      if (currentBalance > 0) {
        const withdrawal = Math.min(monthlyWithdrawal, currentBalance);
        currentBalance -= withdrawal;
        yearWithdrawals += withdrawal;
      }
    }

    results.push({
      year,
      balance: Math.round(currentBalance),
      withdrawal: Math.round(yearWithdrawals),
      returns: Math.round(yearReturns),
    });

    if (currentBalance <= 0) break;
  }
  return results;
});

export const maxWithdrawalBalance = computed(() => {
  const values = calculateWithdrawalData.value.map((x) => x.balance);
  return Math.max(...values, 1);
});

export const monthlyWithdrawalAmount = computed(() => {
  if (calculateWithdrawalData.value.length === 0) return 0;
  const totalAnnual = calculateWithdrawalData.value[0].withdrawal;
  return Math.round(totalAnnual / 12);
});

export const withdrawalTaxInfo = computed(() => {
  const grossStartBalance = finalBalance.value;
  const totalInvestedAmount =
    initialCapital.value +
    transactions.value.reduce((acc, t) => {
      const effectiveEnd =
        !t.customDuration && t.type === 'monthly' ? durationYears.value : t.endYear;
      return acc + (t.amount * (t.type === 'monthly' ? (effectiveEnd - t.startYear + 1) * 12 : 1));
    }, 0);
  const { tax: totalTax, effectiveRate } = calculateTax(grossStartBalance, totalInvestedAmount);
  const netStartBalance = grossStartBalance - totalTax;
  const monthlyGross = monthlyWithdrawalAmount.value;
  const annualGross = monthlyGross * 12;
  const taxPercentage = grossStartBalance > 0 ? totalTax / grossStartBalance : 0;
  const monthlyTaxPortion = Math.round(monthlyGross * taxPercentage);
  const monthlyNet = monthlyGross - monthlyTaxPortion;
  const annualNet = monthlyNet * 12;

  return {
    grossStartBalance,
    netStartBalance,
    totalTax,
    monthlyGross,
    monthlyNet,
    annualGross,
    annualNet,
    effectiveRate,
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

// Re-export for convenience
export { calculateData };
