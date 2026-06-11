<script setup>
import { ref } from 'vue';
import { Download, Link } from 'lucide-vue-next';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { calculateData } from '../composables/useGrowthCalculations.js';
import { encodeState } from '../composables/useInvestmentStore.js';

const copied = ref(false);

const exportPDF = () => {
  const doc = new jsPDF();
  doc.text('Anlagesimulation – Bericht', 14, 20);
  const tableData = calculateData.value.map((d) => [d.year, `${d.rate}%`, `${d.balance.toLocaleString()} €`]);
  autoTable(doc, { head: [['Jahr', 'Rendite', 'Stand']], body: tableData, startY: 30 });
  doc.save('anlageplan.pdf');
};

const copyShareLink = async () => {
  const hash = window.location.hash.split('?')[0];
  const url = `${window.location.origin}${window.location.pathname}${hash}?s=${encodeState()}`;
  await navigator.clipboard.writeText(url);
  copied.value = true;
  setTimeout(() => (copied.value = false), 2000);
};
</script>

<template>
  <header class="main-header">
    <div>
      <h1>ETF-Rechner</h1>
      <p>Plane deinen langfristigen Vermögensaufbau</p>
    </div>
    <div class="header-actions">
      <button @click="copyShareLink" class="btn-secondary" :class="{ copied }">
        <Link size="18" />{{ copied ? 'Kopiert!' : 'Teilen' }}
      </button>
      <button @click="exportPDF" class="btn-primary"><Download size="18" /> PDF-Export</button>
    </div>
  </header>
</template>
