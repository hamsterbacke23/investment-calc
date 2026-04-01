<script setup>
import { ref, computed, watch, onMounted } from 'vue';
import { Plus, Trash2, Download, Save, TrendingDown, TrendingUp, Calendar } from 'lucide-vue-next';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

// --- State ---
const initialCapital = ref(30000);
const durationYears = ref(15);
const reinvestGains = ref(true);
const withdrawalRate = ref(4);
const isEditingWithdrawalRate = ref(false);
const yieldPhases = ref([{ id: 1, startYear: 1, endYear: 15, rate: 6, customDuration: false }]);
const transactions = ref([{ id: 1, name: 'Savings Plan', amount: 500, type: 'monthly', startYear: 1, endYear: 15, customDuration: false }]);

const clampWithdrawalRate = () => {
  const rate = Number(withdrawalRate.value);
  if (!Number.isFinite(rate)) {
    withdrawalRate.value = 4;
    return;
  }
  withdrawalRate.value = Math.min(10, Math.max(1, Number(rate.toFixed(1))));
};

const closeWithdrawalRateEditor = () => {
  clampWithdrawalRate();
  isEditingWithdrawalRate.value = false;
};

// --- Persistence ---
const saveToLocal = () => {
  const data = { initialCapital: initialCapital.value, durationYears: durationYears.value, reinvestGains: reinvestGains.value, withdrawalRate: withdrawalRate.value, yieldPhases: yieldPhases.value, transactions: transactions.value };
  localStorage.setItem('investment_sim_v1', JSON.stringify(data));
};

const loadFromLocal = () => {
  const saved = localStorage.getItem('investment_sim_v1');
  if (saved) {
    const parsed = JSON.parse(saved);
    initialCapital.value = parsed.initialCapital;
    durationYears.value = parsed.durationYears;
    if (parsed.reinvestGains !== undefined) reinvestGains.value = parsed.reinvestGains;
    if (parsed.withdrawalRate !== undefined) {
      const rate = Number(parsed.withdrawalRate);
      withdrawalRate.value = Number.isFinite(rate) ? Math.min(10, Math.max(1, rate)) : 4;
    }
    yieldPhases.value = parsed.yieldPhases.map(p => {
      if (p.customDuration === undefined) p.customDuration = false;
      return p;
    });
    // Migrate old formats
    transactions.value = parsed.transactions.map(t => {
      if (t.duration !== undefined && t.endYear === undefined) {
        return { ...t, endYear: t.startYear + t.duration - 1, duration: undefined, customDuration: true };
      }
      if (t.customDuration === undefined) t.customDuration = false;
      return t;
    });
  }
};

watch([initialCapital, durationYears, reinvestGains, withdrawalRate, yieldPhases, transactions], () => saveToLocal(), { deep: true });

// Auto-extend yield phases & transactions when total duration increases
watch(durationYears, (newVal, oldVal) => {
  if (newVal > oldVal) {
    yieldPhases.value.forEach(p => {
      if (!p.customDuration) { p.startYear = 1; p.endYear = newVal; }
      else if (p.endYear === oldVal) p.endYear = newVal;
    });
    transactions.value.forEach(t => {
      if (t.type === 'monthly' && !t.customDuration) t.endYear = newVal;
      else if (t.type === 'monthly' && t.endYear === oldVal) t.endYear = newVal;
    });
  }
});

onMounted(() => loadFromLocal());

