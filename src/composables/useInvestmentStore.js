import { ref, watch } from 'vue';

const STORAGE_KEY = 'investment_sim_v1';

// URL-safe base64 helpers (handles Unicode via TextEncoder)
function toBase64(str) {
  return btoa(new TextEncoder().encode(str).reduce((s, b) => s + String.fromCharCode(b), ''))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}
function fromBase64(b64) {
  const bytes = atob(b64.replace(/-/g, '+').replace(/_/g, '/')).split('').map(c => c.charCodeAt(0));
  return new TextDecoder().decode(new Uint8Array(bytes));
}

// --- Growth phase state ---
export const initialCapital = ref(30000);
export const durationYears = ref(15);
export const reinvestGains = ref(true);
export const inflationRate = ref(2.5);
export const yieldPhases = ref([
  { id: 1, startYear: 1, endYear: 15, rate: 6, customDuration: false },
]);
export const transactions = ref([
  { id: 1, name: 'Sparplan', amount: 500, type: 'monthly', startYear: 1, endYear: 15, customDuration: false },
]);

// --- Withdrawal phase state ---
export const withdrawalRate = ref(4);
export const withdrawalPlanYears = ref(30);
export const allowCapitalDecay = ref(true);
export const withdrawalReturnRate = ref(6);
// Withdrawal payout shape: 'nominal' (fixed €) | 'real' (kaufkraftbereinigt, wächst mit Inflation)
export const withdrawalMode = ref('nominal');

// --- Pension (Gesetzliche Rente) ---
// pensionMonthly is given in today's purchasing power (€/Monat).
export const pensionMonthly = ref(0);
export const pensionStartAge = ref(67);
export const withdrawalStartAge = ref(60);

// --- URL state sharing ---
export function encodeState() {
  const data = {
    ic: initialCapital.value,
    dy: durationYears.value,
    rg: reinvestGains.value ? 1 : 0,
    ir: inflationRate.value,
    wr: withdrawalRate.value,
    wpy: withdrawalPlanYears.value,
    acd: allowCapitalDecay.value ? 1 : 0,
    wrr: withdrawalReturnRate.value,
    wm: withdrawalMode.value,
    pm: pensionMonthly.value,
    psa: pensionStartAge.value,
    wsa: withdrawalStartAge.value,
    yp: yieldPhases.value.map(p => ({ s: p.startYear, e: p.endYear, r: p.rate, cd: p.customDuration ? 1 : 0 })),
    tr: transactions.value.map(tx => ({ n: tx.name, a: tx.amount, tp: tx.type === 'monthly' ? 'm' : 'o', s: tx.startYear, e: tx.endYear, cd: tx.customDuration ? 1 : 0 })),
  };
  return toBase64(JSON.stringify(data));
}

function applyState(data) {
  if (data.ic !== undefined) initialCapital.value = data.ic;
  if (data.dy !== undefined) durationYears.value = data.dy;
  if (data.rg !== undefined) reinvestGains.value = !!data.rg;
  if (data.ir !== undefined) inflationRate.value = data.ir;
  if (data.wr !== undefined) withdrawalRate.value = Math.min(10, Math.max(1, Number(data.wr)));
  if (data.wpy !== undefined) withdrawalPlanYears.value = Math.min(80, Math.max(1, Number(data.wpy)));
  if (data.acd !== undefined) allowCapitalDecay.value = !!data.acd;
  if (data.wrr !== undefined) withdrawalReturnRate.value = Math.min(20, Math.max(0, Number(data.wrr)));
  if (data.wm === 'real' || data.wm === 'nominal') withdrawalMode.value = data.wm;
  if (data.pm !== undefined) pensionMonthly.value = Math.max(0, Number(data.pm) || 0);
  if (data.psa !== undefined) pensionStartAge.value = Math.min(80, Math.max(50, Number(data.psa) || 67));
  if (data.wsa !== undefined) withdrawalStartAge.value = Math.min(90, Math.max(30, Number(data.wsa) || 60));
  if (data.yp) {
    yieldPhases.value = data.yp.map((p, i) => ({
      id: i + 1, startYear: p.s, endYear: p.e, rate: p.r, customDuration: !!p.cd,
    }));
  }
  if (data.tr) {
    transactions.value = data.tr.map((t, i) => ({
      id: i + 1, name: t.n, amount: t.a, type: t.tp === 'm' ? 'monthly' : 'onetime',
      startYear: t.s, endYear: t.e, customDuration: !!t.cd,
    }));
  }
}

function loadFromUrl() {
  const qi = window.location.hash.indexOf('?');
  if (qi === -1) return false;
  const encoded = new URLSearchParams(window.location.hash.slice(qi)).get('s');
  if (!encoded) return false;
  try {
    const data = JSON.parse(fromBase64(encoded));
    applyState(data);
    history.replaceState(null, '', window.location.pathname + window.location.hash.slice(0, qi));
    // Update tab title so the plan is identifiable in browser history
    if (data.ic !== undefined && data.dy !== undefined) {
      document.title = `ETF-Rechner – ${(data.ic / 1000).toFixed(0)}k Startkapital, ${data.dy} Jahre`;
    }
    return true;
  } catch {
    return false;
  }
}

