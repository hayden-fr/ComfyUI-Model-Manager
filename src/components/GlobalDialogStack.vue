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
    :z-index="index"
    :pt:root:onMousedown="() => rise(item)"
    @hide="() => close(item)"
  >
    <template #header>
      <div class="flex flex-1 items-center justify-between pr-2">
        <span class="p-dialog-title select-none">{{ item.title }}</span>
        <div class="p-dialog-header-actions">
          <Button
            v-for="action in item.headerButtons"
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
import Button from 'primevue/button'
import ResponseDialog from 'components/ResponseDialog.vue'
import { useDialog } from 'hooks/dialog'

const { stack, rise, close } = useDialog()
</script>
