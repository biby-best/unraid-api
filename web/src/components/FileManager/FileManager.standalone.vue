<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue';

// Component state
const iframeRef = ref<HTMLIFrameElement | null>(null);
const isLoading = ref(true);
const hasError = ref(false);
const errorMessage = ref('');

// FileManager iframe URL
const fileManagerUrl = ref('/filemanager/');

// Handle iframe load events
const handleIframeLoad = () => {
  isLoading.value = false;
  hasError.value = false;
};

const handleIframeError = () => {
  isLoading.value = false;
  hasError.value = true;
  errorMessage.value = 'Failed to load File Manager';
};

// Handle messages from iframe
const handleMessage = (event: MessageEvent) => {
  // Handle messages from FileBrowser iframe if needed
  if (event.origin !== window.location.origin) {
    return;
  }

  // Handle specific FileBrowser messages
  if (event.data && typeof event.data === 'object') {
    if (event.data.type === 'filebrowser-ready') {
      isLoading.value = false;
    }
  }
};

// Lifecycle
onMounted(() => {
  window.addEventListener('message', handleMessage);
});

onUnmounted(() => {
  window.removeEventListener('message', handleMessage);
});
</script>

<template>
  <div class="file-manager-container">
    <!-- Loading state -->
    <div v-if="isLoading" class="loading-container">
      <div class="loading-spinner" />
      <p>Loading File Manager...</p>
    </div>

    <!-- Error state -->
    <div v-else-if="hasError" class="error-container">
      <div class="error-icon">⚠️</div>
      <h3>File Manager Error</h3>
      <p>{{ errorMessage }}</p>
      <button
        @click="
          isLoading = true;
          hasError = false;
        "
        class="retry-button"
      >
        Retry
      </button>
    </div>

    <!-- File Manager iframe -->
    <iframe
      v-else
      ref="iframeRef"
      :src="fileManagerUrl"
      class="file-manager-iframe"
      title="File Manager"
      @load="handleIframeLoad"
      @error="handleIframeError"
    />
  </div>
</template>

<style scoped>
.file-manager-container {
  width: 100%;
  height: 100vh;
  position: relative;
  background: #f8f9fa;
}

.loading-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100vh;
  background: #f8f9fa;
}

.loading-spinner {
  width: 40px;
  height: 40px;
  border: 4px solid #e3e3e3;
  border-top: 4px solid #007bff;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin-bottom: 16px;
}

@keyframes spin {
  0% {
    transform: rotate(0deg);
  }
  100% {
    transform: rotate(360deg);
  }
}

.error-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100vh;
  background: #f8f9fa;
  text-align: center;
  padding: 20px;
}

.error-icon {
  font-size: 48px;
  margin-bottom: 16px;
}

.error-container h3 {
  color: #dc3545;
  margin-bottom: 8px;
}

.error-container p {
  color: #6c757d;
  margin-bottom: 20px;
}

.retry-button {
  background: #007bff;
  color: white;
  border: none;
  padding: 10px 20px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
}

.retry-button:hover {
  background: #0056b3;
}

.file-manager-iframe {
  width: 100%;
  height: 100vh;
  border: none;
  background: white;
}
</style>
