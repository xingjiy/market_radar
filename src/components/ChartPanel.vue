<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import * as echarts from 'echarts'

const props = defineProps<{ option: echarts.EChartsOption; height?: number }>()
const root = ref<HTMLDivElement>()
let chart: echarts.ECharts | undefined
let observer: ResizeObserver | undefined

const render = () => {
  if (!chart) return
  chart.setOption(props.option, { notMerge: true })
  chart.resize()
}

onMounted(async () => {
  await nextTick()
  if (!root.value) return
  chart = echarts.init(root.value)
  render()
  observer = new ResizeObserver(() => chart?.resize())
  observer.observe(root.value)
})
watch(() => props.option, render, { deep: true })
onBeforeUnmount(() => {
  observer?.disconnect()
  chart?.dispose()
})
</script>

<template>
  <div ref="root" class="chart-panel" :style="{ height: `${height ?? 260}px` }" role="img" aria-label="数据图表" />
</template>
