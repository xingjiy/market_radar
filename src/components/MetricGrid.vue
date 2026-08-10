<script setup lang="ts">
import { computed, ref } from 'vue'
import { ArrowDown, ArrowUp, Bell, CircleCheckFilled, Coin, DataAnalysis, Lightning, TrendCharts, View } from '@element-plus/icons-vue'
import type { MetricKey } from '../data/mock'
import { useMarketStore } from '../stores/market'
import MetricDetailPanel from './MetricDetailPanel.vue'

const market = useMarketStore()

const iconMap: Record<string, unknown> = {
  TrendCharts,
  Lightning,
  DataLine: DataAnalysis,
  Warning: Bell,
  Aim: View,
  Coin
}

function iconFor(name: string): unknown {
  return iconMap[name] ?? CircleCheckFilled
}

const activeKey = ref<MetricKey | null>(null)
const activeDetail = computed(() => (activeKey.value ? market.metricDetails[activeKey.value] : null))

function toggle(key: MetricKey): void {
  activeKey.value = activeKey.value === key ? null : key
}
</script>

<template>
  <section>
    <div class="metric-grid">
      <article
        v-for="metric in market.metricCards"
        :key="metric.key"
        class="metric-card"
        :class="{ active: activeKey === metric.key }"
        role="button"
        tabindex="0"
        :aria-expanded="activeKey === metric.key"
        @click="toggle(metric.key)"
        @keydown.enter="toggle(metric.key)"
        @keydown.space.prevent="toggle(metric.key)"
      >
        <div class="metric-icon"><component :is="iconFor(metric.icon)" /></div>
        <div class="metric-content">
          <span>{{ metric.label }}</span>
          <strong>{{ metric.value }}</strong>
          <em :class="metric.tone">{{ metric.delta }}</em>
        </div>
        <span class="metric-expand" :class="{ open: activeKey === metric.key }">
          <component :is="activeKey === metric.key ? ArrowUp : ArrowDown" />
        </span>
      </article>
    </div>

    <Transition name="metric-fade" mode="out-in">
      <MetricDetailPanel v-if="activeDetail" :detail="activeDetail" @close="activeKey = null" />
    </Transition>
  </section>
</template>