// --- Calculation Logic ---
const calculateData = computed(() => {
  let results = [];
  let currentBalance = initialCapital.value;
  let totalGains = 0;

  for (let year = 1; year <= durationYears.value; year++) {
    // Use last matching phase so later-added phases override earlier ones
    const matchingPhases = yieldPhases.value.filter(p => year >= p.startYear && year <= p.endYear);
    const phase = matchingPhases.length > 0 ? matchingPhases[matchingPhases.length - 1] : { rate: 0 };
    const annualRate = phase.rate / 100;
    const monthlyRate = Math.pow(1 + annualRate, 1/12) - 1;

    let yearDeposits = 0;
    let yearReturns = 0;

    for (let month = 1; month <= 12; month++) {
      transactions.value.forEach(t => {
        const effectiveEnd = (!t.customDuration && t.type === 'monthly') ? durationYears.value : t.endYear;
        const isActive = year >= t.startYear && year <= (t.type === 'monthly' ? effectiveEnd : t.startYear);
        if (isActive) {
          if (t.type === 'monthly') { currentBalance += t.amount; yearDeposits += t.amount; }
          else if (t.type === 'once' && month === 1) { currentBalance += t.amount; yearDeposits += t.amount; }
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
      returns: Math.round(yearReturns)
    });
  }
  return results;
});

const maxBalance = computed(() => Math.max(...calculateData.value.map(x => x.balance)));
const activeTooltipYear = ref(null);
const activeTooltipData = computed(() => {
  if (activeTooltipYear.value === null) return null;
  return calculateData.value.find(d => d.year === activeTooltipYear.value) || null;
});

const toggleBarTooltip = (year) => {
  activeTooltipYear.value = activeTooltipYear.value === year ? null : year;
};

const barStyle = (d, i) => {
  const max = maxBalance.value;
  const heightPct = (d.balance / max * 100);
  // 3 segments: base (previous balance), deposits, returns
  const depositRatio = d.balance > 0 ? Math.abs(d.deposits) / d.balance : 0;
  const returnRatio = d.balance > 0 ? Math.abs(d.returns) / d.balance : 0;

  const depositPct = depositRatio * 100;
  const returnPct = returnRatio * 100;
  const basePct = 100 - depositPct - returnPct;

  const baseColor = '#2a3040';      // muted slate - carried over
  const depositColor = '#3b7d8a';    // teal - deposits
  const returnColor = d.returns >= 0 ? '#d4a853' : '#f06449'; // gold / coral - returns

  return {
    height: heightPct + '%',
    background: `linear-gradient(to top, ${baseColor} ${basePct}%, ${depositColor} ${basePct}% ${basePct + depositPct}%, ${returnColor} ${basePct + depositPct}%)`
  };
};

// --- ETF Benchmark Data (annual returns in EUR, incl. dividends, %) ---
const etfData = [
  {
    name: 'iShares S&P 500',
    ticker: 'IUSA',
    isin: 'IE0031442068',
    ter: 0.07,
    inception: 2002,
    returns: {
      2003: 5.1, 2004: 3.6, 2005: 25.2, 2006: 3.3, 2007: -5.7, 2008: -38.4,
      2009: 23.4, 2010: 22.3, 2011: 4.2, 2012: 14.3, 2013: 27.4, 2014: 28.7,
      2015: 12.2, 2016: 14.4, 2017: 6.4, 2018: 0.0, 2019: 33.8, 2020: 8.5,
      2021: 37.9, 2022: -13.3, 2023: 21.6, 2024: 32.6, 2025: 4.0
    }
  },
  {
    name: 'iShares MSCI World',
    ticker: 'IQQW',
    isin: 'IE00B0M62Q58',
    ter: 0.50,
    inception: 2005,
    returns: {
      2006: 7.4, 2007: -1.7, 2008: -37.6, 2009: 26.0, 2010: 19.5,
      2011: -2.4, 2012: 14.0, 2013: 21.2, 2014: 19.5, 2015: 10.4,
      2016: 10.7, 2017: 7.5, 2018: -4.1, 2019: 30.0, 2020: 6.3,
      2021: 31.1, 2022: -13.2, 2023: 19.2, 2024: 25.9, 2025: 6.8
    }
  },
  {
    name: 'SPDR MSCI ACWI IMI',
    ticker: 'SPYI',
    isin: 'IE00B3YLTY66',
    ter: 0.17,
    inception: 2011,
    returns: {
      2012: 14.1, 2013: 17.5, 2014: 18.6, 2015: 8.8, 2016: 11.4,
      2017: 8.9, 2018: -4.9, 2019: 28.9, 2020: 6.7, 2021: 28.8,
      2022: -12.4, 2023: 16.9, 2024: 23.5, 2025: 8.1
    }
  }
];

// --- German Tax Calculation (equity ETFs) ---
const totalInvested = computed(() => {
  return initialCapital.value + transactions.value.reduce((acc, t) => {
    const effectiveEnd = (!t.customDuration && t.type === 'monthly') ? durationYears.value : t.endYear;
    return acc + (t.amount * (t.type === 'monthly' ? (effectiveEnd - t.startYear + 1) * 12 : 1));
  }, 0);
});

const taxInfo = computed(() => {
  const finalBalance = calculateData.value[calculateData.value.length - 1].balance;
  const gains = Math.max(0, finalBalance - totalInvested.value);
  const teilfreistellung = 0.30; // 30% tax-free for equity ETFs
  const taxableGains = gains * (1 - teilfreistellung);
  const freibetrag = 1000; // Sparerpauschbetrag (single)
  const taxableAfterFreibetrag = Math.max(0, taxableGains - freibetrag);
  const taxRate = 0.26375; // 25% Abgeltungssteuer + 5.5% Soli
  const tax = Math.round(taxableAfterFreibetrag * taxRate);
  const afterTax = finalBalance - tax;
  const inflationFactor = Math.pow(1.02, durationYears.value);
  const inTodaysMoney = Math.round((tax > 0 ? afterTax : finalBalance) / inflationFactor);
  const safeRate = Number.isFinite(Number(withdrawalRate.value)) ? Math.min(10, Math.max(1, Number(withdrawalRate.value))) : 4;
  const withdrawalRateDecimal = safeRate / 100;
  const withdrawalAnnualNominal = Math.round(finalBalance * withdrawalRateDecimal);
  const withdrawalMonthlyNominal = Math.round(withdrawalAnnualNominal / 12);
  const withdrawalAnnualAfterTax = Math.round(afterTax * withdrawalRateDecimal);
  const withdrawalMonthlyAfterTax = Math.round(withdrawalAnnualAfterTax / 12);
  const withdrawalAnnualReal = Math.round(inTodaysMoney * withdrawalRateDecimal);
  const withdrawalMonthlyReal = Math.round(withdrawalAnnualReal / 12);
  return {
    gains,
    tax,
    afterTax,
    inTodaysMoney,
    withdrawalAnnualNominal,
    withdrawalMonthlyNominal,
    withdrawalAnnualAfterTax,
    withdrawalMonthlyAfterTax,
    withdrawalAnnualReal,
    withdrawalMonthlyReal,
    effectiveRate: gains > 0 ? (tax / gains * 100).toFixed(1) : '0.0'
  };
});

const etfBenchmarks = computed(() => {
  const endYear = 2025;
  const startYear = endYear - durationYears.value + 1;
  return etfData.map(etf => {
    const years = [];
    let cumulative = 1;
    for (let y = startYear; y <= endYear; y++) {
      if (etf.returns[y] !== undefined) {
        cumulative *= (1 + etf.returns[y] / 100);
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
      toYear: years.length > 0 ? years[years.length - 1] : null
    };
  });
});

// --- Actions ---
const toggleCustomDuration = (item) => {
  item.customDuration = !item.customDuration;
  if (!item.customDuration) {
    item.startYear = 1;
    item.endYear = durationYears.value;
  }
};

const addTransaction = () => transactions.value.push({ id: Date.now(), name: 'Extra Deposit', amount: 500, type: 'monthly', startYear: 1, endYear: durationYears.value, customDuration: false });
const removeTransaction = (id) => transactions.value = transactions.value.filter(t => t.id !== id);
const addPhase = () => yieldPhases.value.push({ id: Date.now(), startYear: 1, endYear: durationYears.value, rate: 5, customDuration: false });
const removePhase = (id) => yieldPhases.value = yieldPhases.value.filter(p => p.id !== id);

const exportPDF = () => {
  const doc = new jsPDF();
  doc.text('Investment Simulation - Report', 14, 20);
  const tableData = calculateData.value.map(d => [d.year, `${d.rate}%`, `${d.balance.toLocaleString()} €`]);
  autoTable(doc, { head: [['Year', 'Return', 'Balance']], body: tableData, startY: 30 });
  doc.save('investment-plan.pdf');
};
</script>

<template>
  <div class="app-container" @click="activeTooltipYear = null; closeWithdrawalRateEditor()">
    <header class="main-header">
      <div>
        <h1>ETF Investment Calculator</h1>
        <p>Plan your long-term wealth growth</p>
      </div>
      <button @click="exportPDF" class="btn-primary"><Download size="18" /> PDF Export</button>
    </header>

    <main class="grid-layout">
      <aside class="sidebar">
        <section class="card">
          <h3>Initial Capital</h3>
          <div class="input-group">
            <input type="number" v-model.number="initialCapital" step="5000" />
            <input type="range" v-model.number="initialCapital" min="0" max="1000000" step="5000" />
          </div>
          <label>Duration: {{ durationYears }} years</label>
          <input type="range" v-model.number="durationYears" min="1" max="50" />
          <div class="toggle-row">
            <label class="toggle-label">
              <input type="checkbox" v-model="reinvestGains" />
              <span>Reinvest all gains</span>
            </label>
          </div>
        </section>

        <section class="card">
          <div class="card-header">
            <h3>Return</h3>
            <button @click="addPhase" class="btn-icon"><Plus size="16"/></button>
          </div>
          <div v-for="p in yieldPhases" :key="p.id" class="item-box">
            <div class="flex-row">
              <div class="yield-display" :class="{ 'negative': p.rate < 0 }">
                <TrendingUp v-if="p.rate >= 0" size="14" />
                <TrendingDown v-else size="14" />
                {{ p.rate }}%
              </div>
              <button @click="removePhase(p.id)" class="btn-delete"><Trash2 size="14"/></button>
            </div>
            <input type="range" v-model.number="p.rate" min="-50" max="30" />
            <div v-if="!p.customDuration" class="duration-toggle">
              <button @click="toggleCustomDuration(p)" class="btn-link"><Calendar size="12" /> Set custom period</button>
            </div>
            <div v-if="p.customDuration" class="year-range-row">
              <div class="small-label-input">
                <label>From year</label>
                <input type="number" v-model.number="p.startYear" min="1" :max="p.endYear" class="year-input" />
              </div>
              <div class="small-label-input">
                <label>To year</label>
                <input type="number" v-model.number="p.endYear" :min="p.startYear" :max="durationYears" class="year-input" />
              </div>
              <button @click="toggleCustomDuration(p)" class="btn-link btn-link-reset" title="Reset to always">✕</button>
            </div>
          </div>
        </section>

        <section class="card">
          <div class="card-header">
            <h3>Deposits</h3>
            <button @click="addTransaction" class="btn-icon"><Plus size="16"/></button>
          </div>
          <div v-for="t in transactions" :key="t.id" class="item-box">
            <div class="flex-row">
              <span class="item-label">{{ t.amount.toLocaleString() }} € / {{ t.type === 'monthly' ? 'mo' : 'once' }}</span>
              <button @click="removeTransaction(t.id)" class="btn-delete"><Trash2 size="14"/></button>
            </div>
            <div class="grid-2">
              <input type="number" v-model.number="t.amount" step="50" />
              <select v-model="t.type">
                <option value="monthly">monthly</option>
                <option value="once">one-time</option>
              </select>
            </div>
            <input v-if="t.type === 'monthly'" type="range" v-model.number="t.amount" max="10000" step="50" />
            <div v-if="t.type === 'monthly' && !t.customDuration" class="duration-toggle">
              <button @click="toggleCustomDuration(t)" class="btn-link"><Calendar size="12" /> Set custom period</button>
            </div>
            <div v-if="t.type === 'monthly' && t.customDuration" class="year-range-row">
              <div class="small-label-input">
                <label>From year</label>
                <input type="number" v-model.number="t.startYear" min="1" :max="t.endYear" class="year-input" />
              </div>
              <div class="small-label-input">
                <label>To year</label>
                <input type="number" v-model.number="t.endYear" :min="t.startYear" :max="durationYears" class="year-input" />
              </div>
              <button @click="toggleCustomDuration(t)" class="btn-link btn-link-reset" title="Reset to always">✕</button>
            </div>
            <div v-if="t.type === 'once'" class="year-range-row">
              <div class="small-label-input">
                <label>In year</label>
                <input type="number" v-model.number="t.startYear" min="1" :max="durationYears" class="year-input" />
              </div>
            </div>
          </div>
        </section>
      </aside>

      <div class="dashboard">
        <div class="chart-container">
          <div class="bars">
            <div v-for="(d, i) in calculateData" :key="d.year" 
                 class="bar" 
                 :class="{ active: activeTooltipYear === d.year }"
                 :style="barStyle(d, i)"
                 @click.stop="toggleBarTooltip(d.year)"
                 @keydown.enter.stop.prevent="toggleBarTooltip(d.year)"
                 @keydown.space.stop.prevent="toggleBarTooltip(d.year)"
                 tabindex="0"
                 role="button"
                 :aria-label="`Show details for year ${d.year}`">
              <span class="tooltip">
                <strong>Year {{d.year}} ({{ new Date().getFullYear() + d.year }})</strong><br>
                {{d.balance.toLocaleString()}} €
                <br>
                <span class="gain-deposit">{{ d.deposits >= 0 ? '+' : '' }}{{ d.deposits.toLocaleString() }} € deposits</span>
                <br>
                <span :class="d.returns >= 0 ? 'gain-pos' : 'gain-neg'">
                  {{ d.returns >= 0 ? '+' : '' }}{{ d.returns.toLocaleString() }} € returns
                </span>
                <br>
                <span class="gain-total">
                  = {{ d.deposits + d.returns >= 0 ? '+' : '' }}{{ (d.deposits + d.returns).toLocaleString() }} € total
                </span>
              </span>
            </div>
          </div>
          <div v-if="activeTooltipData" class="mobile-tooltip" aria-live="polite">
            <strong>Year {{activeTooltipData.year}} ({{ new Date().getFullYear() + activeTooltipData.year }})</strong><br>
            {{activeTooltipData.balance.toLocaleString()}} €
            <br>
            <span class="gain-deposit">{{ activeTooltipData.deposits >= 0 ? '+' : '' }}{{ activeTooltipData.deposits.toLocaleString() }} € deposits</span>
            <br>
            <span :class="activeTooltipData.returns >= 0 ? 'gain-pos' : 'gain-neg'">
              {{ activeTooltipData.returns >= 0 ? '+' : '' }}{{ activeTooltipData.returns.toLocaleString() }} € returns
            </span>
            <br>
            <span class="gain-total">
              = {{ activeTooltipData.deposits + activeTooltipData.returns >= 0 ? '+' : '' }}{{ (activeTooltipData.deposits + activeTooltipData.returns).toLocaleString() }} € total
            </span>
          </div>
        </div>

        <div class="stats-grid">
          <div class="stat-card">
            <label>Total Invested</label>
            <h2>{{ totalInvested.toLocaleString() }} €</h2>
          </div>
          <div class="stat-card highlighted">
            <label>Final Balance</label>
            <h2>{{ calculateData[calculateData.length-1].balance.toLocaleString() }} €</h2>
            <span class="tax-note" v-if="taxInfo.tax > 0">After tax (DE): {{ taxInfo.afterTax.toLocaleString() }} € <small>(−{{ taxInfo.tax.toLocaleString() }} € · {{ taxInfo.effectiveRate }}% eff.)</small></span>
            <span class="inflation-note">≈ {{ taxInfo.inTodaysMoney.toLocaleString() }} € in today's money <small>(2% inflation)</small></span>
          </div>
          <div class="stat-card monthly-card">
            <label class="monthly-label">
              Final Monthly Income
              <button v-if="!isEditingWithdrawalRate" class="inline-rate-btn" @click.stop="isEditingWithdrawalRate = true">{{ withdrawalRate.toFixed(1) }}%</button>
              <input
                v-else
                ref="withdrawalRateInput"
                type="number"
                class="inline-rate-input"
                v-model.number="withdrawalRate"
                min="1"
                max="10"
                step="0.1"
                @click.stop
                @blur="closeWithdrawalRateEditor"
                @keydown.enter.prevent="closeWithdrawalRateEditor"
              />
            </label>
            <h2>{{ taxInfo.withdrawalMonthlyNominal.toLocaleString() }} €</h2>
            <span class="tax-note">Nominal before tax <small>({{ taxInfo.withdrawalAnnualNominal.toLocaleString() }} € / year)</small></span>
            <span class="tax-note">After tax (DE) <small>({{ taxInfo.withdrawalMonthlyAfterTax.toLocaleString() }} € / month · {{ taxInfo.withdrawalAnnualAfterTax.toLocaleString() }} € / year)</small></span>
            <span class="inflation-note">≈ {{ taxInfo.withdrawalMonthlyReal.toLocaleString() }} € in today's money <small>({{ taxInfo.withdrawalAnnualReal.toLocaleString() }} € / year)</small></span>
          </div>
        </div>
      </div>
    </main>

    <footer class="benchmark-section">
      <h4>ETF Benchmark Reference <span class="benchmark-sub">— Historical annualized returns (EUR), last {{ durationYears }} years</span></h4>
      <div class="benchmark-grid">
        <div v-for="etf in etfBenchmarks" :key="etf.isin" class="benchmark-card">
          <div class="benchmark-name">{{ etf.name }} <span class="benchmark-ticker">{{ etf.ticker }}</span></div>
          <div class="benchmark-return" v-if="etf.cagr !== null">
            <span :class="parseFloat(etf.cagr) >= 0 ? 'bm-pos' : 'bm-neg'">{{ parseFloat(etf.cagr) >= 0 ? '+' : '' }}{{ etf.cagr }}%&thinsp;p.a.</span>
            <span class="benchmark-total">({{ parseFloat(etf.totalReturn) >= 0 ? '+' : '' }}{{ etf.totalReturn }}% total)</span>
          </div>
          <div class="benchmark-meta" v-if="etf.cagr !== null">
            {{ etf.fromYear }}–{{ etf.toYear }}
            <span v-if="etf.yearsAvailable < etf.yearsRequested" class="benchmark-warn">(only {{ etf.yearsAvailable }}y of data)</span>
            · TER {{ etf.ter }}%
          </div>
          <div v-else class="benchmark-na">No data for this period</div>
        </div>
      </div>
      <p class="benchmark-disclaimer">Past performance is not indicative of future results. Returns include dividends, denominated in EUR. Source: justETF, Feb 2026.</p>
    </footer>
  </div>
</template>

<style scoped>
/* ============================================
   ETF Investment Calculator — Dark Editorial
   ============================================ */

/* --- Keyframes --- */
@keyframes fadeInUp {
  from { opacity: 0; transform: translateY(12px); }
  to { opacity: 1; transform: translateY(0); }
}

@keyframes barGrow {
  from { transform: scaleY(0); }
  to { transform: scaleY(1); }
}

@keyframes shimmer {
  0% { background-position: -200% 0; }
  100% { background-position: 200% 0; }
}

/* --- Layout --- */
.app-container {
  max-width: 1400px;
  margin: 0 auto;
  padding: 2.5rem 2rem;
  font-family: 'DM Sans', system-ui, sans-serif;
  background: hsl(var(--background));
  color: hsl(var(--foreground));
  min-height: 100vh;
  position: relative;
}

/* Subtle noise texture overlay */
.app-container::before {
  content: '';
  position: fixed;
  inset: 0;
  background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='0.03'/%3E%3C/svg%3E");
  pointer-events: none;
  z-index: 0;
}

.app-container > * {
  position: relative;
  z-index: 1;
}

/* --- Header --- */
.main-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  margin-bottom: 2.5rem;
  padding-bottom: 1.5rem;
  border-bottom: 1px solid hsl(var(--border));
  animation: fadeInUp 0.5s ease both;
}

.main-header h1 {
  font-family: 'Cormorant Garamond', Georgia, serif;
  font-size: 2rem;
  font-weight: 600;
  letter-spacing: -0.02em;
  margin: 0;
  color: hsl(var(--foreground));
  line-height: 1.2;
}

.main-header p {
  margin: 0.25rem 0 0;
  font-size: 0.85rem;
  color: hsl(var(--muted-foreground));
  letter-spacing: 0.04em;
  text-transform: uppercase;
  font-weight: 300;
}

/* --- Grid --- */
.grid-layout {
  display: grid;
  grid-template-columns: 340px minmax(0, 1fr);
  gap: 2rem;
  align-items: start;
}

.sidebar {
  width: 340px;
  min-width: 340px;
  animation: fadeInUp 0.5s ease 0.1s both;
}

.dashboard {
  position: sticky;
  top: 1rem;
  align-self: start;
  animation: fadeInUp 0.5s ease 0.2s both;
}

/* --- Cards --- */
.card {
  background: hsl(var(--card));
  color: hsl(var(--card-foreground));
  padding: 1.25rem;
  border-radius: 12px;
  border: 1px solid hsl(var(--border));
  margin-bottom: 1rem;
  transition: border-color 0.25s ease;
}

.card:hover {
  border-color: hsl(var(--border) / 1.4);
}

.card h3 {
  font-family: 'DM Sans', system-ui, sans-serif;
  font-size: 0.72rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: hsl(var(--muted-foreground));
  margin: 0 0 0.75rem;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.75rem;
}

.card-header h3 {
  margin-bottom: 0;
}

/* --- Item boxes --- */
.item-box {
  background: hsl(var(--muted));
  padding: 0.85rem;
  border-radius: 8px;
  margin-bottom: 0.6rem;
  border: 1px solid transparent;
  transition: border-color 0.2s ease, background 0.2s ease;
}

.item-box:hover {
  border-color: hsl(var(--border));
}

.flex-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.4rem;
}

.grid-2 {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.5rem;
  margin: 0.5rem 0;
}

/* --- Inputs --- */
input[type="number"], select {
  width: 100%;
  padding: 0.45rem 0.6rem;
  border: 1px solid hsl(var(--input));
  background: hsl(var(--background));
  color: hsl(var(--foreground));
  border-radius: 6px;
  box-sizing: border-box;
  font-family: 'DM Sans', system-ui, sans-serif;
  font-size: 0.85rem;
  transition: border-color 0.2s ease, box-shadow 0.2s ease;
  font-variant-numeric: tabular-nums;
}

input[type="number"]:focus, select:focus {
  outline: none;
  border-color: hsl(var(--primary));
  box-shadow: 0 0 0 2px hsl(var(--primary) / 0.15);
}

.item-label {
  font-weight: 600;
  font-size: 0.85rem;
  color: hsl(var(--foreground));
  font-variant-numeric: tabular-nums;
}

/* --- Range slider --- */
input[type="range"] {
  width: 100%;
  margin: 0.75rem 0;
  -webkit-appearance: none;
  appearance: none;
  height: 4px;
  background: hsl(var(--border));
  border-radius: 2px;
  outline: none;
}

input[type="range"]::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: hsl(var(--primary));
  cursor: pointer;
  border: 2px solid hsl(var(--background));
  box-shadow: 0 0 0 1px hsl(var(--primary) / 0.3);
  transition: transform 0.15s ease, box-shadow 0.15s ease;
}

