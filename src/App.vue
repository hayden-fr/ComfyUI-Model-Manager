<template>
  <DialogManager></DialogManager>
  <DialogDownload></DialogDownload>
  <GlobalToast></GlobalToast>
  <ConfirmDialog></ConfirmDialog>
  <GlobalLoading></GlobalLoading>
</template>

<script setup lang="ts">
import GlobalToast from 'components/GlobalToast.vue'
import DialogManager from 'components/DialogManager.vue'
import DialogDownload from 'components/DialogDownload.vue'
import GlobalLoading from 'components/GlobalLoading.vue'
import ConfirmDialog from 'primevue/confirmdialog'
import { $el, app, ComfyButton } from 'scripts/comfyAPI'
import { onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useStoreProvider } from 'hooks/store'

const { t } = useI18n()
const { dialogManager } = useStoreProvider()

onMounted(() => {
  app.ui?.menuContainer?.appendChild(
    $el('button', {
      id: 'comfyui-model-manager-button',
      textContent: t('modelManager'),
      onclick: () => dialogManager.toggle(),
    }),
  )

  app.menu?.settingsGroup.append(
    new ComfyButton({
      icon: 'folder-search',
      tooltip: t('openModelManager'),
      content: t('modelManager'),
      action: () => dialogManager.toggle(),
    }),
  )
})
</script>
