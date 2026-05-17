import { ref, onMounted } from 'vue';

const isTouchDevice = ref(false);

function detect() {
  return (
    'ontouchstart' in window ||
    navigator.maxTouchPoints > 0 ||
    navigator.msMaxTouchPoints > 0
  );
}

export function useTouchDevice() {
  onMounted(() => {
    isTouchDevice.value = detect();
  });
  return { isTouchDevice };
}