input[type="range"]::-webkit-slider-thumb:hover {
  transform: scale(1.2);
  box-shadow: 0 0 0 4px hsl(var(--primary) / 0.15);
}

input[type="range"]::-moz-range-thumb {
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: hsl(var(--primary));
  cursor: pointer;
  border: 2px solid hsl(var(--background));
}

/* --- Buttons --- */
.btn-primary {
  background: hsl(var(--primary));
  color: hsl(var(--primary-foreground));
  border: none;
  padding: 0.55rem 1.1rem;
  border-radius: 8px;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 0.4rem;
  font-family: 'DM Sans', system-ui, sans-serif;
  font-size: 0.82rem;
  font-weight: 600;
  letter-spacing: 0.02em;
  transition: background 0.2s ease, transform 0.15s ease;
}

.btn-primary:hover {
  background: hsl(var(--primary) / 0.85);
  transform: translateY(-1px);
}

.btn-primary:active {
  transform: translateY(0);
}

.btn-icon {
  background: none;
  border: 1px solid hsl(var(--border));
  color: hsl(var(--primary));
  cursor: pointer;
  width: 28px;
  height: 28px;
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.2s ease, border-color 0.2s ease;
}

.btn-icon:hover {
  background: hsl(var(--primary) / 0.1);
  border-color: hsl(var(--primary) / 0.3);
}

