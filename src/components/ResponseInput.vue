<template>
  <div class="p-component p-inputtext flex items-center gap-2">
    <slot name="prefix">
      <span v-if="prefixIcon" :class="[prefixIcon, 'pi-inputicon']"></span>
    </slot>

    <input
      ref="inputRef"
      v-model="innerValue"
      class="flex-1 border-none bg-transparent text-base outline-none"
      type="text"
      :placeholder="placeholder"
      @paste.stop
      v-bind="$attrs"
      @[trigger]="updateContent"
    />

    <span
      v-if="allowClear"
      v-show="content"
      class="pi pi-times pi-inputicon"
      @click="clearContent"
    ></span>
    <slot name="suffix">
      <span v-if="suffixIcon" :class="[suffixIcon, 'pi-inputicon']"></span>
    </slot>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, ref } from 'vue'

interface Props {
  prefixIcon?: string
  suffixIcon?: string
  placeholder?: string
  allowClear?: boolean
  updateTrigger?: string
}

const props = defineProps<Props>()
const [content, modifiers] = defineModel<string, 'trim'>()

const inputRef = ref()

const innerValue = ref(content)
const trigger = computed(() => props.updateTrigger ?? 'input')
const updateContent = () => {
  let value = innerValue.value

  if (modifiers.trim) {
    value = innerValue.value?.trim()
  }

  content.value = value
  inputRef.value.value = value
}

defineOptions({
  inheritAttrs: false,
})

const clearContent = () => {
  content.value = undefined
  inputRef.value?.focus()
}
</script>

<style>
.p-inputtext:focus-within {
  border-color: var(--p-inputtext-focus-border-color);
  box-shadow: var(--p-inputtext-focus-ring-shadow);
  outline: var(--p-inputtext-focus-ring-width)
    var(--p-inputtext-focus-ring-style) var(--p-inputtext-focus-ring-color);
  outline-offset: var(--p-inputtext-focus-ring-offset);
}

.p-inputtext .pi-inputicon {
  font-size: 1rem;
  opacity: 0.6;
}
</style>
