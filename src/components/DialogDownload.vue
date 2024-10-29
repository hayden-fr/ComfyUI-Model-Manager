<template>
  <div class="flex h-full flex-col gap-4">
    <div class="whitespace-nowrap px-4 @container">
      <div class="flex gap-4 @sm:justify-end">
        <Button
          class="w-full @sm:w-auto"
          :label="$t('createDownloadTask')"
          @click="openCreateTask"
        ></Button>
      </div>
    </div>

    <ResponseScroll>
      <div class="w-full px-4">
        <ul class="m-0 flex list-none flex-col gap-4 p-0">
          <li
            v-for="item in data"
            :key="item.taskId"
            class="rounded-lg border border-gray-500 p-4"
          >
            <div class="flex gap-4 overflow-hidden whitespace-nowrap">
              <div class="h-18 preview-aspect">
                <img :src="item.preview" />
              </div>

              <div class="flex flex-1 flex-col gap-3 overflow-hidden">
                <div class="flex items-center gap-3 overflow-hidden">
                  <span class="flex-1 overflow-hidden text-ellipsis">
                    {{ item.fullname }}
                  </span>
                  <span v-show="item.status === 'waiting'" class="h-4">
                    <i class="pi pi-spinner pi-spin"></i>
                  </span>
                  <span
                    v-show="item.status === 'doing'"
                    class="h-4 cursor-pointer"
                    @click="item.pauseTask"
                  >
                    <i class="pi pi-pause-circle"></i>
                  </span>
                  <span
                    v-show="item.status === 'pause'"
                    class="h-4 cursor-pointer"
                    @click="item.resumeTask"
                  >
                    <i class="pi pi-play-circle"></i>
                  </span>
                  <span class="h-4 cursor-pointer" @click="item.deleteTask">
                    <i class="pi pi-trash text-red-400"></i>
                  </span>
                </div>
                <div class="h-2 overflow-hidden rounded bg-gray-200">
                  <div
                    class="h-full bg-blue-500 transition-[width]"
                    :style="{ width: `${item.progress}%` }"
                  ></div>
                </div>
                <div class="flex justify-between">
                  <div>{{ item.downloadProgress }}</div>
                  <div v-show="item.status === 'doing'">
                    {{ item.downloadSpeed }}
                  </div>
                </div>
              </div>
            </div>
          </li>
        </ul>
      </div>
    </ResponseScroll>
  </div>
</template>

<script setup lang="ts">
import DialogCreateTask from 'components/DialogCreateTask.vue'
import ResponseScroll from 'components/ResponseScroll.vue'
import Button from 'primevue/button'
import { useDownload } from 'hooks/download'
import { useDialog } from 'hooks/dialog'
import { useI18n } from 'vue-i18n'

const { data } = useDownload()

const { t } = useI18n()
const dialog = useDialog()

const openCreateTask = () => {
  dialog.open({
    key: 'model-manager-create-task',
    title: t('parseModelUrl'),
    content: DialogCreateTask,
  })
}
</script>