.btn-delete {
  background: none;
  border: none;
  color: hsl(var(--muted-foreground));
  cursor: pointer;
  padding: 4px;
  border-radius: 4px;
  transition: color 0.15s ease, background 0.15s ease;
}

.btn-delete:hover {
  color: hsl(var(--destructive));
  background: hsl(var(--destructive) / 0.1);
}

/* --- Chart --- */
.chart-container {
  background: hsl(var(--card));
  height: 400px;
  border-radius: 12px;
  padding: 2rem;
  padding-top: 3rem;
  display: flex;
  align-items: flex-end;
  border: 1px solid hsl(var(--border));
  position: relative;
  overflow: visible;
}

.bars {
  display: flex;
  align-items: flex-end;
  gap: 3px;
  width: 100%;
  height: 100%;
  padding: 0;
  box-sizing: border-box;
  overflow: visible;
  border-bottom: 1px solid hsl(var(--border));
}

.bar {
  flex: 1;
  border-radius: 3px 3px 0 0;
  position: relative;
  min-width: 0;
  cursor: pointer;
  transform-origin: bottom;
  animation: barGrow 0.6s cubic-bezier(0.22, 1, 0.36, 1) both;
  transition: filter 0.2s ease, box-shadow 0.2s ease;
}

/* Stagger bar animation */
.bar:nth-child(1) { animation-delay: 0.05s; }
.bar:nth-child(2) { animation-delay: 0.07s; }
.bar:nth-child(3) { animation-delay: 0.09s; }
.bar:nth-child(4) { animation-delay: 0.11s; }
.bar:nth-child(5) { animation-delay: 0.13s; }
.bar:nth-child(6) { animation-delay: 0.15s; }
.bar:nth-child(7) { animation-delay: 0.17s; }
.bar:nth-child(8) { animation-delay: 0.19s; }
.bar:nth-child(9) { animation-delay: 0.21s; }
.bar:nth-child(10) { animation-delay: 0.23s; }
.bar:nth-child(n+11) { animation-delay: 0.25s; }
.bar:nth-child(n+16) { animation-delay: 0.3s; }
.bar:nth-child(n+21) { animation-delay: 0.35s; }
.bar:nth-child(n+26) { animation-delay: 0.4s; }
.bar:nth-child(n+31) { animation-delay: 0.45s; }
.bar:nth-child(n+36) { animation-delay: 0.5s; }
.bar:nth-child(n+41) { animation-delay: 0.55s; }
.bar:nth-child(n+46) { animation-delay: 0.6s; }

