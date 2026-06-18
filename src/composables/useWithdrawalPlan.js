import { computed } from 'vue';
import {
  allowCapitalDecay,
  withdrawalPlanYears,
  withdrawalReturnRate,
  withdrawalMode,
  pensionMonthly,
  pensionStartAge,
  withdrawalStartAge,
  durationYears,
  inflationRate,
} from './useInvestmentStore.js';
import { EFFECTIVE_GAIN_TAX_RATE, FREIBETRAG } from '../utils/tax.js';
import { finalBalance, totalInvested } from './useGrowthCalculations.js';

const T = EFFECTIVE_GAIN_TAX_RATE;

// One simulation pass. mode: 'nominal' | 'real'. monthlyW1 = year-1 monthly withdrawal.
// In real mode, monthly withdrawal in year Y = monthlyW1 * (1+i)^(Y-1).
function simulate(monthlyW1, depot0, basis0, mode, n, rm, i, collect) {
  let depot = depot0;
  let basis = basis0;
  const rows = collect ? [] : null;
  let depleted = false;
  let lastYear = 0;

  for (let year = 1; year <= n; year++) {
    const yearMul = mode === 'real' ? Math.pow(1 + i, year - 1) : 1;
    const monthlyW = monthlyW1 * yearMul;
    let yearWithdrawals = 0;
    let yearReturns = 0;
    let yearRealizedGain = 0;

    for (let m = 0; m < 12; m++) {
      const ret = depot * rm;
      yearReturns += ret;
      depot += ret;

      if (depot > 0) {
        const w = Math.min(monthlyW, depot);
        const g = depot > 0 ? Math.max(0, (depot - basis) / depot) : 0;
        const realized = w * g;
        const principal = w - realized;
        yearRealizedGain += realized;
        basis = Math.max(0, basis - principal);
        depot -= w;
        yearWithdrawals += w;
      }
    }

    const taxableGain = Math.max(0, yearRealizedGain - FREIBETRAG);
    const yearTax = taxableGain * T;
    const yearNet = yearWithdrawals - yearTax;

    lastYear = year;

    if (collect) {
      rows.push({
        year,
        balance: depot,
        withdrawal: yearWithdrawals,
        returns: yearReturns,
        realizedGain: yearRealizedGain,
        tax: yearTax,
        net: yearNet,
        depleted: depot <= 0,
      });
    }

    if (depot <= 0) {
      depleted = true;
      break;
    }
  }

  return { rows, endBalance: depot, depleted, lastYear };
}

