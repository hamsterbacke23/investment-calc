import { ref, computed } from 'vue';

// Shared open/close state for the mobile settings drawer. On desktop the sidebar
// is always visible and this state is simply ignored by the CSS.
export const settingsOpen = ref(false);

// Whether we are at the mobile breakpoint (set by App via matchMedia).
export const isNarrow = ref(false);

export function toggleSettings() {
  settingsOpen.value = !settingsOpen.value;
}

export function closeSettings() {
  settingsOpen.value = false;
}

// On mobile the closed drawer is off-screen but still in the DOM — mark it inert
// so its inputs leave the tab order and the accessibility tree until it is opened.
// On desktop (not narrow) the sidebar is always interactive.
export const sidebarInert = computed(() => isNarrow.value && !settingsOpen.value);
