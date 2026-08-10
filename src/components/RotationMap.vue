<script setup lang="ts">
import { computed } from 'vue'
import * as echarts from 'echarts'
import ChartPanel from './ChartPanel.vue'
import SectionHeader from './SectionHeader.vue'
import { useMarketStore } from '../stores/market'

const market = useMarketStore()

const rotationOption = computed<echarts.EChartsOption>(() => ({
  tooltip: { formatter: (params: any) => `${params.name}<br/>热度权重：${params.value}<br/>涨跌：${params.data.change > 0 ? '+' : ''}${params.data.change}%` },
  series: [{
    type: 'treemap',
    roam: false,
    nodeClick: false,
    breadcrumb: { show: false },
    label: { show: true, formatter: '{b}', color: '#1b273b', fontSize: 13, fontWeight: 600 },
    upperLabel: { show: false },
    itemStyle: { borderColor: '#fff', borderWidth: 3, gapWidth: 3 },
    data: market.rotationItems.map((item) => ({
      ...item,
      itemStyle: {
        color: item.change >= 0
          ? `rgba(22,119,255,${Math.min(.22 + item.change / 24, .52)})`
          : `rgba(255,106,106,${Math.min(.18 + Math.abs(item.change) / 8, .35)})`
      }
    }))
  }]
}))
</script>

<template>
  <article class="panel-card">
    <SectionHeader eyebrow="ROTATION MAP · 05" title="板块轮动地图" caption="面积 = 资金规模 · 颜色 = 涨跌" />
    <ChartPanel :option="rotationOption" :height="300" />
  </article>
</template>
