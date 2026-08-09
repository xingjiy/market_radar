<script setup lang="ts">
defineProps<{ eyebrow?: string; title: string; caption?: string }>()
</script>

<template>
  <div class="section-header">
    <div>
      <div v-if="eyebrow" class="eyebrow">{{ eyebrow }}</div>
      <h2>{{ title }}</h2>
    </div>
    <span v-if="caption" class="section-caption">{{ caption }}</span>
    <slot />
  </div>
</template>