// --- Persistence ---
function saveToLocal() {
  const data = {
    initialCapital: initialCapital.value,
    durationYears: durationYears.value,
    reinvestGains: reinvestGains.value,
    withdrawalRate: withdrawalRate.value,
    inflationRate: inflationRate.value,
    yieldPhases: yieldPhases.value,
    transactions: transactions.value,
    withdrawalPlanYears: withdrawalPlanYears.value,
    allowCapitalDecay: allowCapitalDecay.value,
    withdrawalReturnRate: withdrawalReturnRate.value,
    withdrawalMode: withdrawalMode.value,
    pensionMonthly: pensionMonthly.value,
    pensionStartAge: pensionStartAge.value,
    withdrawalStartAge: withdrawalStartAge.value,
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

export function loadFromLocal() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (!saved) return;
  try {
    const parsed = JSON.parse(saved);
    initialCapital.value = parsed.initialCapital;
    durationYears.value = parsed.durationYears;
    if (parsed.reinvestGains !== undefined) reinvestGains.value = parsed.reinvestGains;
    if (parsed.withdrawalRate !== undefined) {
      const rate = Number(parsed.withdrawalRate);
      withdrawalRate.value = Number.isFinite(rate) ? Math.min(10, Math.max(1, rate)) : 4;
    }
    if (parsed.inflationRate !== undefined) {
      const rate = Number(parsed.inflationRate);
      inflationRate.value = Number.isFinite(rate) ? Math.min(20, Math.max(0, rate)) : 2.5;
    }
    if (parsed.withdrawalPlanYears !== undefined) {
      const years = Number(parsed.withdrawalPlanYears);
      withdrawalPlanYears.value = Number.isFinite(years) ? Math.min(80, Math.max(1, years)) : 30;
    }
    if (parsed.allowCapitalDecay !== undefined) allowCapitalDecay.value = !!parsed.allowCapitalDecay;
    if (parsed.withdrawalReturnRate !== undefined) {
      const rate = Number(parsed.withdrawalReturnRate);
      withdrawalReturnRate.value = Number.isFinite(rate) ? Math.min(20, Math.max(0, rate)) : 6;
    }
    if (parsed.withdrawalMode === 'real' || parsed.withdrawalMode === 'nominal') {
      withdrawalMode.value = parsed.withdrawalMode;
    }
    if (parsed.pensionMonthly !== undefined) {
      const v = Number(parsed.pensionMonthly);
      pensionMonthly.value = Number.isFinite(v) ? Math.max(0, v) : 0;
    }
    if (parsed.pensionStartAge !== undefined) {
      const v = Number(parsed.pensionStartAge);
      pensionStartAge.value = Number.isFinite(v) ? Math.min(80, Math.max(50, v)) : 67;
    }
    if (parsed.withdrawalStartAge !== undefined) {
      const v = Number(parsed.withdrawalStartAge);
      withdrawalStartAge.value = Number.isFinite(v) ? Math.min(90, Math.max(30, v)) : 60;
    }
    yieldPhases.value = parsed.yieldPhases.map((p) => {
      if (p.customDuration === undefined) p.customDuration = false;
      return p;
    });
    transactions.value = parsed.transactions.map((t) => {
      if (t.duration !== undefined && t.endYear === undefined) {
        return { ...t, endYear: t.startYear + t.duration - 1, duration: undefined, customDuration: true };
      }
      if (t.customDuration === undefined) t.customDuration = false;
      return t;
    });
  } catch {
    /* ignore corrupt local storage */
  }
}

// --- Mutators ---
export const addPhase = () =>
  yieldPhases.value.push({ id: Date.now(), startYear: 1, endYear: durationYears.value, rate: 5, customDuration: false });
export const removePhase = (id) => (yieldPhases.value = yieldPhases.value.filter((p) => p.id !== id));

export const addTransaction = () =>
  transactions.value.push({ id: Date.now(), name: 'Zusätzliche Einzahlung', amount: 500, type: 'monthly', startYear: 1, endYear: durationYears.value, customDuration: false });
export const removeTransaction = (id) => (transactions.value = transactions.value.filter((t) => t.id !== id));

export const toggleCustomDuration = (item) => {
  item.customDuration = !item.customDuration;
  if (!item.customDuration) {
    item.startYear = 1;
    item.endYear = durationYears.value;
  }
};

// --- Setup wiring (call once from main.js / App.vue) ---
let initialized = false;
export function initInvestmentStore() {
  if (initialized) return;
  initialized = true;
  if (!loadFromUrl()) loadFromLocal();

  watch(
    [
      initialCapital,
      durationYears,
      reinvestGains,
      withdrawalRate,
      inflationRate,
      yieldPhases,
      transactions,
      withdrawalPlanYears,
      allowCapitalDecay,
      withdrawalReturnRate,
      withdrawalMode,
      pensionMonthly,
      pensionStartAge,
      withdrawalStartAge,
    ],
    () => saveToLocal(),
    { deep: true },
  );

  // Auto-extend yield phases & transactions when total duration increases
  watch(durationYears, (newVal, oldVal) => {
    if (newVal > oldVal) {
      yieldPhases.value.forEach((p) => {
        if (!p.customDuration) {
          p.startYear = 1;
          p.endYear = newVal;
        } else if (p.endYear === oldVal) {
          p.endYear = newVal;
        }
      });
      transactions.value.forEach((t) => {
        if (t.type === 'monthly' && !t.customDuration) t.endYear = newVal;
        else if (t.type === 'monthly' && t.endYear === oldVal) t.endYear = newVal;
      });
    }
  });
}
