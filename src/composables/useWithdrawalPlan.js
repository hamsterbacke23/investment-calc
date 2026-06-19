import { computed, shallowRef, watch } from 'vue';
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
  durationYears,
  inflationRate,
} from './useInvestmentStore.js';
import {
  TEILFREISTELLUNG,
  TAX_RATE,
  FREIBETRAG,
  einkommensteuer,
  besteuerungsanteil,
  WK_PAUSCHBETRAG_RENTE,
  kvpvRate,
  vorabpauschale,
} from '../utils/tax.js';
import { finalBalance, totalInvested } from './useGrowthCalculations.js';
import { normalShockMatrix } from '../utils/random.js';

// Monte-Carlo sizing: 1.000 Pfade geben stabile Perzentile, 30 Halbierungen
// lösen den Entnahmebetrag auf <1 € genau. Beides läuft client-seitig in ~60-80 ms
// und wird über die immer gleiche (geseedete) Schock-Matrix deterministisch.
const PATHS = 1000;
const SOLVE_ITERS = 30;
const NO_COLLECT = {};

const currentYear = new Date().getFullYear();

// --- One simulated path ----------------------------------------------------
// shockRow = null → der deterministische MEDIAN-Pfad (Wachstumsfaktor exp(driftLog),
// keine Volatilität); sonst ein lognormaler Marktverlauf. Der Median (nicht der
// arithmetische Mittelwert) wird genutzt, damit der Depotverlauf der Einkommens-
// Balken zur p50-Linie des Fan-Charts passt. Steuerlogik ist in beiden Fällen
// identisch. opts.balances füllt die Jahresend-Depotwerte, opts.detailed sammelt
// die vollständige Aufschlüsselung für das Einkommens-Chart.
function simulate(monthlyW1, ctx, shockRow, opts) {
  const { depot0, basis0, n, i, mode, sigmaLog, driftLog } = ctx;
  let depot = depot0;
  let basis = basis0;
  let depletionYear = 0;
  const baseAnnual = monthlyW1 * 12;
  const rows = opts.detailed ? [] : null;

  for (let Y = 1; Y <= n; Y++) {
    const depotStart = depot;
    const growthFactor = shockRow
      ? Math.exp(driftLog + sigmaLog * shockRow[Y - 1])
      : Math.exp(driftLog);
    const grown = depot * growthFactor;
    const valueGain = grown - depotStart;

    const wPlanned = baseAnnual * (mode === 'real' ? Math.pow(1 + i, Y - 1) : 1);
    const wActual = Math.min(wPlanned, Math.max(0, grown));

    // Proportionale Durchschnittsmethode: nur der Gewinnanteil der Entnahme ist
    // steuerpflichtig, der Rest ist Rückzahlung von Anschaffungskosten (Basis).
    const gainFrac = grown > basis ? (grown - basis) / grown : 0;
    const realizedGain = wActual * gainFrac;
    const principal = wActual - realizedGain;
    basis = Math.max(0, basis - principal);
    let depotAfterW = grown - wActual;

    // Vorabpauschale aufs Restdepot — fällt jedes Gewinnjahr an, nicht nur in
    // der Ansparphase. Bereits versteuerte Vorabpauschale erhöht die Basis und
    // mindert so den späteren Veräußerungsgewinn (§19 InvStG, keine Doppelbest.).
    const vorab = vorabpauschale(depotStart, valueGain);
    basis += vorab;

    // Kombinierte Kapitalertragsteuer: Teilfreistellung zuerst, dann der
    // gemeinsame Sparerpauschbetrag, dann 26,375 %. Aufteilung in den Anteil auf
    // die Entnahme (mindert das Netto-Einkommen) und auf die Vorabpauschale
    // (wird im Januar aus dem Depot gebucht).
    const tfRealized = realizedGain * (1 - TEILFREISTELLUNG);
    const tfVorab = vorab * (1 - TEILFREISTELLUNG);
    const tfTotal = tfRealized + tfVorab;
    const taxableInvest = Math.max(0, tfTotal - FREIBETRAG);
    const investTax = taxableInvest * TAX_RATE;
    const realizedShare = tfTotal > 0 ? tfRealized / tfTotal : 0;
    const realizedTax = investTax * realizedShare;
    const vorabTax = investTax - realizedTax;

    const netWithdrawal = wActual - realizedTax;
    depot = Math.max(0, depotAfterW - vorabTax);

    // Plan "gescheitert" sobald die geplante Entnahme nicht mehr voll gedeckt ist.
    if (!depletionYear && wActual < wPlanned - 0.5) depletionYear = Y;

    if (opts.balances) opts.balances[Y - 1] = depot;
    if (rows) {
      rows.push({
        year: Y,
        balance: depot,
        withdrawal: wActual,
        returns: valueGain,
        realizedGain,
        tax: realizedTax,
        net: netWithdrawal,
      });
    }
  }

  return { depletionYear, endBalance: depot, survived: depletionYear === 0, rows };
}

