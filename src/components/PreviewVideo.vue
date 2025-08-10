<template>
  <video
    class="h-full w-full object-cover"
    playsinline
    autoplay
    loop
    muted
    disablepictureinpicture
    :preload="preload"
  >
    <source :src="src" type="video/mp4" />
    <source :src="src" type="video/webm" />
  </video>
</template>

<script setup lang="ts">
interface Props {
  src: string
  preload?: 'none' | 'metadata' | 'auto'
}

withDefaults(defineProps<Props>(), {
  preload: 'metadata',
})
</script>
