<template>
  <div class="relative">
    <textarea
      ref="textareaRef"
      v-show="active"
      :class="[
        'w-full resize-none overflow-hidden px-3 py-2 outline-none',
        'rounded-lg border',
        'border-[var(--p-form-field-border-color)]',
        'focus:border-[var(--p-form-field-focus-border-color)]',
        'relative z-10',
      ]"
      v-model="innerValue"
      @input="resizeTextarea"
      @blur="exitEditMode"
    ></textarea>

    <div v-show="!active">
      <div v-show="editable" class="mb-4 flex items-center gap-2 text-gray-600">
        <i class="pi pi-info-circle"></i>
        <span>
          {{ $t('tapToChange') }}
        </span>
      </div>

      <div class="relative">
        <div
          v-if="renderedDescription"
          class="markdown-it"
          v-html="renderedDescription"
        ></div>
        <div v-else class="flex flex-col items-center gap-2 py-5">
          <i class="pi pi-info-circle text-lg"></i>
          <div>no description</div>
        </div>
        <div
          v-show="editable"
          class="absolute left-0 top-0 h-full w-full cursor-pointer"
          @click="entryEditMode"
        ></div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useModelDescription } from 'hooks/model'
import { nextTick, ref, watch } from 'vue'

const editable = defineModel<boolean>('editable')
const active = ref(false)

const { description, renderedDescription } = useModelDescription()

const textareaRef = ref<HTMLTextAreaElement>()
const innerValue = ref<string>()

watch(
  description,
  (value) => {
    innerValue.value = value
  },
  { immediate: true },
)

const resizeTextarea = () => {
  const textarea = textareaRef.value!

  textarea.style.height = 'auto'
  const scrollHeight = textarea.scrollHeight

  textarea.style.height = scrollHeight + 'px'

  textarea.scrollIntoView({
    block: 'nearest',
    inline: 'nearest',
  })
}

const entryEditMode = async () => {
  active.value = true
  await nextTick()
  resizeTextarea()
  textareaRef.value!.focus()
}

const exitEditMode = () => {
  description.value = innerValue.value!
  active.value = false
}
</script>
