<script setup>
import { Download } from 'lucide-vue-next';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { calculateData } from '../composables/useGrowthCalculations.js';

const exportPDF = () => {
  const doc = new jsPDF();
  doc.text('Investment Simulation - Report', 14, 20);
  const tableData = calculateData.value.map((d) => [d.year, `${d.rate}%`, `${d.balance.toLocaleString()} €`]);
  autoTable(doc, { head: [['Year', 'Return', 'Balance']], body: tableData, startY: 30 });
  doc.save('investment-plan.pdf');
};
</script>

<template>
  <header class="main-header">
    <div>
      <h1>ETF Investment Calculator</h1>
      <p>Plan your long-term wealth growth</p>
    </div>
    <button @click="exportPDF" class="btn-primary"><Download size="18" /> PDF Export</button>
  </header>
</template>
