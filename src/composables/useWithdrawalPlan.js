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
  bridgeIncome,
  withdrawalVolatility,
  targetSuccessRate,
  etfCostRate,
  vpwReturn,
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

// VPW amortisation rate for `remaining` years at assumed (real) return g.
// rate = g / (1 − (1+g)^−N); → 1/N for g=0; capped at 1 (last year takes all).
export function vpwRate(g, remaining) {
  const N = Math.max(1, remaining);
  if (N <= 1) return 1;
  const r = g === 0 ? 1 / N : g / (1 - Math.pow(1 + g, -N));
  return Math.min(1, r);
}

// --- One simulated path ----------------------------------------------------
// shockRow = null → der deterministische MEDIAN-Pfad (Wachstumsfaktor exp(driftLog),
// keine Volatilität); sonst ein lognormaler Marktverlauf. Entnahme-Modi:
//   'nominal'/'real' → die gelöste feste Entnahme (monthlyW1), ggf. inflationsindexiert.
//   'dynamic' (VPW)  → jedes Jahr vpwRate(g, Restjahre) des AKTUELLEN Depots; der Betrag
//                      folgt also dem echten Depotstand (monthlyW1 wird ignoriert).
// Die VPW-Rate ist einheitenlos: angewandt aufs nominale Depot ergibt sie eine Entnahme,
// deren realer Wert dem realen g folgt (keine doppelte Inflation). Steuerlogik identisch.
// opts.balances füllt die Jahresend-Depotwerte, opts.income die Netto-Entnahme je Jahr,
// opts.detailed sammelt die volle Aufschlüsselung fürs Einkommens-Chart.
function simulate(monthlyW1, ctx, shockRow, opts) {
  const { depot0, basis0, n, i, mode, g, sigmaLog, driftLog, bridgeSupp } = ctx;
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

    const baseW =
      mode === 'dynamic'
        ? grown * vpwRate(g, n - Y + 1)
        : baseAnnual * (mode === 'real' ? Math.pow(1 + i, Y - 1) : 1);
    // Income bridge: pre-pension years also draw the pension pre-payment.
    const wPlanned = baseW + (bridgeSupp ? bridgeSupp[Y - 1] : 0);
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
    if (opts.income) opts.income[Y - 1] = netWithdrawal;
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

// Worst forward 5-year real-income change on one path (≤ 0). Captures how hard
// income can fall in a bad stretch — the core downside of dynamic withdrawal.
function worst5yrDrop(realInc, n) {
  let worst = 0;
  for (let y = 0; y + 5 < n; y++) {
    if (realInc[y] > 0) {
      const chg = realInc[y + 5] / realInc[y] - 1;
      if (chg < worst) worst = chg;
    }
  }
  return worst;
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
export function computeWithdrawalPlan(modeOverride) {
  const depot0 = finalBalance.value;
  const empty = {
    rows: [],
    fanBands: [],
    incomeBands: [],
    summary: emptySummary(),
  };
  if (depot0 <= 0) return empty;

  const basis0 = Math.min(totalInvested.value, depot0);
  const n = Math.max(1, withdrawalPlanYears.value);
  const i = inflationRate.value / 100;
  const rawMode = modeOverride ?? withdrawalMode.value;
  const mode = rawMode === 'real' ? 'real' : rawMode === 'dynamic' ? 'dynamic' : 'nominal';
  const isDynamic = mode === 'dynamic';
  const decay = !!allowCapitalDecay.value;

  const muNet = (withdrawalReturnRate.value - etfCostRate.value) / 100;
  const sigmaLog = Math.max(0, withdrawalVolatility.value / 100);
  // Lognormal drift chosen so the arithmetic mean growth equals 1 + muNet.
  const driftLog = Math.log(1 + Math.max(-0.99, muNet)) - 0.5 * sigmaLog * sigmaLog;
  // VPW amortisation return (real) — a SEPARATE assumption that only sizes the
  // withdrawal; the actual returns come from the Monte-Carlo distribution above.
  const g = vpwReturn.value / 100;

  // Dynamic (VPW) spends down to ~0 by construction → target is just "lasts" (≥0).
  const targetEnd =
    decay || isDynamic ? 0 : mode === 'real' ? depot0 * Math.pow(1 + i, n) : depot0;
  const targetSuccess = targetSuccessRate.value / 100;

  // Net pension per plan year (deterministic, layered on top — never part of the
  // amortised depot), plus the real deflator for that year.
  const yearsUntilPension = Math.max(0, pensionStartAge.value - withdrawalStartAge.value);
  const pmToday = Math.max(0, pensionMonthly.value);
  const pNet = pensionNetFactor();
  const realFactorOf = (Y) => Math.pow(1 + i, durationYears.value + (Y - 1));
  const pensionNetNominalOf = (Y) =>
    pmToday > 0 && Y > yearsUntilPension ? pmToday * realFactorOf(Y) * 12 * pNet.factor : 0;

  // Income bridge: during the pre-pension years the depot pre-pays ~the later net
  // pension (nominal), so total income doesn't jump at Rentenbeginn. Only active
  // when the pension actually starts within the horizon. The supplement is an
  // extra depot withdrawal (taxed as such), so the depot is drawn down faster.
  const bridge =
    !!bridgeIncome.value && pmToday > 0 && yearsUntilPension > 0 && yearsUntilPension < n;
  const bridgeSupp = new Float64Array(n);
  if (bridge) {
    for (let Y = 1; Y <= yearsUntilPension && Y <= n; Y++) {
      bridgeSupp[Y - 1] = pmToday * realFactorOf(Y) * 12 * pNet.factor;
    }
  }

  const ctx = {
    depot0, basis0, n, i, mode, g, muNet, sigmaLog, driftLog, targetEnd, targetSuccess, bridgeSupp,
  };
  const shocks = normalShockMatrix(PATHS, n);

  // Fixed-withdrawal modes solve for the sustainable amount; VPW derives it yearly.
  const monthlyW1 = isDynamic ? 0 : solveMonthlyW1(ctx, shocks);

  // Infeasibility only applies to the fixed modes: if even a zero withdrawal can't
  // reach the success target (real capital-preservation under high volatility),
  // the solver collapses to ~0 — flag it instead of showing a 0 €/Monat plan.
  let infeasible = false;
  if (!isDynamic) {
    let zeroOk = 0;
    for (let p = 0; p < PATHS; p++) {
      if (isSuccess(simulate(0, ctx, shocks[p], NO_COLLECT), targetEnd)) zeroOk++;
    }
    infeasible = zeroOk / PATHS < targetSuccess - 0.005;
  }

  // --- Fan pass: depot balance + (for VPW) net real income across all paths ---
  const balancesByYear = Array.from({ length: n }, () => new Float64Array(PATHS));
  const incomeByYear = isDynamic
    ? Array.from({ length: n }, () => new Float64Array(PATHS))
    : null;
  const worstDrops = isDynamic ? new Float64Array(PATHS) : null;
  const tmpRealInc = isDynamic ? new Float64Array(n) : null;
  const reach = new Int16Array(PATHS); // plan year the depot ran dry, or n+1 if it lasted
  const tmpBal = new Float64Array(n);
  const tmpInc = new Float64Array(n);
  let successCount = 0;
  for (let p = 0; p < PATHS; p++) {
    const res = simulate(monthlyW1, ctx, shocks[p], { balances: tmpBal, income: tmpInc });
    for (let y = 0; y < n; y++) {
      balancesByYear[y][p] = tmpBal[y];
      if (incomeByYear) {
        // total net real income = depot net withdrawal + net pension, deflated.
        const ri = (tmpInc[y] + pensionNetNominalOf(y + 1)) / realFactorOf(y + 1);
        incomeByYear[y][p] = ri;
        tmpRealInc[y] = ri;
      }
    }
    if (worstDrops) worstDrops[p] = worst5yrDrop(tmpRealInc, n);
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
      p25: Math.round(percentile(sorted, 25)),
      p50: Math.round(percentile(sorted, 50)),
      p75: Math.round(percentile(sorted, 75)),
      p90: Math.round(percentile(sorted, 90)),
    });
  }

  // Income bandwidth (VPW only): P10/P25/P50/P75/P90 of net real income per age.
  const incomeBands = [];
  if (incomeByYear) {
    for (let y = 0; y < n; y++) {
      const sorted = incomeByYear[y].slice().sort();
      incomeBands.push({
        year: y + 1,
        age: withdrawalStartAge.value + y,
        p10: Math.round(percentile(sorted, 10) / 12),
        p25: Math.round(percentile(sorted, 25) / 12),
        p50: Math.round(percentile(sorted, 50) / 12),
        p75: Math.round(percentile(sorted, 75) / 12),
        p90: Math.round(percentile(sorted, 90) / 12),
      });
    }
  }

  const reachSorted = reach.slice().sort();
  const medianReachYear = percentile(reachSorted, 50);
  const p10ReachYear = percentile(reachSorted, 10); // bad-case: the early-depleting tail
  const successRate = (successCount / PATHS) * 100;
  const medianEndBalance = fanBands.length ? fanBands[n - 1].p50 : 0;
  const medianEndBalanceReal = Math.round(medianEndBalance / realFactorOf(n));

  // VPW income-volatility figures (dynamic only): the typical worst 5-year real
  // income decline, and the P10 income at ~age 75 (or nearest age in range).
  let vpwWorst5DropPct = 0;
  let vpwIncomeP10Late = 0;
  let vpwLateAge = 0;
  if (isDynamic && incomeBands.length) {
    vpwWorst5DropPct = percentile(worstDrops.slice().sort(), 50) * 100;
    let band = incomeBands.find((b) => b.age === 75);
    if (!band) {
      band = incomeBands.reduce((a, b) => (Math.abs(b.age - 75) < Math.abs(a.age - 75) ? b : a));
    }
    vpwIncomeP10Late = band.p10;
    vpwLateAge = band.age;
  }

  // --- Representative (median-path) income breakdown drives the income bars ---
  const { rows: rawRows } = simulate(monthlyW1, ctx, null, { detailed: true });

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
      taxReal: Math.round(r.tax / realFactor),
      net: Math.round(r.net),
      withdrawalReal: Math.round(r.withdrawal / realFactor),
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
    isDynamic,
    decay,
    depot0,
    monthlyW1,
    successRate,
    medianReachYear,
    p10ReachYear,
    medianEndBalance,
    medianEndBalanceReal,
    fanBands,
    incomeBands,
    vpwStartRate: isDynamic ? vpwRate(g, n) : 0,
    vpwWorst5DropPct,
    vpwIncomeP10Late,
    vpwLateAge,
    bridge,
    pNet,
    pmToday,
    yearsUntilPension,
    infeasible,
  });

  return { rows, fanBands, incomeBands, summary };
}

