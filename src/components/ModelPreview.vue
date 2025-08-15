<template>
  <div class="flex flex-col gap-4">
    <div>
      <div
        class="relative mx-auto w-full overflow-hidden rounded-lg preview-aspect"
        :style="$sm({ width: `${cardWidth}px` })"
      >
        <div
          v-if="
            preview &&
            isVideoUrl(
              preview,
              currentType === 'local' ? localContentType : undefined,
            )
          "
          class="h-full w-full p-1 hover:p-0"
        >
          <PreviewVideo :src="preview" />
        </div>

        <ResponseImage
          v-else
          :src="preview"
          :error="noPreviewContent"
        ></ResponseImage>

        <Carousel
          v-if="defaultContent.length > 1"
          v-show="currentType === 'default'"
          class="absolute top-0 h-full w-full"
          :value="defaultContent"
          v-model:page="defaultContentPage"
          :circular="true"
          :show-navigators="true"
          :show-indicators="false"
          pt:contentcontainer:class="h-full"
          pt:content:class="h-full"
          pt:itemlist:class="h-full"
          :prev-button-props="{
            class: 'absolute left-4 z-10',
            rounded: true,
            severity: 'secondary',
          }"
          :next-button-props="{
            class: 'absolute right-4 z-10',
            rounded: true,
            severity: 'secondary',
          }"
        >
          <template #item="slotProps">
            <div
              v-if="isVideoUrl(slotProps.data)"
              class="h-full w-full p-1 hover:p-0"
            >
              <PreviewVideo :src="slotProps.data" />
            </div>
            <ResponseImage
              v-else
              :src="slotProps.data"
              :error="noPreviewContent"
            ></ResponseImage>
          </template>
        </Carousel>
      </div>
    </div>

    <div v-if="editable" class="flex flex-col gap-4 whitespace-nowrap">
      <div class="h-10"></div>
      <div
        :class="[
          'absolute flex h-10 items-center gap-4',
          $xl('left-0 translate-x-0', 'left-1/2 -translate-x-1/2'),
        ]"
      >
        <Button
          v-for="type in typeOptions"
          :key="type"
          :severity="currentType === type ? undefined : 'secondary'"
          :label="$t(type)"
          @click="currentType = type"
        ></Button>
      </div>

      <div v-show="currentType === 'network'">
        <div class="absolute left-0 w-full">
          <ResponseInput
            v-model="networkContent"
            prefix-icon="pi pi-globe"
            :allow-clear="true"
          ></ResponseInput>
        </div>
        <div class="h-10"></div>
      </div>

      <div v-show="currentType === 'local'">
        <ResponseFileUpload
          class="absolute left-0 h-24 w-full"
          @select="updateLocalContent"
        >
        </ResponseFileUpload>
        <div class="h-24"></div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import PreviewVideo from 'components/PreviewVideo.vue'
import ResponseFileUpload from 'components/ResponseFileUpload.vue'
import ResponseImage from 'components/ResponseImage.vue'
import ResponseInput from 'components/ResponseInput.vue'
import { useConfig } from 'hooks/config'
import { useContainerQueries } from 'hooks/container'
import { useModelPreview } from 'hooks/model'
import Button from 'primevue/button'
import Carousel from 'primevue/carousel'
import { isVideoUrl } from 'utils/media'

const editable = defineModel<boolean>('editable')
const { cardWidth } = useConfig()

const {
  preview,
  typeOptions,
  currentType,
  defaultContent,
  defaultContentPage,
  networkContent,
  updateLocalContent,
  noPreviewContent,
  localContentType,
} = useModelPreview()

const { $sm, $xl } = useContainerQueries()
</script>