// A path "succeeds" if it funds the full planned withdrawal every year AND
// (for the capital-preservation target) ends at or above the required balance.
function isSuccess(res, targetEnd) {
  return res.survived && res.endBalance >= targetEnd - 1;
}

// Binary-search the year-1 monthly withdrawal whose success rate across all
// simulated paths matches the target (higher withdrawal → lower success).
function solveMonthlyW1(ctx, shocks) {
  if (ctx.depot0 <= 0) return 0;
  let lo = 0;
  let hi = ctx.depot0; // absurdly high → ~0 % success, valid upper bound
  for (let it = 0; it < SOLVE_ITERS; it++) {
    const mid = (lo + hi) / 2;
    let ok = 0;
    for (let p = 0; p < PATHS; p++) {
      if (isSuccess(simulate(mid, ctx, shocks[p], NO_COLLECT), ctx.targetEnd)) ok++;
    }
    if (ok / PATHS >= ctx.targetSuccess) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

// Linear-interpolated percentile of an ascending-sorted typed array.
function percentile(sorted, p) {
  const len = sorted.length;
  if (len === 0) return 0;
  const idx = (p / 100) * (len - 1);
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo];
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
}

// Net statutory pension: gross (today's €) minus KV/PV minus income tax (§32a on
// the taxable share). Computed once in real terms — the real pension is constant
// over the plan — and returned as a net factor applied to the gross each year.
// Simplification: this assumes the §32a tariff stays inflation-indexed over time
// (so the real effective tax rate is constant) and ignores the frozen-Rentenfreibetrag
// effect; in reality late-year tax is marginally higher, so net pension is a touch
// optimistic in the out-years.
function pensionNetFactor() {
  const pmToday = Math.max(0, pensionMonthly.value);
  if (pmToday <= 0) return { factor: 0, kvpvRate: 0, taxRate: 0 };

  const yearsUntilPension = Math.max(0, pensionStartAge.value - withdrawalStartAge.value);
  const rentenbeginnYear = currentYear + durationYears.value + yearsUntilPension;
  const taxableShare = besteuerungsanteil(rentenbeginnYear);
  const kv = kvpvRate(pensionHasChildren.value);

  const grossAnnual = pmToday * 12;
  const kvpvAmount = grossAnnual * kv;
  // KV/PV-Beiträge sind als Sonderausgaben abziehbar → mindern das z.v.E.
  const zvE = Math.max(0, grossAnnual * taxableShare - WK_PAUSCHBETRAG_RENTE - kvpvAmount);
  const incomeTax = einkommensteuer(zvE);
  const netAnnual = grossAnnual - kvpvAmount - incomeTax;

  return {
    factor: netAnnual / grossAnnual,
    kvpvRate: kv,
    taxRate: incomeTax / grossAnnual,
  };
}

// --- The single heavy computation: solve + fan + expected income path ------
// Exported (in addition to the debounced reactive wrappers below) so tests can
// run a scenario synchronously without waiting on the debounce.
export function computeWithdrawalPlan() {
  const depot0 = finalBalance.value;
  const empty = {
    rows: [],
    fanBands: [],
    summary: emptySummary(),
  };
  if (depot0 <= 0) return empty;

  const basis0 = Math.min(totalInvested.value, depot0);
  const n = Math.max(1, withdrawalPlanYears.value);
  const i = inflationRate.value / 100;
  const mode = withdrawalMode.value === 'real' ? 'real' : 'nominal';
  const decay = !!allowCapitalDecay.value;

  const muNet = (withdrawalReturnRate.value - etfCostRate.value) / 100;
  const sigmaLog = Math.max(0, withdrawalVolatility.value / 100);
  // Lognormal drift chosen so the arithmetic mean growth equals 1 + muNet.
  const driftLog = Math.log(1 + Math.max(-0.99, muNet)) - 0.5 * sigmaLog * sigmaLog;

  const targetEnd = decay ? 0 : mode === 'real' ? depot0 * Math.pow(1 + i, n) : depot0;
  const targetSuccess = targetSuccessRate.value / 100;

  const ctx = { depot0, basis0, n, i, mode, muNet, sigmaLog, driftLog, targetEnd, targetSuccess };
  const shocks = normalShockMatrix(PATHS, n);

  const monthlyW1 = solveMonthlyW1(ctx, shocks);

  // Infeasibility check: if even a zero withdrawal can't reach the success target
  // (typical for real capital-preservation under high volatility), the solver
  // collapses to ~0. Flag it so the UI says "Ziel nicht erreichbar" instead of
  // presenting a 0 €/Monat plan as if it were the answer.
  let zeroOk = 0;
  for (let p = 0; p < PATHS; p++) {
    if (isSuccess(simulate(0, ctx, shocks[p], NO_COLLECT), targetEnd)) zeroOk++;
  }
  const infeasible = zeroOk / PATHS < targetSuccess - 0.005;

  // --- Fan pass: distribution of depot balance + plan reach across all paths ---
  const balancesByYear = Array.from({ length: n }, () => new Float64Array(PATHS));
  const reach = new Int16Array(PATHS); // plan year the depot ran dry, or n+1 if it lasted
  const tmpBal = new Float64Array(n);
  let successCount = 0;
  for (let p = 0; p < PATHS; p++) {
    const res = simulate(monthlyW1, ctx, shocks[p], { balances: tmpBal });
    for (let y = 0; y < n; y++) balancesByYear[y][p] = tmpBal[y];
    reach[p] = res.depletionYear === 0 ? n + 1 : res.depletionYear;
    if (isSuccess(res, targetEnd)) successCount++;
  }

  const fanBands = [];
  for (let y = 0; y < n; y++) {
    const sorted = balancesByYear[y].slice().sort();
    fanBands.push({
      year: y + 1,
      age: withdrawalStartAge.value + y,
      p10: Math.round(percentile(sorted, 10)),
      p50: Math.round(percentile(sorted, 50)),
      p90: Math.round(percentile(sorted, 90)),
    });
  }

  const reachSorted = reach.slice().sort();
  const medianReachYear = percentile(reachSorted, 50);
  const p10ReachYear = percentile(reachSorted, 10); // bad-case: the early-depleting tail
  const successRate = (successCount / PATHS) * 100;
  const medianEndBalance = fanBands.length ? fanBands[n - 1].p50 : 0;

  // --- Expected income path (deterministic) drives the income bars ---
  const { rows: rawRows } = simulate(monthlyW1, ctx, null, { detailed: true });

  // Layer the net pension on top, in nominal terms, growing with inflation.
  const yearsUntilPension = Math.max(0, pensionStartAge.value - withdrawalStartAge.value);
  const pmToday = Math.max(0, pensionMonthly.value);
  const pNet = pensionNetFactor();

  const rows = rawRows.map((r) => {
    const absoluteYearOffset = durationYears.value + (r.year - 1);
    const realFactor = Math.pow(1 + i, absoluteYearOffset);

    const pensionActive = pmToday > 0 && r.year > yearsUntilPension;
    const pensionGrossNominal = pensionActive ? pmToday * realFactor * 12 : 0;
    const pensionNetNominal = pensionGrossNominal * pNet.factor;

    const totalNetNominal = r.net + pensionNetNominal;

    return {
      year: r.year,
      age: withdrawalStartAge.value + (r.year - 1),
      balance: Math.round(r.balance),
      withdrawal: Math.round(r.withdrawal),
      returns: Math.round(r.returns),
      realizedGain: Math.round(r.realizedGain),
      tax: Math.round(r.tax),
      net: Math.round(r.net),
      pension: Math.round(pensionNetNominal),
      pensionGross: Math.round(pensionGrossNominal),
      pensionMonthly: Math.round(pensionNetNominal / 12),
      pensionActive,
      totalNet: Math.round(totalNetNominal),
      totalNetReal: Math.round(totalNetNominal / realFactor),
      netReal: Math.round(r.net / realFactor),
      pensionReal: Math.round(pensionNetNominal / realFactor),
      depleted: r.balance <= 0,
    };
  });

  const summary = buildSummary({
    rows,
    n,
    mode,
    decay,
    depot0,
    monthlyW1,
    successRate,
    medianReachYear,
    p10ReachYear,
    medianEndBalance,
    fanBands,
    pNet,
    pmToday,
    yearsUntilPension,
    infeasible,
  });

  return { rows, fanBands, summary };
}

function emptySummary() {
  return {
    monthlyGross: 0, monthlyNet: 0, monthlyNetEnd: 0,
    annualGross: 0, annualNet: 0, annualNetEnd: 0,
    annualTotalIncome: 0, annualTotalIncomeEnd: 0,
    monthlyTotalIncome: 0, monthlyTotalIncomeEnd: 0,
    monthlyRealStart: 0, monthlyRealEnd: 0,
    lastYear: 0, totalTax: 0, totalRealizedGain: 0, effectiveRate: '0.0',
    endBalance: finalBalance.value,
    depletionYear: null, depletedEarly: false,
    mode: withdrawalMode.value,
    pensionStarts: null, pensionStartAge: pensionStartAge.value,
    pensionMonthlyStart: 0, pensionGrossMonthlyStart: 0, hasPension: pensionMonthly.value > 0,
    successRate: 0, targetSuccess: targetSuccessRate.value,
    medianReachAge: 0, p10ReachAge: 0, lastsFullHorizon: false, horizonEndAge: 0,
    withdrawalRatePct: '0.0',
    guaranteedMonthlyReal: 0, atRiskMonthlyReal: 0,
    pensionKvpvRate: 0, pensionTaxRate: 0,
    infeasible: false,
  };
}

function buildSummary(d) {
  const { rows, n, mode, decay, depot0, monthlyW1, pNet, pmToday, yearsUntilPension } = d;
  const first = rows[0];
  const last = rows[rows.length - 1];
  const totalTax = rows.reduce((acc, r) => acc + r.tax, 0);
  const totalRealizedGain = rows.reduce((acc, r) => acc + r.realizedGain, 0);

  const lastsFullHorizon = d.medianReachYear > n;
  const medianReachAge = withdrawalStartAge.value + Math.round(Math.min(d.medianReachYear, n + 1)) - 1;
  const p10ReachAge = withdrawalStartAge.value + Math.round(Math.min(d.p10ReachYear, n + 1)) - 1;
  const depletedEarly = d.p10ReachYear < n; // a meaningful share of paths run dry early

  const firstPensionRow = rows.find((r) => r.pensionActive);
  const pensionStarts = pmToday > 0 ? yearsUntilPension + 1 : null;

  const withdrawalRatePct = depot0 > 0 ? ((monthlyW1 * 12) / depot0 * 100).toFixed(1) : '0.0';

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
    effectiveRate: totalRealizedGain > 0 ? ((totalTax / totalRealizedGain) * 100).toFixed(1) : '0.0',
    endBalance: d.medianEndBalance,
    depletionYear: d.p10ReachYear <= n ? Math.round(d.p10ReachYear) : null,
    depletedEarly,
    mode,
    pensionStarts,
    pensionStartAge: pensionStartAge.value,
    pensionMonthlyStart: firstPensionRow ? firstPensionRow.pensionMonthly : 0,
    pensionGrossMonthlyStart: firstPensionRow ? Math.round(firstPensionRow.pensionGross / 12) : 0,
    hasPension: pmToday > 0,
    // --- Monte-Carlo headline figures ---
    successRate: Math.round(d.successRate),
    targetSuccess: targetSuccessRate.value,
    medianReachAge,
    p10ReachAge,
    horizonEndAge: withdrawalStartAge.value + n - 1,
    lastsFullHorizon,
    withdrawalRatePct,
    // --- guaranteed (net pension, real) vs. at-risk (depot, real) ---
    guaranteedMonthlyReal: firstPensionRow ? Math.round(firstPensionRow.pensionReal / 12) : 0,
    atRiskMonthlyReal: Math.round(first.netReal / 12),
    pensionKvpvRate: pNet.kvpvRate || 0,
    pensionTaxRate: pNet.taxRate || 0,
    infeasible: !!d.infeasible,
  };
}