function emptySummary() {
  return {
    monthlyGross: 0, monthlyNet: 0, monthlyNetEnd: 0,
    annualGross: 0, annualNet: 0, annualNetEnd: 0,
    annualTotalIncome: 0, annualTotalIncomeEnd: 0,
    monthlyTotalIncome: 0, monthlyTotalIncomeEnd: 0,
    monthlyRealStart: 0, monthlyRealEnd: 0,
    monthlyGrossReal: 0, monthlyTaxReal: 0, annualTotalIncomeReal: 0,
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
    isDynamic: withdrawalMode.value === 'dynamic',
    vpwStartRatePct: '0.0',
    dynIncomeMedianStart: 0, dynIncomeP10Start: 0, dynIncomeP90Start: 0, dynIncomeMedianEnd: 0,
    vpwWorst5DropPct: 0, vpwIncomeP10Late: 0, vpwLateAge: 0,
    endBalanceReal: finalBalance.value,
    bridgeActive: false,
    phases: [],
  };
}

function buildSummary(d) {
  const { rows, n, mode, isDynamic, depot0, monthlyW1, pNet, pmToday, yearsUntilPension } = d;
  const first = rows[0];
  const last = rows[rows.length - 1];
  const ib = d.incomeBands || [];
  const ib0 = ib[0] || { p10: 0, p50: 0, p90: 0 };
  const ibLast = ib[ib.length - 1] || ib0;
  const totalTax = rows.reduce((acc, r) => acc + r.tax, 0);
  const totalRealizedGain = rows.reduce((acc, r) => acc + r.realizedGain, 0);

  const lastsFullHorizon = d.medianReachYear > n;
  const medianReachAge = withdrawalStartAge.value + Math.round(Math.min(d.medianReachYear, n + 1)) - 1;
  const p10ReachAge = withdrawalStartAge.value + Math.round(Math.min(d.p10ReachYear, n + 1)) - 1;
  const depletedEarly = d.p10ReachYear < n; // a meaningful share of paths run dry early

  const firstPensionRow = rows.find((r) => r.pensionActive);
  const pensionStarts = pmToday > 0 ? yearsUntilPension + 1 : null;

  const withdrawalRatePct = depot0 > 0 ? ((monthlyW1 * 12) / depot0 * 100).toFixed(1) : '0.0';

  // --- Life-phase income breakdown (all monthly, net, today's purchasing power) ---
  // Each phase reports the TOTAL income (depot + pension); split shown beneath.
  const totalAtYear = (year) => {
    if (isDynamic && ib.length >= year && ib[year - 1]) return ib[year - 1].p50;
    const r = rows[year - 1];
    return r ? Math.round(r.totalNetReal / 12) : 0;
  };
  const pensionRealMonthly = firstPensionRow ? Math.round(firstPensionRow.pensionReal / 12) : 0;
  const startAge = withdrawalStartAge.value;
  const psaV = pensionStartAge.value;
  const endAge = startAge + n - 1;
  const phases = [];
  if (pmToday > 0 && yearsUntilPension > 0 && yearsUntilPension < n) {
    phases.push({ label: 'Vor Rente', age: `${startAge}–${psaV - 1}`, total: totalAtYear(1), pension: 0 });
    phases.push({ label: 'Ab Rentenbeginn', age: `ab ${psaV}`, total: totalAtYear(yearsUntilPension + 1), pension: pensionRealMonthly });
    phases.push({ label: 'Ende der Laufzeit', age: `mit ${endAge} · Median`, total: totalAtYear(n), pension: pensionRealMonthly });
  } else {
    const startPension = pmToday > 0 ? pensionRealMonthly : 0;
    phases.push({ label: 'Start', age: `mit ${startAge}`, total: totalAtYear(1), pension: startPension });
    phases.push({ label: 'Ende der Laufzeit', age: `mit ${endAge} · Median`, total: totalAtYear(n), pension: startPension });
  }
  phases.forEach((p) => { p.depot = Math.max(0, p.total - p.pension); });

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
    // For VPW the income varies by path → the hero shows the median (p50) income.
    monthlyRealStart: isDynamic ? ib0.p50 : Math.round(first.totalNetReal / 12),
    monthlyRealEnd: isDynamic ? ibLast.p50 : Math.round(last.totalNetReal / 12),
    // Real (today's purchasing power) versions, so the hero card is consistent.
    monthlyGrossReal: Math.round(first.withdrawalReal / 12),
    monthlyTaxReal: Math.round(first.taxReal / 12),
    annualTotalIncomeReal: first.totalNetReal,
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
    // --- dynamic (VPW) income bandwidth (real, net, per month) ---
    isDynamic: !!isDynamic,
    vpwStartRatePct: d.vpwStartRate ? (d.vpwStartRate * 100).toFixed(1) : '0.0',
    dynIncomeMedianStart: ib0.p50,
    dynIncomeP10Start: ib0.p10,
    dynIncomeP90Start: ib0.p90,
    dynIncomeMedianEnd: ibLast.p50,
    vpwWorst5DropPct: Math.round(d.vpwWorst5DropPct || 0),
    vpwIncomeP10Late: d.vpwIncomeP10Late || 0,
    vpwLateAge: d.vpwLateAge || 0,
    endBalanceReal: d.medianEndBalanceReal != null ? d.medianEndBalanceReal : d.medianEndBalance,
    bridgeActive: !!d.bridge,
    phases,
  };
}