.bar:hover {
  filter: brightness(1.25);
  z-index: 10;
  box-shadow: 0 0 12px hsl(var(--primary) / 0.15);
}

.bar.active {
  filter: brightness(1.25);
  z-index: 10;
  box-shadow: 0 0 12px hsl(var(--primary) / 0.2);
}

/* --- Tooltips --- */
.tooltip {
  position: absolute;
  bottom: calc(100% + 10px);
  left: 50%;
  transform: translateX(-50%);
  background: hsl(var(--popover));
  color: hsl(var(--popover-foreground));
  padding: 8px 12px;
  border-radius: 8px;
  font-size: 0.72rem;
  line-height: 1.5;
  display: none;
  white-space: nowrap;
  z-index: 20;
  pointer-events: none;
  border: 1px solid hsl(var(--border));
  box-shadow: 0 8px 24px hsl(var(--background) / 0.6);
  backdrop-filter: blur(8px);
}

/* Arrow */
.tooltip::after {
  content: '';
  position: absolute;
  top: 100%;
  left: 50%;
  transform: translateX(-50%);
  border: 5px solid transparent;
  border-top-color: hsl(var(--popover));
}

/* Edge-aware tooltip positioning */
.bar:nth-last-child(-n+3) .tooltip {
  left: auto;
  right: 0;
  transform: none;
}
.bar:nth-last-child(-n+3) .tooltip::after {
  left: auto;
  right: 12px;
  transform: none;
}
.bar:nth-last-child(-n+2) .tooltip {
  bottom: auto;
  top: 8px;
}
.bar:nth-last-child(-n+2) .tooltip::after {
  top: auto;
  bottom: 100%;
  border: 5px solid transparent;
  border-bottom-color: hsl(var(--popover));
}
.bar:nth-child(-n+3) .tooltip {
  left: 0;
  right: auto;
  transform: none;
}
.bar:nth-child(-n+3) .tooltip::after {
  left: 12px;
  right: auto;
  transform: none;
}

