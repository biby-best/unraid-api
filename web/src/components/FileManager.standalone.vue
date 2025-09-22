<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';

import { useApiStore } from '~/store/api';

// Component props
interface Props {
  height?: string;
  title?: string;
}

const props = withDefaults(defineProps<Props>(), {
  height: '600px',
  title: 'File Manager',
});

// Component state
const apiStore = useApiStore();
const iframeRef = ref<HTMLIFrameElement>();
const isLoading = ref(true);
const hasError = ref(false);

// Computed properties
const fileManagerUrl = computed(() => {
  const baseUrl = apiStore.baseUrl || window.location.origin;
  return `${baseUrl}/filemanager`;
});

const iframeStyle = computed(() => ({
  width: '100%',
  height: props.height,
  border: 'none',
  borderRadius: '6px',
}));

// Methods
const onIframeLoad = () => {
  isLoading.value = false;
  hasError.value = false;
};

const onIframeError = () => {
  isLoading.value = false;
  hasError.value = true;
};

const refresh = () => {
  if (iframeRef.value) {
    isLoading.value = true;
    hasError.value = false;
    const currentSrc = iframeRef.value.src;
    iframeRef.value.src = '';
    iframeRef.value.src = currentSrc;
  }
};

// Initialize
onMounted(() => {
  // The iframe will load the FileBrowser interface
  // Authentication is handled by the proxy on the backend
});
</script>

<template>
  <div
    class="bg-background text-foreground border-border flex flex-col overflow-hidden rounded-lg border"
  >
    <!-- Header -->
    <div class="border-border flex items-center justify-between border-b px-4 py-3">
      <h3 class="text-lg font-semibold">{{ title }}</h3>
      <button
        @click="refresh"
        class="text-muted-foreground hover:text-foreground hover:bg-accent inline-flex h-8 w-8 items-center justify-center rounded-md transition-colors"
        title="Refresh"
      >
        <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
          />
        </svg>
      </button>
    </div>

    <!-- Content -->
    <div class="relative flex-1 overflow-hidden">
      <!-- Loading state -->
      <div v-if="isLoading" class="text-muted-foreground flex h-full items-center justify-center">
        <div class="flex flex-col items-center gap-2">
          <div class="border-primary h-8 w-8 animate-spin rounded-full border-2 border-t-transparent" />
          <p>Loading File Manager...</p>
        </div>
      </div>

      <!-- Error state -->
      <div
        v-else-if="hasError"
        class="text-destructive flex h-full flex-col items-center justify-center p-4 text-center"
      >
        <div class="mb-4">
          <svg class="mx-auto h-12 w-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"
            />
          </svg>
        </div>
        <h3 class="mb-2 text-lg font-semibold">Failed to load File Manager</h3>
        <p class="text-sm">The file manager service may not be available.</p>
        <button
          @click="refresh"
          class="bg-primary text-primary-foreground hover:bg-primary/90 mt-4 rounded-md px-4 py-2"
        >
          Try Again
        </button>
      </div>

      <!-- File Manager iframe -->
      <iframe
        v-else
        ref="iframeRef"
        :src="fileManagerUrl"
        :style="iframeStyle"
        @load="onIframeLoad"
        @error="onIframeError"
        allowfullscreen
      />
    </div>
  </div>
</template>
