<template>
  <Toast :position="position" :style="style"></Toast>
</template>

<script setup lang="ts">
import { useConfig } from 'hooks/config'
import Toast from 'primevue/toast'
import { computed } from 'vue'

const config = useConfig()

const position = computed(() => {
  return config.isMobile.value ? 'top-center' : 'top-right'
})

const style = computed(() => {
  if (config.isMobile.value) {
    return { width: '80vw' }
  }
  return {}
})
</script>
