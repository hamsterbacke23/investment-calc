import { ref, watch } from 'vue';

const STORAGE_KEY = 'investment_sim_v1';

// --- Growth phase state ---
export const initialCapital = ref(30000);
export const durationYears = ref(15);
export const reinvestGains = ref(true);
export const inflationRate = ref(2.5);
export const yieldPhases = ref([
  { id: 1, startYear: 1, endYear: 15, rate: 6, customDuration: false },
]);
export const transactions = ref([
  { id: 1, name: 'Savings Plan', amount: 500, type: 'monthly', startYear: 1, endYear: 15, customDuration: false },
]);

// --- Withdrawal phase state ---
export const withdrawalRate = ref(4);
export const withdrawalPlanYears = ref(30);
export const allowCapitalDecay = ref(true);
export const withdrawalReturnRate = ref(6);

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
  transactions.value.push({ id: Date.now(), name: 'Extra Deposit', amount: 500, type: 'monthly', startYear: 1, endYear: durationYears.value, customDuration: false });
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
  loadFromLocal();

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
