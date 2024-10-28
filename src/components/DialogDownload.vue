<template>
  <Dialog
    v-model:visible="visible"
    :modal="true"
    pt:mask:style="--p-mask-background: rgba(0, 0, 0, 0.3)"
    pt:root:class="max-h-full"
    pt:content:class="px-0"
  >
    <template #header>
      <div class="flex flex-1 items-center justify-between pr-2">
        <span class="p-dialog-title select-none">
          {{ $t('downloadList') }}
        </span>
        <div class="p-dialog-header-actions">
          <Button
            icon="pi pi-refresh"
            severity="secondary"
            text
            rounded
            @click="refresh"
          ></Button>
        </div>
      </div>
    </template>

    <div class="flex h-full flex-col gap-4">
      <div class="whitespace-nowrap px-4 @container">
        <div class="flex gap-4 @sm:justify-end">
          <Button
            class="w-full @sm:w-auto"
            :label="$t('createDownloadTask')"
            @click="toggleCreateTask"
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
        <!-- <ul class="m-0 flex list-none flex-col gap-4 p-0 px-4 pb-0">
          <li
            v-for="item in data"
            :key="item.taskId"
            class="flex flex-row gap-3 overflow-hidden rounded-lg border border-gray-500 p-4"
          >
            <div class="h-18 preview-aspect">
              <img
                :src="`/model-manager/preview/download/${item.preview}`"
                alt=""
              />
            </div>
            <div class="flex flex-1 flex-col gap-3">
              <div class="flex items-center justify-between gap-4">
                <div class="overflow-hidden text-ellipsis whitespace-nowrap">
                  {{ item.fullname }}
                </div>
                <div class="flex items-center gap-4">
                  <i v-show="item.status === 'waiting'">
                    {{ $t('waiting') }}...
                  </i>
                  <i
                    v-show="item.status === 'doing'"
                    class="pi pi-pause-circle"
                    @click="item.pauseTask"
                  ></i>
                  <i
                    v-show="item.status === 'pause'"
                    class="pi pi-play-circle"
                    @click="item.resumeTask"
                  ></i>
                  <i
                    class="pi pi-trash text-red-400"
                    @click="item.deleteTask"
                  ></i>
                </div>
              </div>
              <div class="flex items-center gap-2">
                <div class="h-2 flex-1 overflow-hidden rounded bg-gray-200">
                  <div class="h-full *:h-full *:bg-blue-500 *:transition-all">
                    <div :style="{ width: `${item.progress}%` }"></div>
                  </div>
                </div>
              </div>
              <div class="flex items-center justify-between">
                <div>{{ item.downloadProgress }}</div>
                <div v-show="item.status === 'doing'">
                  {{ item.downloadSpeed }}
                </div>
              </div>
            </div>
          </li>
        </ul> -->
      </ResponseScroll>
    </div>

    <DialogResizer :min-width="390" :min-height="390"></DialogResizer>
  </Dialog>

  <DialogCreateTask v-model:visible="openCreateTask"></DialogCreateTask>
</template>

<script setup lang="ts">
import DialogCreateTask from 'components/DialogCreateTask.vue'
import DialogResizer from 'components/DialogResizer.vue'
import ResponseScroll from 'components/ResponseScroll.vue'
import Button from 'primevue/button'
import Dialog from 'primevue/dialog'
import { useDownload } from 'hooks/download'
import { useBoolean } from 'hooks/utils'

const { visible, data, refresh } = useDownload()

const [openCreateTask, toggleCreateTask] = useBoolean()
</script>
