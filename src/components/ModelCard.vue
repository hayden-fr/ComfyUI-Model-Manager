<template>
  <div
    ref="container"
    class="relative h-full select-none rounded-lg hover:bg-gray-500/40"
  >
    <div data-card-main class="flex h-full w-full flex-col">
      <div data-card-preview class="flex-1 overflow-hidden">
        <div v-if="model.isFolder" class="h-full w-full">
          <svg
            class="icon"
            viewBox="0 0 1024 1024"
            version="1.1"
            xmlns="http://www.w3.org/2000/svg"
            width="100%"
            height="100%"
          >
            <path
              d="M853.333333 256H469.333333l-85.333333-85.333333H170.666667c-46.933333 0-85.333333 38.4-85.333334 85.333333v170.666667h853.333334v-85.333334c0-46.933333-38.4-85.333333-85.333334-85.333333z"
              fill="#FFA000"
            ></path>
            <path
              d="M853.333333 256H170.666667c-46.933333 0-85.333333 38.4-85.333334 85.333333v426.666667c0 46.933333 38.4 85.333333 85.333334 85.333333h682.666666c46.933333 0 85.333333-38.4 85.333334-85.333333V341.333333c0-46.933333-38.4-85.333333-85.333334-85.333333z"
              fill="#FFCA28"
            ></path>
          </svg>
        </div>
        <div
          v-else-if="model.previewType === 'video'"
          class="h-full w-full p-1 hover:p-0"
        >
          <video
            class="h-full w-full object-cover"
            playsinline
            autoplay
            loop
            disablepictureinpicture
            preload="none"
          >
            <source :src="preview" />
          </video>
        </div>
        <div v-else class="h-full w-full p-1 hover:p-0">
          <img class="h-full w-full rounded-lg object-cover" :src="preview" />
        </div>
      </div>

      <slot name="name">
        <div class="flex justify-center overflow-hidden px-1">
          <span class="overflow-hidden text-ellipsis whitespace-nowrap">
            {{ model.basename }}
          </span>
        </div>
      </slot>
    </div>

    <div
      v-if="!model.isFolder"
      data-draggable-overlay
      class="absolute left-0 top-0 h-full w-full"
      draggable="true"
      @dragend.stop="dragToAddModelNode(model, $event)"
    ></div>

    <div
      v-if="!model.isFolder"
      data-mode-type
      class="pointer-events-none absolute left-2 top-2"
      :style="{
        transform: `scale(${typeLabelScale})`,
        transformOrigin: 'left top',
      }"
    >
      <div class="rounded-full bg-black/50 px-3 py-1">
        <span>{{ model.type }}</span>
      </div>
    </div>

    <slot name="extra"></slot>
  </div>
</template>

<script setup lang="ts">
import { useElementSize } from '@vueuse/core'
import { useModelNodeAction } from 'hooks/model'
import { BaseModel } from 'types/typings'
import { computed, ref } from 'vue'

interface Props {
  model: BaseModel
}

const props = defineProps<Props>()

const preview = computed(() =>
  Array.isArray(props.model.preview)
    ? props.model.preview[0]
    : props.model.preview,
)

const container = ref<HTMLElement | null>(null)

const { width } = useElementSize(container)

const typeLabelScale = computed(() => {
  return width.value / 200
})

const { dragToAddModelNode } = useModelNodeAction()
</script>
