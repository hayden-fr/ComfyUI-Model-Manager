<template>
  <ResponseDialog
    v-for="(item, index) in stack"
    v-model:visible="item.visible"
    :key="item.key"
    :keep-alive="item.keepAlive"
    :default-size="item.defaultSize"
    :default-mobile-size="item.defaultMobileSize"
    :resize-allow="item.resizeAllow"
    :min-width="item.minWidth"
    :max-width="item.maxWidth"
    :min-height="item.minHeight"
    :max-height="item.maxHeight"
    :auto-z-index="false"
    :pt:mask:style="{ zIndex: baseZIndex - 100 + index + 1 }"
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
</template>

<script setup lang="ts">
import ResponseDialog from 'components/ResponseDialog.vue'
import { useDialog } from 'hooks/dialog'
import Button from 'primevue/button'
import { usePrimeVue } from 'primevue/config'
import { computed } from 'vue'

const { stack, rise, close } = useDialog()

const { config } = usePrimeVue()

const baseZIndex = computed(() => {
  return config.zIndex?.modal ?? 1100
})
</script>
