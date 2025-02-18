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
      v-model="inputValue"
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
  validate?: (value: string | undefined) => boolean
}

const props = defineProps<Props>()
const [content, modifiers] = defineModel<string, 'trim' | 'valid'>()

const inputRef = ref()

const innerValue = ref<string>()
const inputValue = computed({
  get: () => {
    return innerValue.value ?? content.value
  },
  set: (val) => {
    innerValue.value = val
  },
})
const trigger = computed(() => props.updateTrigger ?? 'change')
const updateContent = () => {
  let value = innerValue.value

  if (modifiers.trim) {
    value = innerValue.value?.trim()
  }

  if (modifiers.valid) {
    const isValid = props.validate?.(value) ?? true
    console.log({ isValid, value })
    if (!isValid) {
      innerValue.value = content.value
      return
    }
  }

  innerValue.value = undefined
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
