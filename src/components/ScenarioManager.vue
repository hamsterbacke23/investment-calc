<script setup>
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue';
import { Bookmark, Save, Trash2, RotateCcw } from 'lucide-vue-next';
import {
  savedScenarios,
  saveScenario,
  applyScenario,
  deleteScenario,
  defaultScenarioName,
  MAX_SCENARIOS,
} from '../composables/useInvestmentStore.js';

const open = ref(false);
const name = ref('');
const justSaved = ref(false);
const root = ref(null);

const count = computed(() => savedScenarios.value.length);
const atCap = computed(() => count.value >= MAX_SCENARIOS);
const canSave = computed(() => name.value.trim().length > 0);

// A name is always required: prefill an editable suggestion when the panel opens,
// but don't clobber a name the user already typed (and left unsaved).
watch(open, (isOpen) => {
  if (isOpen && !name.value.trim()) name.value = defaultScenarioName();
});

const fmtDate = (ts) => {
  try {
    return new Date(ts).toLocaleDateString('de-DE', { day: '2-digit', month: 'short', year: '2-digit' });
  } catch { return ''; }
};
// Short human summary of a stored plan, read straight from its compact blob.
const summary = (d) => {
  if (!d) return '';
  const k = Math.round((d.ic || 0) / 1000);
  const yrs = d.dy ?? '?';
  const mode = { dynamic: 'dynamisch', real: 'real', nominal: 'nominal' }[d.wm] || d.wm || '';
  return `${k}k Start · ${yrs} J · ${mode}`;
};

const doSave = () => {
  if (!canSave.value) return;
  saveScenario(name.value);
  name.value = defaultScenarioName(); // ready for the next save, always named
  justSaved.value = true;
  setTimeout(() => (justSaved.value = false), 1400);
};
const doLoad = (id) => {
  applyScenario(id);
  open.value = false;
};

// Close on outside click / Escape.
const onDocClick = (e) => {
  if (open.value && root.value && !root.value.contains(e.target)) open.value = false;
};
const onKey = (e) => { if (e.key === 'Escape') open.value = false; };
onMounted(() => {
  document.addEventListener('click', onDocClick);
  window.addEventListener('keydown', onKey);
});
onBeforeUnmount(() => {
  document.removeEventListener('click', onDocClick);
  window.removeEventListener('keydown', onKey);
});
</script>

<template>
  <div class="scenario-manager" ref="root">
    <button
      type="button"
      class="btn-secondary"
      :class="{ active: open }"
      :aria-expanded="open"
      aria-haspopup="true"
      @click.stop="open = !open"
    >
      <Bookmark size="18" />Pläne<span v-if="count" class="scenario-count">{{ count }}</span>
    </button>

    <div v-if="open" class="scenario-panel" role="menu">
      <div class="scenario-panel-head">
        <span class="scenario-panel-title">Gespeicherte Pläne</span>
        <span class="scenario-panel-cap">{{ count }}/{{ MAX_SCENARIOS }}</span>
      </div>

      <form class="scenario-save" @submit.prevent="doSave">
        <input
          v-model="name"
          class="scenario-input"
          type="text"
          placeholder="Name des Plans"
          aria-label="Name des Plans"
          maxlength="40"
        />
        <button type="submit" class="btn-primary scenario-save-btn" :class="{ ok: justSaved }" :disabled="!canSave">
          <Save size="15" />{{ justSaved ? 'Gespeichert' : 'Speichern' }}
        </button>
      </form>
      <div v-if="atCap" class="scenario-hint">Maximum erreicht — der älteste Plan wird beim Speichern ersetzt.</div>

      <ul v-if="count" class="scenario-list">
        <li v-for="s in savedScenarios" :key="s.id" class="scenario-item">
          <button type="button" class="scenario-load" @click="doLoad(s.id)" :title="`„${s.name}“ laden`">
            <RotateCcw size="14" class="scenario-load-icon" />
            <span class="scenario-load-text">
              <span class="scenario-name">{{ s.name }}</span>
              <span class="scenario-meta">{{ summary(s.data) }} · {{ fmtDate(s.ts) }}</span>
            </span>
          </button>
          <button type="button" class="scenario-del" @click.stop="deleteScenario(s.id)" :aria-label="`„${s.name}“ löschen`" title="Löschen">
            <Trash2 size="15" />
          </button>
        </li>
      </ul>
      <div v-else class="scenario-empty">
        <Bookmark size="15" />
        <span>Noch keine Pläne gespeichert. Speichere deine aktuellen Einstellungen, um sie später wiederherzustellen.</span>
      </div>
    </div>
  </div>
</template>
