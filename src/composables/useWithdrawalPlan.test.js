import { describe, it, expect, beforeEach } from 'vitest';
import { computeWithdrawalPlan, vpwRate } from './useWithdrawalPlan.js';
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
  vpwReturn,
  pensionMonthly,
  pensionStartAge,
  withdrawalStartAge,
  pensionHasChildren,
  bridgeIncome,
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
  vpwReturn.value = 4;
  allowCapitalDecay.value = true;
  withdrawalMode.value = 'nominal';
  pensionMonthly.value = 0;
  pensionStartAge.value = 67;
  withdrawalStartAge.value = 60;
  pensionHasChildren.value = true;
  bridgeIncome.value = false;
}

beforeEach(baseScenario);

describe('VPW amortisation rate', () => {
  it('matches the formula and the g=4,4 % / N=30 control (~6,1 %)', () => {
    expect(vpwRate(0.044, 30)).toBeCloseTo(0.0607, 3);
    expect(vpwRate(0, 25)).toBeCloseTo(1 / 25, 6); // g=0 → 1/N annuity
  });

  it('rises as the horizon shrinks and caps at 100 % in the final year', () => {
    expect(vpwRate(0.04, 30)).toBeLessThan(vpwRate(0.04, 10));
    expect(vpwRate(0.04, 10)).toBeLessThan(vpwRate(0.04, 2));
    expect(vpwRate(0.04, 1)).toBe(1);
    expect(vpwRate(0.04, 0)).toBe(1);
  });
});

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

  it('dynamic (VPW) draws the depot down to ~0 and yields an income band', () => {
    withdrawalMode.value = 'real';
    const real = computeWithdrawalPlan();

    withdrawalMode.value = 'dynamic';
    const dyn = computeWithdrawalPlan();

    expect(dyn.summary.isDynamic).toBe(true);
    // Income varies by market path → a real P10..P90 band with genuine spread.
    expect(dyn.incomeBands.length).toBe(30);
    expect(dyn.incomeBands[10].p90).toBeGreaterThan(dyn.incomeBands[10].p10);
    // VPW spends the depot down to ~0 by the horizon — far below constant-real.
    expect(dyn.summary.endBalance).toBeLessThan(real.summary.endBalance);
    expect(dyn.summary.endBalance).toBeLessThan(500000 * 0.05);
    expect(dyn.summary.endBalanceReal).toBeLessThan(real.summary.endBalanceReal);
    // Start rate ≈ the VPW formula for g=4 %, N=30 (~5,7 %).
    expect(parseFloat(dyn.summary.vpwStartRatePct)).toBeCloseTo(vpwRate(0.04, 30) * 100, 1);
    // Income-volatility figures are populated for VPW.
    expect(dyn.summary.vpwWorst5DropPct).toBeLessThanOrEqual(0);
    expect(dyn.summary.vpwIncomeP10Late).toBeGreaterThan(0);
  });

  it('the VPW return g sizes the withdrawal independently of the market mean', () => {
    withdrawalMode.value = 'dynamic';
    vpwReturn.value = 2;
    const low = computeWithdrawalPlan().summary.dynIncomeMedianStart;
    vpwReturn.value = 6;
    const high = computeWithdrawalPlan().summary.dynIncomeMedianStart;
    expect(high).toBeGreaterThan(low); // higher g → larger initial withdrawal
  });

  it('the income bridge smooths the pension step (pre-pays the pension)', () => {
    withdrawalMode.value = 'dynamic';
    pensionMonthly.value = 1300;
    withdrawalStartAge.value = 59;
    pensionStartAge.value = 63;
    const at = (ib, age) => ib.find((b) => b.age === age).p50;

    bridgeIncome.value = false;
    const no = computeWithdrawalPlan().incomeBands;
    bridgeIncome.value = true;
    const br = computeWithdrawalPlan().incomeBands;

    // Pre-pension income is higher with the bridge (the depot pre-pays the pension).
    expect(at(br, 61)).toBeGreaterThan(at(no, 61));
    // The jump at pension start (age 62 → 63) is much smaller — essentially level.
    const stepNo = Math.abs(at(no, 63) / at(no, 62) - 1);
    const stepBr = Math.abs(at(br, 63) / at(br, 62) - 1);
    expect(stepBr).toBeLessThan(stepNo);
    expect(stepBr).toBeLessThan(0.05);
  });

  it('returns an empty plan when there is no capital', () => {
    initialCapital.value = 0;
    transactions.value = [];
    const { rows, summary } = computeWithdrawalPlan();
    expect(rows).toHaveLength(0);
    expect(summary.monthlyGross).toBe(0);
  });
});
