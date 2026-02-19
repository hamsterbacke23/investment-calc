<script setup>
import { ref, computed, watch, onMounted } from 'vue';
import { Plus, Trash2, Download, Save, TrendingDown, TrendingUp, Calendar } from 'lucide-vue-next';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

// --- State ---
const initialCapital = ref(30000);
const durationYears = ref(15);
const reinvestGains = ref(true);
const yieldPhases = ref([{ id: 1, startYear: 1, endYear: 15, rate: 6, customDuration: false }]);
const transactions = ref([{ id: 1, name: 'Savings Plan', amount: 500, type: 'monthly', startYear: 1, endYear: 15, customDuration: false }]);

// --- Persistence ---
const saveToLocal = () => {
  const data = { initialCapital: initialCapital.value, durationYears: durationYears.value, reinvestGains: reinvestGains.value, yieldPhases: yieldPhases.value, transactions: transactions.value };
  localStorage.setItem('investment_sim_v1', JSON.stringify(data));
};

const loadFromLocal = () => {
  const saved = localStorage.getItem('investment_sim_v1');
  if (saved) {
    const parsed = JSON.parse(saved);
    initialCapital.value = parsed.initialCapital;
    durationYears.value = parsed.durationYears;
    if (parsed.reinvestGains !== undefined) reinvestGains.value = parsed.reinvestGains;
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

watch([initialCapital, durationYears, reinvestGains, yieldPhases, transactions], () => saveToLocal(), { deep: true });

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

  const baseColor = '#93c5fd';      // light blue - carried over
  const depositColor = '#3b82f6';    // medium blue - deposits
  const returnColor = d.returns >= 0 ? '#1e3a8a' : '#ef4444'; // dark blue / red - returns

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
  return { gains, tax, afterTax, inTodaysMoney, effectiveRate: gains > 0 ? (tax / gains * 100).toFixed(1) : '0.0' };
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
  <div class="app-container" @click="activeTooltipYear = null">
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
.app-container {
  max-width: 1400px;
  margin: 0 auto;
  padding: 2rem;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  background: hsl(var(--background));
  color: hsl(var(--foreground));
  min-height: 100vh;
}

.main-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 2rem;
}

.grid-layout {
  display: grid;
  grid-template-columns: 350px minmax(0, 1fr);
  gap: 2rem;
  align-items: start;
}

.sidebar {
  width: 350px;
  min-width: 350px;
}

.dashboard {
  position: sticky;
  top: 1rem;
  align-self: start;
  contain: layout style;
}

.card {
  background: hsl(var(--card));
  color: hsl(var(--card-foreground));
  padding: 1.5rem;
  border-radius: 1rem;
  border: 1px solid hsl(var(--border));
  margin-bottom: 1.5rem;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
}

.item-box {
  background: hsl(var(--muted));
  padding: 1rem;
  border-radius: 0.75rem;
  margin-bottom: 1rem;
}

.flex-row { display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem; }
.grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 0.5rem; margin: 0.5rem 0; }

input[type="number"], select {
  width: 100%;
  padding: 0.4rem;
  border: 1px solid hsl(var(--input));
  background: hsl(var(--background));
  color: hsl(var(--foreground));
  border-radius: 0.4rem;
  box-sizing: border-box;
}

.item-label { font-weight: 600; font-size: 0.9rem; color: hsl(var(--foreground)); }

input[type="range"] {
  width: 100%;
  margin: 1rem 0;
}

