<template>
  <form @submit="handleSubmit" @reset="handleReset">
    <slot name="default"></slot>
  </form>
</template>

<script setup lang="ts">
const emits = defineEmits(['submit', 'reset'])

const handleReset = () => {
  emits('reset')
}

const handleSubmit = async () => {
  emits('submit')
}
</script>
