<script setup lang="ts">
import { Bell, CircleCheckFilled, DataAnalysis, Lightning, TrendCharts, View } from '@element-plus/icons-vue'
import { useMarketStore } from '../stores/market'

const market = useMarketStore()

const iconMap: Record<string, unknown> = {
  TrendCharts,
  Lightning,
  DataLine: DataAnalysis,
  Warning: Bell,
  Aim: View
}

function iconFor(name: string): unknown {
  return iconMap[name] ?? CircleCheckFilled
}
</script>

<template>
  <section class="metric-grid">
    <article v-for="metric in market.metricCards" :key="metric.label" class="metric-card">
      <div class="metric-icon"><component :is="iconFor(metric.icon)" /></div>
      <div class="metric-content">
        <span>{{ metric.label }}</span>
        <strong>{{ metric.value }}</strong>
        <em :class="metric.tone">{{ metric.delta }}</em>
      </div>
    </article>
  </section>
</template>
