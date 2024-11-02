<template>
  <span class="relative">
    <img :src="src" :alt="alt" v-bind="$attrs" @error="onError" />
    <img v-if="error" v-show="loadError" :src="error" class="absolute top-0" />
  </span>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'

interface Props {
  src?: string
  alt?: string
  error?: string
}

const props = defineProps<Props>()

defineOptions({
  inheritAttrs: false,
})

const loadError = ref(false)

watch(
  () => props.src,
  () => {
    loadError.value = !props.src
  },
  { immediate: true },
)

const onError = () => {
  loadError.value = true
}
</script>
