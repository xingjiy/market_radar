<script setup lang="ts">
import { computed } from 'vue'
import * as echarts from 'echarts'
import ChartPanel from './ChartPanel.vue'
import SectionHeader from './SectionHeader.vue'
import { useMarketStore } from '../stores/market'

const market = useMarketStore()

const sectorBarOption = computed<echarts.EChartsOption>(() => ({
  grid: { left: 6, right: 22, top: 8, bottom: 10, containLabel: true },
  xAxis: { type: 'value', show: false, max: 6 },
  yAxis: { type: 'category', inverse: true, data: market.displaySectors.map((item) => item.name), axisLine: { show: false }, axisTick: { show: false }, axisLabel: { color: '#34425a', fontSize: 12 } },
  tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' }, formatter: (params: any) => {
    const item = market.displaySectors[params[0].dataIndex]
    return `${item.name}<br/>涨跌：${item.change > 0 ? '+' : ''}${item.change}%<br/>强度：${item.score ?? '--'} · 净流入：${item.amount}`
  } },
  series: [{
    type: 'bar',
    barWidth: 11,
    data: market.displaySectors.map((item) => ({
      value: item.change,
      itemStyle: { color: item.change >= 0 ? '#1677ff' : '#ff6b73', borderRadius: [0, 6, 6, 0] },
      label: { show: true, position: 'right', color: item.change >= 0 ? '#1677ff' : '#ff6b73', formatter: `${item.change > 0 ? '+' : ''}${item.change}%`, fontSize: 11 }
    }))
  }]
}))
</script>

<template>
  <article id="sectors" class="panel-card">
    <SectionHeader eyebrow="HOT SECTORS · 04" title="热点板块排行" caption="涨幅 × 成交额 × 资金净流入" />
    <div class="sector-highlight"><span>当前聚焦</span><strong>{{ market.focusedSector }}</strong><em>资金共振</em></div>
    <ChartPanel :option="sectorBarOption" :height="246" />
  </article>
</template>
