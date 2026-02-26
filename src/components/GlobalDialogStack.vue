<template>
  <ResponseDialog
    v-for="(item, index) in stack"
    :key="item.key"
    v-model:visible="item.visible"
    v-bind="omitProps(item)"
    :auto-z-index="false"
    :pt:mask:style="{ zIndex: baseZIndex + index + 1 }"
    :pt:root:onMousedown="() => rise(item)"
    @hide="() => close(item)"
  >
    <template #header>
      <div class="flex flex-1 items-center justify-between pr-2">
        <span class="p-dialog-title select-none">{{ item.title }}</span>
        <div class="p-dialog-header-actions">
          <Button
            v-for="action in item.headerButtons"
            :key="action.key"
            v-tooltip.top="action.tooltip"
            severity="secondary"
            :text="true"
            :rounded="true"
            :icon="action.icon"
            @click.stop="action.command"
          ></Button>
        </div>
      </div>
    </template>

    <template #default>
      <component :is="item.content" v-bind="item.contentProps"></component>
    </template>
  </ResponseDialog>
  <Dialog :visible="true" :pt:mask:style="{ display: 'none' }"></Dialog>
</template>

<script setup lang="ts">
import ResponseDialog from 'components/ResponseDialog.vue'
import { type DialogItem, useDialog } from 'hooks/dialog'
import { omit } from 'lodash'
import Button from 'primevue/button'
import { usePrimeVue } from 'primevue/config'
import Dialog from 'primevue/dialog'
import { computed } from 'vue'

const { stack, rise, close } = useDialog()

const { config } = usePrimeVue()

const baseZIndex = computed(() => {
  return config.zIndex?.modal ?? 1100
})

const omitProps = (item: DialogItem) => {
  return omit(item, [
    'key',
    'visible',
    'title',
    'headerButtons',
    'content',
    'contentProps',
  ])
}
</script>
