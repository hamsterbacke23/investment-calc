<script setup>
import { watch, onMounted, onBeforeUnmount } from 'vue';
import { RouterView, useRoute } from 'vue-router';
import AppHeader from './components/AppHeader.vue';
import TabNav from './components/TabNav.vue';
import { useTouchDevice } from './composables/useTouchDevice.js';
import { initInvestmentStore } from './composables/useInvestmentStore.js';
import { settingsOpen, isNarrow, toggleSettings, closeSettings } from './composables/useSettingsPanel.js';

initInvestmentStore();
const { isTouchDevice } = useTouchDevice();
const route = useRoute();

// Lock body scroll while the mobile drawer is open; close it on tab change.
watch(settingsOpen, (open) => {
  document.body.style.overflow = open ? 'hidden' : '';
});
watch(() => route.path, () => closeSettings());

// Track the mobile breakpoint (matches the CSS @media max-width:900px) and wire
// Escape-to-close for the drawer.
let mql;
const onMql = (e) => { isNarrow.value = e.matches; };
const onKeydown = (e) => {
  if (e.key === 'Escape' && settingsOpen.value) closeSettings();
};
onMounted(() => {
  mql = window.matchMedia('(max-width: 900px)');
  isNarrow.value = mql.matches;
  mql.addEventListener('change', onMql);
  window.addEventListener('keydown', onKeydown);
});
onBeforeUnmount(() => {
  mql?.removeEventListener('change', onMql);
  window.removeEventListener('keydown', onKeydown);
});
</script>

<template>
  <div class="app-container" :class="{ 'touch-device': isTouchDevice, 'settings-open': settingsOpen }">
    <AppHeader />
    <TabNav />
    <RouterView />

    <div class="settings-backdrop" @click="closeSettings" aria-hidden="true"></div>
    <button
      type="button"
      class="settings-fab"
      :class="{ 'is-open': settingsOpen }"
      :aria-expanded="settingsOpen"
      aria-controls="app-sidebar"
      @click="toggleSettings"
    >
      <span aria-hidden="true" class="settings-fab-icon">{{ settingsOpen ? '×' : '☰' }}</span>
      {{ settingsOpen ? 'Schließen' : 'Einstellungen' }}
    </button>
  </div>
</template>