.tooltip strong {
  color: hsl(var(--primary));
}

.tooltip .gain-pos { color: hsl(var(--positive)); }
.tooltip .gain-neg { color: hsl(var(--destructive)); }
.tooltip .gain-deposit { color: #5aafba; }
.tooltip .gain-total {
  color: hsl(var(--foreground));
  font-weight: 600;
  border-top: 1px solid hsl(var(--border));
  padding-top: 3px;
  display: inline-block;
  margin-top: 3px;
}

.bar:hover .tooltip { display: block; }
.bar.active .tooltip { display: block; }

/* Mobile tooltip panel */
.mobile-tooltip {
  display: none;
}

.mobile-tooltip .gain-pos { color: hsl(var(--positive)); }
.mobile-tooltip .gain-neg { color: hsl(var(--destructive)); }
.mobile-tooltip .gain-deposit { color: #5aafba; }
.mobile-tooltip .gain-total {
  color: hsl(var(--foreground));
  font-weight: 600;
  border-top: 1px solid hsl(var(--border));
  padding-top: 3px;
  display: inline-block;
  margin-top: 3px;
}

/* --- Stats --- */
.stats-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 1rem;
  margin-top: 1.5rem;
}

.stat-card {
  background: hsl(var(--card));
  color: hsl(var(--card-foreground));
  padding: 1.25rem;
  border-radius: 12px;
  border: 1px solid hsl(var(--border));
  overflow: hidden;
  animation: fadeInUp 0.5s ease 0.4s both;
  transition: border-color 0.2s ease;
}

.stat-card:hover {
  border-color: hsl(var(--border) / 1.5);
}

.stat-card label {
  font-size: 0.68rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: hsl(var(--muted-foreground));
  display: block;
  margin-bottom: 0.35rem;
}

.stat-card h2 {
  font-family: 'Cormorant Garamond', Georgia, serif;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
  font-size: 1.55rem;
  font-weight: 600;
  margin: 0;
  letter-spacing: -0.01em;
}

.tax-note {
  display: block;
  font-size: 0.72rem;
  color: hsl(var(--muted-foreground));
  margin-top: 0.3rem;
  font-variant-numeric: tabular-nums;
}

.tax-note small {
  color: hsl(var(--muted-foreground));
  opacity: 0.7;
}

.inflation-note {
  display: block;
  font-size: 0.72rem;
  color: hsl(var(--muted-foreground));
  margin-top: 0.15rem;
  font-variant-numeric: tabular-nums;
}

.inflation-note small {
  color: hsl(var(--muted-foreground));
  opacity: 0.7;
}

.highlighted {
  background: hsl(var(--secondary));
  border: 1px solid hsl(var(--primary) / 0.2);
}

.highlighted h2 {
  color: hsl(var(--primary));
}

.monthly-card h2 {
  color: hsl(var(--foreground));
}

.monthly-label {
  display: flex;
  align-items: center;
  gap: 0.3rem;
  flex-wrap: nowrap;
}

.inline-rate-btn {
  border: none;
  background: none;
  color: hsl(var(--primary));
  font-size: 0.68rem;
  font-weight: 600;
  padding: 0;
  margin-left: 0.15rem;
  cursor: pointer;
  text-decoration: underline;
  text-decoration-style: dotted;
  text-underline-offset: 2px;
  text-decoration-color: hsl(var(--primary) / 0.4);
  transition: color 0.15s ease;
}

.inline-rate-btn:hover {
  color: hsl(var(--primary) / 0.8);
}

.inline-rate-input {
  width: 3.8rem !important;
  min-width: 3.8rem;
  display: inline-block;
  vertical-align: baseline;
  margin: 0 0.2rem;
  padding: 0.05rem 0.25rem;
  font-size: 0.78rem;
  border: 1px solid hsl(var(--primary) / 0.3);
  border-radius: 4px;
  background: hsl(var(--background));
  color: hsl(var(--foreground));
  line-height: 1.1;
}

/* --- Duration / Year controls --- */
.small-label-input {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.small-label-input label {
  font-size: 0.68rem;
  color: hsl(var(--muted-foreground));
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.small-label-input input {
  width: 100%;
}

.year-input {
  width: 4rem !important;
  text-align: center;
}

.year-range-row {
  display: flex;
  align-items: flex-end;
  gap: 0.5rem;
  margin: 0.5rem 0;
}

.duration-toggle {
  margin-top: 0.25rem;
}

.btn-link {
  background: none;
  border: none;
  color: hsl(var(--primary));
  cursor: pointer;
  font-size: 0.72rem;
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 0;
  transition: opacity 0.15s ease;
}

.btn-link:hover {
  opacity: 0.75;
}

.btn-link-reset {
  color: hsl(var(--muted-foreground));
  font-size: 0.85rem;
  margin-left: auto;
  align-self: center;
}

.btn-link-reset:hover {
  color: hsl(var(--destructive));
}

/* --- Toggle --- */
.toggle-row {
  margin-top: 0.75rem;
}

.toggle-label {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.82rem;
  color: hsl(var(--foreground));
  cursor: pointer;
}

.toggle-label input[type="checkbox"] {
  width: auto;
  margin: 0;
  accent-color: hsl(var(--primary));
}

/* --- Yield display --- */
.yield-display {
  font-weight: 700;
  display: flex;
  align-items: center;
  gap: 4px;
  font-variant-numeric: tabular-nums;
  min-width: 5rem;
  font-size: 0.95rem;
  color: hsl(var(--positive));
}

.negative {
  color: hsl(var(--destructive));
}

/* --- Sidebar duration label --- */
.card > label {
  font-size: 0.78rem;
  color: hsl(var(--muted-foreground));
  display: block;
  margin-top: 0.75rem;
}

/* --- Input group --- */
.input-group {
  display: flex;
  flex-direction: column;
}

/* --- ETF Benchmark --- */
.benchmark-section {
  margin-top: 2rem;
  padding: 1.25rem 1.5rem;
  background: hsl(var(--card));
  border-radius: 12px;
  border: 1px solid hsl(var(--border));
  animation: fadeInUp 0.5s ease 0.5s both;
}

.benchmark-section h4 {
  margin: 0 0 1rem;
  font-family: 'DM Sans', system-ui, sans-serif;
  font-size: 0.72rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: hsl(var(--muted-foreground));
}

.benchmark-sub {
  font-weight: 400;
  text-transform: none;
  letter-spacing: 0;
  color: hsl(var(--muted-foreground));
  opacity: 0.7;
  font-size: 0.72rem;
}

.benchmark-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 0.6rem;
}

.benchmark-card {
  padding: 0.85rem 1rem;
  border-radius: 8px;
  background: hsl(var(--muted));
  border: 1px solid hsl(var(--border));
  transition: border-color 0.2s ease;
}

.benchmark-card:hover {
  border-color: hsl(var(--primary) / 0.2);
}

.benchmark-name {
  font-weight: 600;
  font-size: 0.82rem;
  color: hsl(var(--foreground));
  margin-bottom: 0.3rem;
}

.benchmark-ticker {
  font-weight: 400;
  color: hsl(var(--muted-foreground));
  font-size: 0.75rem;
}

.benchmark-return {
  font-size: 1.15rem;
  font-weight: 700;
  margin-bottom: 0.15rem;
  font-variant-numeric: tabular-nums;
  font-family: 'Cormorant Garamond', Georgia, serif;
}

.benchmark-total {
  font-size: 0.78rem;
  font-weight: 400;
  color: hsl(var(--muted-foreground));
  margin-left: 0.3rem;
  font-family: 'DM Sans', system-ui, sans-serif;
}

.bm-pos { color: hsl(var(--positive)); }
.bm-neg { color: hsl(var(--destructive)); }

.benchmark-meta {
  font-size: 0.72rem;
  color: hsl(var(--muted-foreground));
}

.benchmark-warn { color: #e5a820; }

.benchmark-na {
  font-size: 0.78rem;
  color: hsl(var(--muted-foreground));
  font-style: italic;
}

.benchmark-disclaimer {
  margin: 0.85rem 0 0;
  font-size: 0.68rem;
  color: hsl(var(--muted-foreground));
  opacity: 0.6;
  line-height: 1.4;
}

/* --- Responsive --- */
@media (max-width: 1200px) {
  .stats-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 900px) {
  .app-container {
    padding: 1rem 0.75rem;
  }

  .main-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 0.75rem;
    margin-bottom: 1.5rem;
    padding-bottom: 1rem;
  }

  .main-header h1 {
    font-size: 1.5rem;
  }

  .grid-layout {
    grid-template-columns: 1fr;
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  /* Hide hover tooltips on mobile; use panel instead */
  .bar .tooltip,
  .bar:hover .tooltip,
  .bar.active .tooltip {
    display: none !important;
  }

  .mobile-tooltip {
    position: absolute;
    top: 0.5rem;
    left: 50%;
    transform: translateX(-50%);
    display: block;
    width: min(260px, calc(100% - 1rem));
    background: hsl(var(--popover));
    color: hsl(var(--popover-foreground));
    padding: 8px 12px;
    border-radius: 8px;
    font-size: 0.72rem;
    line-height: 1.5;
    z-index: 25;
    pointer-events: none;
    text-align: left;
    white-space: normal;
    border: 1px solid hsl(var(--border));
    box-shadow: 0 8px 24px hsl(var(--background) / 0.6);
  }

  .mobile-tooltip strong {
    color: hsl(var(--primary));
  }

  .dashboard {
    position: static;
    order: -1;
    width: 100%;
    min-width: 0;
  }

  .chart-container {
    height: 300px;
    padding: 1.25rem;
    padding-top: 2.5rem;
    overflow-x: auto;
    overflow-y: visible;
    -webkit-overflow-scrolling: touch;
  }

  .bars {
    min-width: max-content;
    padding-right: 0;
  }

  .bars::after {
    content: "";
    flex: 0 0 16px;
  }

  .bar {
    min-width: 16px;
  }

  .stats-grid {
    grid-template-columns: 1fr;
    gap: 0.75rem;
    margin-top: 1rem;
  }

  .stat-card {
    padding: 1rem 1.15rem;
  }

  .stat-card h2 {
    font-size: 1.35rem;
  }

  .sidebar {
    width: 100%;
    min-width: unset;
  }

  .card {
    padding: 1rem;
    margin-bottom: 0.75rem;
  }

  .benchmark-section {
    padding: 1rem;
  }

  .benchmark-grid {
    grid-template-columns: 1fr;
  }
}

@media (hover: none), (pointer: coarse) {
  .bar:hover {
    filter: none;
    z-index: auto;
    box-shadow: none;
  }

  .bar .tooltip,
  .bar:hover .tooltip {
    display: none !important;
  }

  .bar.active {
    filter: brightness(1.25);
    z-index: 10;
    box-shadow: 0 0 12px hsl(var(--primary) / 0.2);
  }

  .bar.active .tooltip {
    display: none !important;
  }
}
</style>