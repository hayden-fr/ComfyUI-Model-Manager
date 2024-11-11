<template>
  <div
    :class="[
      'p-component p-inputtext flex items-center gap-2 border',
      'focus-within:border-[--p-inputtext-focus-border-color]',
    ]"
  >
    <slot name="prefix">
      <span
        v-if="prefixIcon"
        :class="[prefixIcon, 'text-base opacity-60']"
      ></span>
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
      class="pi pi-times text-base opacity-60"
      @click="clearContent"
    ></span>
    <slot name="suffix">
      <span
        v-if="suffixIcon"
        :class="[suffixIcon, 'text-base opacity-60']"
      ></span>
    </slot>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'

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
const trigger = computed(() => props.updateTrigger ?? 'change')
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
