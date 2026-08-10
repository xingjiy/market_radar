<script setup lang="ts">
import { computed } from 'vue'
import * as echarts from 'echarts'
import ChartPanel from './ChartPanel.vue'
import SectionHeader from './SectionHeader.vue'
import { useMarketStore } from '../stores/market'

const market = useMarketStore()

const radarOption = computed<echarts.EChartsOption>(() => ({
  tooltip: { trigger: 'item' },
  radar: {
    center: ['50%', '53%'],
    radius: '66%',
    splitNumber: 4,
    axisName: { color: '#67758d', fontSize: 11 },
    splitArea: { areaStyle: { color: ['rgba(22,119,255,.03)', 'rgba(22,119,255,.07)'] } },
    axisLine: { lineStyle: { color: '#dce5f1' } },
    splitLine: { lineStyle: { color: '#dce5f1' } },
    indicator: market.sentimentRadarData.map((item) => ({ name: item.name, max: 100 }))
  },
  series: [{
    type: 'radar',
    data: [{
      value: market.sentimentRadarData.map((item) => item.value),
      name: '市场情绪',
      areaStyle: { color: 'rgba(22,119,255,.18)' },
      lineStyle: { color: '#1677ff', width: 2 },
      itemStyle: { color: '#1677ff' }
    }]
  }]
}))
</script>

<template>
  <article class="panel-card">
    <SectionHeader eyebrow="SENTIMENT RADAR · 04" title="市场情绪雷达" caption="多因子交叉验证" />
    <ChartPanel :option="radarOption" :height="280" />
    <div class="legend-row">
      <span><i class="legend-dot blue" />偏强因子</span>
      <span><i class="legend-dot pale" />待确认因子</span>
      <b>信号置信度 {{ market.emotion.confidence }}%</b>
    </div>
  </article>
</template>
