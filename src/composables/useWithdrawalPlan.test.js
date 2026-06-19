import { describe, it, expect, beforeEach } from 'vitest';
import { computeWithdrawalPlan } from './useWithdrawalPlan.js';
import {
  initialCapital,
  durationYears,
  reinvestGains,
  inflationRate,
  yieldPhases,
  transactions,
  withdrawalPlanYears,
  allowCapitalDecay,
  withdrawalReturnRate,
  withdrawalMode,
  withdrawalVolatility,
  targetSuccessRate,
  etfCostRate,
  pensionMonthly,
  pensionStartAge,
  withdrawalStartAge,
  pensionHasChildren,
} from './useInvestmentStore.js';

// Pin a known starting depot: no deposits, 0 % growth over 1 year ⇒ depot0 = initialCapital.
function baseScenario() {
  initialCapital.value = 500000;
  durationYears.value = 1;
  reinvestGains.value = true;
  inflationRate.value = 2.5;
  yieldPhases.value = [{ id: 1, startYear: 1, endYear: 1, rateMin: 0, rateMax: 0, customDuration: false }];
  transactions.value = [];
  withdrawalPlanYears.value = 30;
  withdrawalReturnRate.value = 6;
  etfCostRate.value = 0.2;
  withdrawalVolatility.value = 15;
  targetSuccessRate.value = 90;
  allowCapitalDecay.value = true;
  withdrawalMode.value = 'nominal';
  pensionMonthly.value = 0;
  pensionStartAge.value = 67;
  withdrawalStartAge.value = 60;
  pensionHasChildren.value = true;
}

beforeEach(baseScenario);

describe('Monte-Carlo withdrawal engine', () => {
  it('solves a feasible plan close to the target success rate', () => {
    const { summary, rows, fanBands } = computeWithdrawalPlan();
    expect(rows).toHaveLength(30);
    expect(fanBands).toHaveLength(30);
    expect(summary.monthlyGross).toBeGreaterThan(0);
    // 90 % target → solved success within a few percent of it.
    expect(Math.abs(summary.successRate - 90)).toBeLessThanOrEqual(5);
    // Sane withdrawal rate for 100 % equity at 90 % over 30y (well under 6 %).
    expect(parseFloat(summary.withdrawalRatePct)).toBeGreaterThan(1);
    expect(parseFloat(summary.withdrawalRatePct)).toBeLessThan(6);
    expect(summary.infeasible).toBe(false);
  });

  it('is deterministic — identical inputs give an identical plan', () => {
    const a = computeWithdrawalPlan();
    const b = computeWithdrawalPlan();
    expect(b.summary.monthlyGross).toBe(a.summary.monthlyGross);
    expect(b.summary.successRate).toBe(a.summary.successRate);
    expect(b.summary.endBalance).toBe(a.summary.endBalance);
  });

  it('a higher target success rate lowers the sustainable withdrawal', () => {
    targetSuccessRate.value = 75;
    const low = computeWithdrawalPlan().summary.monthlyGross;
    targetSuccessRate.value = 95;
    const high = computeWithdrawalPlan().summary.monthlyGross;
    expect(high).toBeLessThan(low);
  });

  it('flags an infeasible real capital-preservation target instead of returning 0 €', () => {
    allowCapitalDecay.value = false;
    withdrawalMode.value = 'real';
    targetSuccessRate.value = 90;
    const { summary } = computeWithdrawalPlan();
    expect(summary.infeasible).toBe(true);
  });

  it('preserving nominal capital is feasible and yields a positive withdrawal', () => {
    allowCapitalDecay.value = false;
    withdrawalMode.value = 'nominal';
    const { summary } = computeWithdrawalPlan();
    expect(summary.monthlyGross).toBeGreaterThan(0);
  });

  it('taxes the pension: net guaranteed income is below the gross pension', () => {
    pensionMonthly.value = 1500;
    withdrawalStartAge.value = 60;
    pensionStartAge.value = 60; // active from year 1
    const { summary } = computeWithdrawalPlan();
    expect(summary.hasPension).toBe(true);
    expect(summary.guaranteedMonthlyReal).toBeGreaterThan(0);
    expect(summary.guaranteedMonthlyReal).toBeLessThan(1500);
    // ~12,35 % KV/PV + a little tax ⇒ factor in a sensible band.
    expect(summary.guaranteedMonthlyReal).toBeGreaterThan(1500 * 0.8);
  });

  it('returns an empty plan when there is no capital', () => {
    initialCapital.value = 0;
    transactions.value = [];
    const { rows, summary } = computeWithdrawalPlan();
    expect(rows).toHaveLength(0);
    expect(summary.monthlyGross).toBe(0);
  });
});
