<template>
  <GlobalToast></GlobalToast>
  <GlobalConfirm></GlobalConfirm>
  <GlobalLoading></GlobalLoading>
  <GlobalDialogStack></GlobalDialogStack>
</template>

<script setup lang="ts">
import DialogDownload from 'components/DialogDownload.vue'
import DialogExplorer from 'components/DialogExplorer.vue'
import DialogManager from 'components/DialogManager.vue'
import DialogScanning from 'components/DialogScanning.vue'
import DialogUpload from 'components/DialogUpload.vue'
import GlobalDialogStack from 'components/GlobalDialogStack.vue'
import GlobalLoading from 'components/GlobalLoading.vue'
import GlobalToast from 'components/GlobalToast.vue'
import { useStoreProvider } from 'hooks/store'
import { useToast } from 'hooks/toast'
import GlobalConfirm from 'primevue/confirmdialog'
import { $el, app, ComfyButton } from 'scripts/comfyAPI'
import { onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()
const { dialog, models, config, download } = useStoreProvider()
const { toast } = useToast()

const firstOpenManager = ref(true)

onMounted(() => {
  const refreshModelsAndConfig = async () => {
    await Promise.all([models.refresh(true)])
    toast.add({
      severity: 'success',
      summary: 'Refreshed Models',
      life: 2000,
    })
  }

  const openModelScanning = () => {
    dialog.open({
      key: 'model-information-scanning',
      title: t('batchScanModelInformation'),
      content: DialogScanning,
      modal: true,
      defaultSize: {
        width: 680,
        height: 490,
      },
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

  const openUploadDialog = () => {
    dialog.open({
      key: 'model-manager-upload',
      title: t('uploadModel'),
      content: DialogUpload,
      headerButtons: [
        {
          key: 'refresh',
          icon: 'pi pi-refresh',
          command: refreshModelsAndConfig,
        },
      ],
    })
  }

  const toggleLayout = () => {
    // flip the flat setting
    const newValue = !config.flat.value
    config.flat.value = newValue

    // persist so it survives reloads
    app.ui?.settings.setSettingValue('ModelManager.UI.Flat', newValue)

    // close the current dialog (because it is keepAlive)
    dialog.closeAll()

    // reopen with the new layout
    openManagerDialog()
  }

  const openManagerDialog = () => {
    const { cardWidth, gutter, aspect, flat } = config
    // choose icon depending on current layout
    const layoutIcon = flat.value ? 'pi pi-folder-open' : 'pi pi-th-large'

    if (firstOpenManager.value) {
      models.refresh(true)
      firstOpenManager.value = false
    }

    dialog.open({
      key: 'model-manager',
      title: t('modelManager'),
      content: flat.value ? DialogManager : DialogExplorer,
      keepAlive: true,
      headerButtons: [
        {
          key: 'scanning',
          icon: 'mdi mdi-folder-search-outline text-lg',
          command: openModelScanning,
        },
        {
          key: 'toggle-layout',
          icon: layoutIcon,
          command: toggleLayout,
          tooltip: flat.value
            ? t('switchToFolderView')
            : t('switchToFlatView'),
        },
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
        {
          key: 'upload',
          icon: 'pi pi-upload',
          command: openUploadDialog,
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