// Side-by-side comparison of all three strategies (current mode reuses the full
// plan; the other two run a fresh summary on the same seeded scenario).
function buildComparison(currentPlan) {
  const cur = withdrawalMode.value;
  return ['nominal', 'real', 'dynamic'].map((m) => {
    const s = m === cur ? currentPlan.summary : computeWithdrawalPlan(m).summary;
    return {
      mode: m,
      startReal: s.monthlyRealStart,
      endReal: s.monthlyRealEnd,
      endCapitalReal: s.endBalanceReal,
      successRate: s.successRate,
      isDynamic: s.isDynamic,
      infeasible: s.infeasible,
    };
  });
}

function computePlanWithComparison() {
  const plan = computeWithdrawalPlan();
  plan.comparison = buildComparison(plan);
  return plan;
}

// The MC solve is the heaviest work in the app; inside a plain computed it would
// re-run on every slider tick and jank the UI (worst on mobile, where the controls
// live in the drawer). Instead we hold the result in a ref and recompute on a short
// debounce — the first change (store hydration from URL/localStorage) runs eagerly
// to avoid a flash of the default plan, later edits are debounced.
const planRef = shallowRef(computePlanWithComparison());
let recomputeTimer = null;
let primed = false;
watch(
  [
    finalBalance, totalInvested, allowCapitalDecay, withdrawalPlanYears, withdrawalReturnRate,
    withdrawalMode, pensionMonthly, pensionStartAge, withdrawalStartAge, pensionHasChildren,
    bridgeIncome, withdrawalVolatility, targetSuccessRate, etfCostRate, vpwReturn,
    durationYears, inflationRate,
  ],
  () => {
    if (!primed) {
      primed = true;
      planRef.value = computePlanWithComparison();
      return;
    }
    clearTimeout(recomputeTimer);
    recomputeTimer = setTimeout(() => {
      planRef.value = computePlanWithComparison();
    }, 160);
  },
);

export const calculateWithdrawalData = computed(() => planRef.value.rows);
export const withdrawalTaxInfo = computed(() => planRef.value.summary);
export const withdrawalFanBands = computed(() => planRef.value.fanBands);
export const withdrawalIncomeBands = computed(() => planRef.value.incomeBands || []);
export const withdrawalModeComparison = computed(() => planRef.value.comparison || []);

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