// The MC solve is the heaviest work in the app; inside a plain computed it would
// re-run on every slider tick and jank the UI (worst on mobile, where the controls
// live in the drawer). Instead we hold the result in a ref and recompute on a short
// debounce — the first change (store hydration from URL/localStorage) runs eagerly
// to avoid a flash of the default plan, later edits are debounced.
const planRef = shallowRef(computeWithdrawalPlan());
let recomputeTimer = null;
let primed = false;
watch(
  [
    finalBalance, totalInvested, allowCapitalDecay, withdrawalPlanYears, withdrawalReturnRate,
    withdrawalMode, pensionMonthly, pensionStartAge, withdrawalStartAge, pensionHasChildren,
    withdrawalVolatility, targetSuccessRate, etfCostRate, durationYears, inflationRate,
  ],
  () => {
    if (!primed) {
      primed = true;
      planRef.value = computeWithdrawalPlan();
      return;
    }
    clearTimeout(recomputeTimer);
    recomputeTimer = setTimeout(() => {
      planRef.value = computeWithdrawalPlan();
    }, 160);
  },
);

export const calculateWithdrawalData = computed(() => planRef.value.rows);
export const withdrawalTaxInfo = computed(() => planRef.value.summary);
export const withdrawalFanBands = computed(() => planRef.value.fanBands);

// The withdrawal chart visualises INCOME, not the depot balance: each bar is the
// total net income of that year (net depot withdrawal + net pension).
export const maxWithdrawalIncome = computed(() => {
  const values = calculateWithdrawalData.value.map((x) => x.totalNet);
  return Math.max(...values, 1);
});

export const maxWithdrawalBalance = computed(() => {
  const values = calculateWithdrawalData.value.map((x) => x.balance);
  return Math.max(...values, 1);
});

// Bar = total net income for the year. Stacked: net depot withdrawal (bottom),
// net statutory pension on top — the income jump at pension start stays visible.
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

// Height (% of plot) of the "purchasing power today" line for a given year.
export function withdrawalRealLine(d) {
  const max = maxWithdrawalIncome.value;
  return (d.totalNetReal / max) * 100;
}
