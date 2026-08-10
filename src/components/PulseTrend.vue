<script setup lang="ts">
import { computed } from 'vue'
import * as echarts from 'echarts'
import ChartPanel from './ChartPanel.vue'
import SectionHeader from './SectionHeader.vue'
import { useMarketStore, type PulseRange } from '../stores/market'

const market = useMarketStore()
const ranges: PulseRange[] = ['今日', '本周', '本月']

function setRange(range: PulseRange): void {
  market.pulseRange = range
}

const pulseOption = computed<echarts.EChartsOption>(() => ({
  tooltip: { trigger: 'axis', backgroundColor: '#17243b', borderWidth: 0, textStyle: { color: '#f7faff' }, valueFormatter: (value: unknown) => `${value} 分` },
  grid: { left: 24, right: 14, top: 26, bottom: 24, containLabel: true },
  xAxis: { type: 'category', boundaryGap: false, data: market.pulseLabels, axisLine: { lineStyle: { color: '#dce5f1' } }, axisLabel: { color: '#8794aa', fontSize: 11 } },
  yAxis: { type: 'value', min: 20, max: 80, splitNumber: 3, axisLabel: { color: '#8794aa', fontSize: 11 }, splitLine: { lineStyle: { color: '#edf1f6' } } },
  series: [{
    type: 'line',
    data: market.pulseData,
    smooth: true,
    symbol: 'circle',
    symbolSize: 7,
    lineStyle: { width: 3, color: '#1677ff' },
    itemStyle: { color: '#1677ff', borderColor: '#fff', borderWidth: 2 },
    areaStyle: { color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [{ offset: 0, color: 'rgba(22,119,255,.24)' }, { offset: 1, color: 'rgba(22,119,255,0)' }]) }
  }]
}))
</script>

<template>
  <article class="panel-card">
    <SectionHeader eyebrow="MARKET PULSE · 03" title="市场脉冲走势" caption="综合情绪指数（0–100）">
      <div class="segmented">
        <button v-for="item in ranges" :key="item" :class="{ active: market.pulseRange === item }" @click="setRange(item)">{{ item }}</button>
      </div>
    </SectionHeader>
    <div class="pulse-summary">
      <strong>{{ market.pulseCurrent }}</strong><span>当前指数</span><em class="up">+3.8 较前值</em><span class="summary-right">{{ market.pulseRange === '今日' ? '盘中高位震荡' : '观察周期切换' }}</span>
    </div>
    <ChartPanel :option="pulseOption" :height="244" />
  </article>
</template>