// Binary search for the year-1 monthly withdrawal that meets the target end balance.
function solveMonthlyW1(depot0, basis0, mode, decay, n, rm, i) {
  const targetEnd = decay
    ? 0
    : (mode === 'real' ? depot0 * Math.pow(1 + i, n) : depot0);

  if (depot0 <= 0) return 0;

  let lo = 0;
  let hi = depot0; // upper bound: more than enough to drain depot quickly
  for (let iter = 0; iter < 80; iter++) {
    const mid = (lo + hi) / 2;
    const { endBalance } = simulate(mid, depot0, basis0, mode, n, rm, i, false);
    if (endBalance > targetEnd) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

export const calculateWithdrawalData = computed(() => {
  const startingBalance = finalBalance.value;
  const startingBasis = Math.min(totalInvested.value, startingBalance);

  if (startingBalance <= 0) return [];

  const monthlyReturnRate = Math.pow(1 + withdrawalReturnRate.value / 100, 1 / 12) - 1;
  const i = inflationRate.value / 100;
  const n = withdrawalPlanYears.value;
  const mode = withdrawalMode.value === 'real' ? 'real' : 'nominal';
  const decay = !!allowCapitalDecay.value;

  const monthlyW1 = solveMonthlyW1(
    startingBalance,
    startingBasis,
    mode,
    decay,
    n,
    monthlyReturnRate,
    i,
  );

  const { rows } = simulate(
    monthlyW1,
    startingBalance,
    startingBasis,
    mode,
    n,
    monthlyReturnRate,
    i,
    true,
  );

  // Layer pension on top: pension is paid in today's purchasing power, grows with inflation.
  // Withdrawal year Y → absolute year offset = durationYears + (Y - 1).
  // Pension active when age = withdrawalStartAge + (Y - 1) >= pensionStartAge
  //   → Y >= pensionStartAge - withdrawalStartAge + 1.
  const yearsUntilPension = Math.max(0, pensionStartAge.value - withdrawalStartAge.value);
  const pmToday = Math.max(0, pensionMonthly.value);

  return rows.map((r) => {
    const absoluteYearOffset = durationYears.value + (r.year - 1);
    const inflFactor = Math.pow(1 + i, absoluteYearOffset);
    const realFactor = inflFactor; // divide nominal by this to get today's € value

    const pensionActive = pmToday > 0 && r.year > yearsUntilPension;
    const pensionMonthlyNominal = pensionActive ? pmToday * inflFactor : 0;
    const pensionAnnualNominal = pensionMonthlyNominal * 12;

    const totalNetNominal = r.net + pensionAnnualNominal;
    const totalNetReal = totalNetNominal / realFactor;
    const withdrawalNetReal = r.net / realFactor;
    const pensionRealAnnual = pensionAnnualNominal / realFactor;

    return {
      year: r.year,
      age: withdrawalStartAge.value + (r.year - 1),
      balance: Math.round(r.balance),
      withdrawal: Math.round(r.withdrawal),
      returns: Math.round(r.returns),
      realizedGain: Math.round(r.realizedGain),
      tax: Math.round(r.tax),
      net: Math.round(r.net),
      pension: Math.round(pensionAnnualNominal),
      pensionMonthly: Math.round(pensionMonthlyNominal),
      pensionActive,
      totalNet: Math.round(totalNetNominal),
      totalNetReal: Math.round(totalNetReal),
      netReal: Math.round(withdrawalNetReal),
      pensionReal: Math.round(pensionRealAnnual),
      depleted: r.depleted,
    };
  });
});

// The withdrawal chart visualises INCOME, not the depot balance: each bar is the
// total net income of that year (net depot withdrawal + pension), so the pension
// reads as a stacked segment and a real-income line can be laid over the bars.
export const maxWithdrawalIncome = computed(() => {
  const values = calculateWithdrawalData.value.map((x) => x.totalNet);
  return Math.max(...values, 1);
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
      annualTotalIncome: 0,
      annualTotalIncomeEnd: 0,
      monthlyTotalIncome: 0,
      monthlyTotalIncomeEnd: 0,
      monthlyRealStart: 0,
      monthlyRealEnd: 0,
      lastYear: 0,
      totalTax: 0,
      totalRealizedGain: 0,
      effectiveRate: '0.0',
      endBalance: finalBalance.value,
      depletionYear: null,
      depletedEarly: false,
      mode: withdrawalMode.value,
      pensionStarts: null,
      pensionStartAge: pensionStartAge.value,
      pensionMonthlyStart: 0,
      hasPension: pensionMonthly.value > 0,
    };
  }
  const first = rows[0];
  const last = rows[rows.length - 1];
  const totalTax = rows.reduce((acc, r) => acc + r.tax, 0);
  const totalRealizedGain = rows.reduce((acc, r) => acc + r.realizedGain, 0);
  const depletionRow = rows.find((r) => r.depleted);
  const depletedEarly = !!depletionRow && depletionRow.year < withdrawalPlanYears.value;

  const yearsUntilPension = Math.max(0, pensionStartAge.value - withdrawalStartAge.value);
  const pensionStarts = pensionMonthly.value > 0
    ? yearsUntilPension + 1
    : null;
  const firstPensionRow = rows.find((r) => r.pensionActive);
  const pensionMonthlyStart = firstPensionRow ? Math.round(firstPensionRow.pension / 12) : 0;

  return {
    monthlyGross: Math.round(first.withdrawal / 12),
    monthlyNet: Math.round(first.net / 12),
    monthlyNetEnd: Math.round(last.net / 12),
    annualGross: first.withdrawal,
    annualNet: first.net,
    annualNetEnd: last.net,
    annualTotalIncome: first.totalNet,
    annualTotalIncomeEnd: last.totalNet,
    monthlyTotalIncome: Math.round(first.totalNet / 12),
    monthlyTotalIncomeEnd: Math.round(last.totalNet / 12),
    monthlyRealStart: Math.round(first.totalNetReal / 12),
    monthlyRealEnd: Math.round(last.totalNetReal / 12),
    lastYear: last.year,
    totalTax: Math.round(totalTax),
    totalRealizedGain: Math.round(totalRealizedGain),
    effectiveRate:
      totalRealizedGain > 0
        ? ((totalTax / totalRealizedGain) * 100).toFixed(1)
        : '0.0',
    endBalance: last.balance,
    depletionYear: depletionRow ? depletionRow.year : null,
    depletedEarly,
    mode: withdrawalMode.value,
    pensionStarts,
    pensionStartAge: pensionStartAge.value,
    pensionMonthlyStart,
    hasPension: pensionMonthly.value > 0,
  };
});

// Bar = total net income for the year. Stacked: net depot withdrawal (bottom),
// statutory pension on top — making the income jump at pension start visible.
export function withdrawalBarStyle(d) {
  const max = maxWithdrawalIncome.value;
  const heightPct = (d.totalNet / max) * 100;
  const total = d.totalNet > 0 ? d.totalNet : 1;
  const netPct = (d.net / total) * 100;
  return {
    height: heightPct + '%',
    background: `linear-gradient(to top,
      var(--bar-deposit) 0%,
      var(--bar-deposit) ${netPct}%,
      var(--bar-pension) ${netPct}%,
      var(--bar-pension) 100%)`,
  };
}

// Height (% of plot) of the "purchasing power today" line point for a given year.
// totalNetReal is the total income discounted back to today, so the line sits
// below the nominal bars and the widening gap visualises inflation erosion.
export function withdrawalRealLine(d) {
  const max = maxWithdrawalIncome.value;
  return (d.totalNetReal / max) * 100;
}
