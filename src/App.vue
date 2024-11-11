<template>
  <GlobalToast></GlobalToast>
  <GlobalConfirm></GlobalConfirm>
  <GlobalLoading></GlobalLoading>
  <GlobalDialogStack></GlobalDialogStack>
</template>

<script setup lang="ts">
import DialogDownload from 'components/DialogDownload.vue'
import DialogManager from 'components/DialogManager.vue'
import GlobalDialogStack from 'components/GlobalDialogStack.vue'
import GlobalLoading from 'components/GlobalLoading.vue'
import GlobalToast from 'components/GlobalToast.vue'
import { useStoreProvider } from 'hooks/store'
import { useToast } from 'hooks/toast'
import GlobalConfirm from 'primevue/confirmdialog'
import { $el, app, ComfyButton } from 'scripts/comfyAPI'
import { onMounted } from 'vue'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()
const { dialog, models, config, download } = useStoreProvider()
const { toast } = useToast()

onMounted(() => {
  const refreshModelsAndConfig = async () => {
    await Promise.all([models.refresh(), config.refresh()])
    toast.add({
      severity: 'success',
      summary: 'Refreshed Models',
      life: 2000,
    })
  }

  const openDownloadDialog = () => {
    dialog.open({
      key: 'model-manager-download-list',
      title: t('downloadList'),
      content: DialogDownload,
      headerButtons: [
        {
          key: 'refresh',
          icon: 'pi pi-refresh',
          command: () => download.refresh(),
        },
      ],
    })
  }

  const openManagerDialog = () => {
    const { cardWidth, gutter, aspect } = config

    dialog.open({
      key: 'model-manager',
      title: t('modelManager'),
      content: DialogManager,
      keepAlive: true,
      headerButtons: [
        {
          key: 'refresh',
          icon: 'pi pi-refresh',
          command: refreshModelsAndConfig,
        },
        {
          key: 'download',
          icon: 'pi pi-download',
          command: openDownloadDialog,
        },
      ],
      minWidth: cardWidth * 2 + gutter + 42,
      minHeight: (cardWidth / aspect) * 0.5 + 162,
    })
  }

  app.ui?.menuContainer?.appendChild(
    $el('button', {
      id: 'comfyui-model-manager-button',
      textContent: t('modelManager'),
      onclick: openManagerDialog,
    }),
  )

  app.menu?.settingsGroup.append(
    new ComfyButton({
      icon: 'folder-search',
      tooltip: t('openModelManager'),
      content: t('modelManager'),
      action: openManagerDialog,
    }),
  )
})
</script>
