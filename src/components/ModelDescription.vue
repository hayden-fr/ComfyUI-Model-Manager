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
          :class="$style['markdown-body']"
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

<style lang="less" module>
.markdown-body {
  font-family: theme('fontFamily.sans');
  font-size: theme('fontSize.base');
  line-height: theme('lineHeight.relaxed');
  word-break: break-word;
  margin: 0;

  &::before {
    display: table;
    content: '';
  }

  &::after {
    display: table;
    content: '';
    clear: both;
  }

  > *:first-child {
    margin-top: 0 !important;
  }

  > *:last-child {
    margin-bottom: 0 !important;
  }

  h1,
  h2,
  h3,
  h4,
  h5,
  h6 {
    margin-top: 1.5em;
    margin-bottom: 1em;
    font-weight: 600;
    line-height: 1.25;
  }

  h1 {
    font-size: 2em;
    padding-bottom: 0.3em;
    border-bottom: 1px solid var(--p-surface-700);
  }

  h2 {
    font-size: 1.5em;
    padding-bottom: 0.3em;
    border-bottom: 1px solid var(--p-surface-700);
  }

  h3 {
    font-size: 1.25em;
  }

  h4 {
    font-size: 1em;
  }

  h5 {
    font-size: 0.875em;
  }

  h6 {
    font-size: 0.85em;
    color: var(--p-surface-500);
  }

  a {
    color: #1e8bc3;
    text-decoration: none;
    word-break: break-all;
  }

  a:hover {
    text-decoration: underline;
  }

  p,
  blockquote,
  ul,
  ol,
  dl,
  table,
  pre,
  details {
    margin-top: 0;
    margin-bottom: 1em;
  }

  p img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  ul,
  ol {
    padding-left: 2em;
  }

  li {
    margin: 0.5em 0;
  }

  blockquote {
    padding: 0px 1em;
    border-left: 0.25em solid var(--p-surface-500);
    color: var(--p-surface-500);
    margin: 1em 0;
  }

  blockquote > *:first-child {
    margin-top: 0;
  }

  blockquote > *:last-child {
    margin-bottom: 0;
  }

  pre {
    font-size: 85%;
    border-radius: 6px;
    padding: 8px 16px;
    overflow-x: auto;
    background: var(--p-dialog-background);
    filter: invert(10%);
  }

  pre code,
  pre tt {
    display: inline;
    padding: 0;
    margin: 0;
    overflow: visible;
    line-height: inherit;
    word-wrap: normal;
    background-color: transparent;
    border: 0;
  }
}
</style>