.btn-primary {
  background: hsl(var(--primary));
  color: hsl(var(--primary-foreground));
  border: none;
  padding: 0.6rem 1.2rem;
  border-radius: 0.5rem;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.btn-icon { background: none; border: none; color: hsl(var(--primary)); cursor: pointer; }
.btn-delete { background: none; border: none; color: hsl(var(--destructive)); cursor: pointer; }

.chart-container {
  background: hsl(var(--card));
  height: 400px;
  border-radius: 1rem;
  padding: 2rem;
  padding-top: 3.5rem;
  display: flex;
  align-items: flex-end;
  border: 1px solid hsl(var(--border));
  contain: style;
  position: relative;
  overflow: visible;
}

.bars {
  display: flex;
  align-items: flex-end;
  gap: 4px;
  width: 100%;
  height: 100%;
  border-bottom: 2px solid hsl(var(--border));
}

.bar {
  flex: 1;
  border-radius: 2px 2px 0 0;
  position: relative;
  transition: height 0.3s ease;
  min-width: 0;
}

.bar:hover { filter: brightness(1.15); z-index: 10; }
.bar.active { filter: brightness(1.15); z-index: 10; }

.tooltip {
  position: absolute;
  bottom: calc(100% + 8px);
  left: 50%;
  transform: translateX(-50%);
  background: hsl(var(--popover));
  color: hsl(var(--popover-foreground));
  padding: 6px 10px;
  border-radius: 6px;
  font-size: 0.7rem;
  line-height: 1.4;
  display: none;
  white-space: nowrap;
  z-index: 20;
  pointer-events: none;
}

/* Prevent right-side tooltips from clipping */
.bar:nth-last-child(-n+3) .tooltip {
  left: auto;
  right: 0;
  transform: none;
}
.bar:nth-child(-n+3) .tooltip {
  left: 0;
  right: auto;
  transform: none;
}

.tooltip .gain-pos { color: #4ade80; }
.tooltip .gain-neg { color: #f87171; }
.tooltip .gain-deposit { color: #60a5fa; }
.tooltip .gain-total { color: hsl(var(--popover-foreground)); font-weight: 600; border-top: 1px solid hsl(var(--border)); padding-top: 2px; display: inline-block; margin-top: 2px; }

.bar:hover .tooltip { display: block; }
.bar.active .tooltip { display: block; }

.stats-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1.5rem;
  margin-top: 2rem;
}

.stat-card {
  background: hsl(var(--card));
  color: hsl(var(--card-foreground));
  padding: 1.5rem;
  border-radius: 1rem;
  border: 1px solid hsl(var(--border));
  overflow: hidden;
}

.stat-card h2 { font-variant-numeric: tabular-nums; white-space: nowrap; }
.tax-note { display: block; font-size: 0.75rem; color: hsl(var(--muted-foreground)); margin-top: 0.25rem; font-variant-numeric: tabular-nums; }
.tax-note small { color: hsl(var(--muted-foreground)); opacity: 0.8; }
.inflation-note { display: block; font-size: 0.75rem; color: hsl(var(--muted-foreground)); margin-top: 0.15rem; font-variant-numeric: tabular-nums; }
.inflation-note small { color: hsl(var(--muted-foreground)); opacity: 0.8; }

.highlighted { background: hsl(var(--secondary)); border: 1px solid hsl(var(--border)); }

.small-label-input { display: flex; flex-direction: column; gap: 2px; }
.small-label-input label { font-size: 0.7rem; color: hsl(var(--muted-foreground)); }
.small-label-input input { width: 100%; }

.year-input { width: 4rem !important; text-align: center; }

.year-range-row {
  display: flex;
  align-items: flex-end;
  gap: 0.5rem;
  margin: 0.5rem 0;
}

.duration-toggle { margin-top: 0.25rem; }

.btn-link {
  background: none;
  border: none;
  color: hsl(var(--primary));
  cursor: pointer;
  font-size: 0.75rem;
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 0;
}

.btn-link:hover { text-decoration: underline; }

.btn-link-reset {
  color: hsl(var(--muted-foreground));
  font-size: 0.85rem;
  margin-left: auto;
  align-self: center;
}
.btn-link-reset:hover { color: hsl(var(--destructive)); text-decoration: none; }

.toggle-row { margin-top: 0.75rem; }
.toggle-label {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.85rem;
  color: hsl(var(--foreground));
  cursor: pointer;
}
.toggle-label input[type="checkbox"] { width: auto; margin: 0; }

.yield-display { font-weight: bold; display: flex; align-items: center; gap: 4px; font-variant-numeric: tabular-nums; min-width: 5rem; }
.negative { color: hsl(var(--destructive)); }

/* --- ETF Benchmark --- */
.benchmark-section {
  margin-top: 2rem;
  padding: 1.25rem 1.5rem;
  background: hsl(var(--card));
  border-radius: 12px;
  border: 1px solid hsl(var(--border));
}
.benchmark-section h4 {
  margin: 0 0 1rem;
  font-size: 0.95rem;
  color: hsl(var(--foreground));
}
.benchmark-sub { font-weight: 400; color: hsl(var(--muted-foreground)); font-size: 0.85rem; }
.benchmark-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 0.75rem;
}
.benchmark-card {
  padding: 0.75rem 1rem;
  border-radius: 8px;
  background: hsl(var(--muted));
  border: 1px solid hsl(var(--border));
}
.benchmark-name {
  font-weight: 600;
  font-size: 0.85rem;
  color: hsl(var(--foreground));
  margin-bottom: 0.25rem;
}
.benchmark-ticker { font-weight: 400; color: hsl(var(--muted-foreground)); font-size: 0.8rem; }
.benchmark-return { font-size: 1.1rem; font-weight: 700; margin-bottom: 0.15rem; font-variant-numeric: tabular-nums; }
.benchmark-total { font-size: 0.8rem; font-weight: 400; color: hsl(var(--muted-foreground)); margin-left: 0.35rem; }
.bm-pos { color: #16a34a; }
.bm-neg { color: #ef4444; }
.benchmark-meta { font-size: 0.75rem; color: hsl(var(--muted-foreground)); }
.benchmark-warn { color: #f59e0b; }
.benchmark-na { font-size: 0.8rem; color: hsl(var(--muted-foreground)); font-style: italic; }
.benchmark-disclaimer {
  margin: 0.75rem 0 0;
  font-size: 0.7rem;
  color: hsl(var(--muted-foreground));
  line-height: 1.4;
}

@media (max-width: 900px) {
  .grid-layout {
    grid-template-columns: 1fr;
    display: flex;
    flex-direction: column;
  }
  .dashboard {
    position: static;
    order: -1;
  }
  .sidebar { width: 100%; min-width: unset; }
}
</style>