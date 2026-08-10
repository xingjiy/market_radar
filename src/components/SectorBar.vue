<script setup lang="ts">
import { computed } from 'vue'
import * as echarts from 'echarts'
import ChartPanel from './ChartPanel.vue'
import SectionHeader from './SectionHeader.vue'
import { useMarketStore } from '../stores/market'

const market = useMarketStore()

const sectorBarOption = computed<echarts.EChartsOption>(() => {
  const sectors = market.displaySectors
  // 动态比例：以最大 |涨跌幅| 为基准，条宽随数值等比缩放，避免硬编码 6% 截断
  const maxAbs = Math.max(...sectors.map((s) => Math.abs(s.change)), 1)
  const limit = Math.max(5, Math.ceil(maxAbs * 1.25))
  // 全为上涨时左锚定（0 在左侧，条向右延伸）；存在下跌板块时改为对称双向条
  const hasNeg = sectors.some((s) => s.change < 0)
  return {
    grid: { left: 40, right: 44, top: 8, bottom: 10, containLabel: true },
    xAxis: { type: 'value', show: false, min: hasNeg ? -limit : 0, max: limit },
    yAxis: { type: 'category', inverse: true, data: sectors.map((item) => item.name), axisLine: { show: false }, axisTick: { show: false }, axisLabel: { color: '#34425a', fontSize: 12 } },
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' }, formatter: (params: any) => {
      const item = sectors[params[0].dataIndex]
      return `${item.name}<br/>涨跌：${item.change > 0 ? '+' : ''}${item.change}%<br/>强度：${item.score ?? '--'} · 成交额：${item.amount} · 主力净流入：${(item.flowYi ?? 0) > 0 ? '+' : ''}${item.flowYi ?? 0}亿`
    } },
    series: [{
      type: 'bar',
      barWidth: 10,
      data: sectors.map((item) => ({
        value: item.change,
        itemStyle: {
          color: item.change >= 0 ? '#1677ff' : '#ff6b73',
          borderRadius: item.change >= 0 ? [0, 6, 6, 0] : [6, 0, 0, 6]
        },
        label: {
          show: true,
          position: item.change >= 0 ? 'right' : 'left',
          color: item.change >= 0 ? '#1677ff' : '#ff6b73',
          formatter: `${item.change > 0 ? '+' : ''}${item.change}%`,
          fontSize: 11
        }
      }))
    }]
  }
})
</script>

<template>
  <article id="sectors" class="panel-card">
    <SectionHeader eyebrow="HOT SECTORS · 05" title="热点板块排行" caption="涨幅 × 成交额 × 资金净流入" />
    <div class="sector-highlight"><span>当前聚焦</span><strong>{{ market.focusedSector }}</strong><em>资金共振</em></div>
    <ChartPanel :option="sectorBarOption" :height="246" />
  </article>
</template>
