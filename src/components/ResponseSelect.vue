<template>
  <slot
    v-if="type === 'drop'"
    name="target"
    v-bind="{ toggle, prefixIcon, suffixIcon, currentLabel, current }"
  >
    <div :class="['-my-1 py-1', $attrs.class]" @click="toggle">
      <Button
        v-bind="{ rounded, text, severity, size }"
        class="w-full whitespace-nowrap"
      >
        <slot name="prefix">
          <span v-if="prefixIcon" class="p-button-icon p-button-icon-left">
            <i :class="prefixIcon"></i>
          </span>
        </slot>
        <span class="flex-1 overflow-scroll text-right scrollbar-none">
          <slot name="label">{{ currentLabel }}</slot>
        </span>
        <slot name="suffix">
          <span v-if="suffixIcon" class="p-button-icon p-button-icon-right">
            <i :class="suffixIcon"></i>
          </span>
        </slot>
      </Button>
    </div>
  </slot>

  <div v-else class="relative flex-1 overflow-hidden">
    <div
      ref="scrollArea"
      class="h-full w-full overflow-auto scrollbar-none"
      v-resize="checkScrollPosition"
      @scroll="checkScrollPosition"
    >
      <div ref="contentArea" class="table max-w-full">
        <div
          v-show="showControlButton && scrollPosition !== 'left'"
          :class="[
            'pointer-events-none absolute left-0 top-1/2 z-10',
            '-translate-y-1/2 bg-gradient-to-r from-current to-transparent pr-16',
          ]"
          style="color: var(--p-dialog-background)"
        >
          <Button
            icon="pi pi-angle-left"
            class="pointer-events-auto border-none bg-transparent"
            severity="secondary"
            @click="scrollTo('prev')"
            :size="size"
          ></Button>
        </div>
        <div class="flex h-10 items-center gap-2">
          <Button
            v-for="item in items"
            severity="secondary"
            :key="item.value"
            :data-active="current === item.value"
            :active="current === item.value"
            class="data-[active=true]:bg-blue-500 data-[active=true]:text-white"
            :size="size"
            @click="item.command"
          >
            <span class="whitespace-nowrap">{{ item.label }}</span>
          </Button>
        </div>
        <div
          v-show="showControlButton && scrollPosition !== 'right'"
          :class="[
            'pointer-events-none absolute right-0 top-1/2 z-10',
            '-translate-y-1/2 bg-gradient-to-l from-current to-transparent pl-16',
          ]"
          style="color: var(--p-dialog-background)"
        >
          <Button
            :size="size"
            icon="pi pi-angle-right"
            class="pointer-events-auto border-none bg-transparent"
            severity="secondary"
            @click="scrollTo('next')"
          ></Button>
        </div>
      </div>
    </div>
  </div>

  <slot v-if="isMobile" name="mobile">
    <Drawer
      v-model:visible="visible"
      position="bottom"
      style="height: auto; max-height: 80%"
    >
      <template #container>
        <slot name="container">
          <slot name="mobile:container">
            <div class="h-full overflow-scroll scrollbar-none">
              <Menu
                :model="items"
                pt:root:class="border-0 px-4 py-5"
                :pt:list:onClick="toggle"
              >
                <template #item="{ item }">
                  <slot name="item" :item="item">
                    <slot name="mobile:container:item" :item="item">
                      <a class="p-menu-item-link justify-between">
                        <span
                          class="p-menu-item-label overflow-hidden break-words"
                        >
                          {{ item.label }}
                        </span>
                        <span v-show="current === item.value">
                          <i class="pi pi-check text-blue-400"></i>
                        </span>
                      </a>
                    </slot>
                  </slot>
                </template>
              </Menu>
            </div>
          </slot>
        </slot>
      </template>
    </Drawer>
  </slot>

  <slot v-else name="desktop">
    <slot name="container">
      <slot name="desktop:container">
        <Menu ref="menu" :model="items" :popup="true">
          <template #item="{ item }">
            <slot name="item" :item="item">
              <slot name="desktop:container:item" :item="item">
                <a class="p-menu-item-link justify-between">
                  <span class="p-menu-item-label">{{ item.label }}</span>
                  <span v-show="current === item.value">
                    <i class="pi pi-check text-blue-400"></i>
                  </span>
                </a>
              </slot>
            </slot>
          </template>
        </Menu>
      </slot>
    </slot>
  </slot>
</template>

<script setup lang="ts">
import { useConfig } from 'hooks/config'
import Button, { ButtonProps } from 'primevue/button'
import Drawer from 'primevue/drawer'
import Menu from 'primevue/menu'
import { computed, ref } from 'vue'

const current = defineModel()

interface Props {
  items?: SelectOptions[]
  rounded?: boolean
  text?: boolean
  severity?: ButtonProps['severity']
  size?: ButtonProps['size']
  type?: 'button' | 'drop'
}

const props = withDefaults(defineProps<Props>(), {
  severity: 'secondary',
  type: 'drop',
})

const suffixIcon = ref('pi pi-angle-down')
const prefixIcon = computed(() => {
  return props.items?.find((item) => item.value === current.value)?.icon
})

const currentLabel = computed(() => {
  return props.items?.find((item) => item.value === current.value)?.label
})

const menu = ref()
const visible = ref(false)

const { isMobile } = useConfig()

const toggle = (event: MouseEvent) => {
  if (isMobile.value) {
    visible.value = !visible.value
  } else {
    menu.value.toggle(event)
  }
}

// Select Button Type
const scrollArea = ref()
const contentArea = ref()

type ScrollPosition = 'left' | 'right'

const scrollPosition = ref<ScrollPosition | undefined>('left')
const showControlButton = ref<boolean>(true)

const scrollTo = (type: 'prev' | 'next') => {
  const container = scrollArea.value as HTMLDivElement
  const scrollLeft = container.scrollLeft
  const direction = type === 'prev' ? -1 : 1
  const distance = (container.clientWidth / 3) * 2
  container.scrollTo({
    left: scrollLeft + direction * distance,
    behavior: 'smooth',
  })
}

const checkScrollPosition = () => {
  const container = scrollArea.value as HTMLDivElement
  const content = contentArea.value as HTMLDivElement

  const scrollLeft = container.scrollLeft

  const containerWidth = container.clientWidth
  const contentWidth = content.clientWidth

  let position: ScrollPosition | undefined = undefined

  if (scrollLeft === 0) {
    position = 'left'
  }
  if (Math.ceil(scrollLeft) >= contentWidth - containerWidth) {
    position = 'right'
  }

  scrollPosition.value = position
  showControlButton.value = contentWidth > containerWidth
}
</script>
