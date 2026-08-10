<script setup lang="ts">
import { computed } from 'vue'
import { CircleCheckFilled } from '@element-plus/icons-vue'
import { useMarketStore } from '../stores/market'

const market = useMarketStore()

const gaugeDeg = computed(() => `${market.emotion.score * 3.6}deg`)
const dataSourceLabel = computed(() => {
  if (market.dataSource === 'tencent') return '腾讯财经'
  if (market.dataSource === 'eastmoney') return '东方财富'
  return 'Mock'
})

const upRatio = computed(() => {
  const { up, down } = market.currentBreadth
  const total = up + down
  return total > 0 ? (up / total) * 100 : 50
})
</script>

<template>
  <section class="hero-panel surface-grid">
    <div class="hero-copy">
      <div class="eyebrow">LIVE MARKET MAP · 01</div>
      <p class="hero-kicker">市场全景</p>
      <h1>市场脉冲</h1>
      <p class="hero-status">{{ market.emotion.label }}</p>
      <p class="hero-note">{{ market.emotion.note }}</p>
      <div class="tag-row"><button v-for="tag in market.emotion.tags" :key="tag" class="topic-tag">↗ {{ tag }}</button></div>
      <div class="hero-meta"><span><CircleCheckFilled /> 开市情绪</span><span><CircleCheckFilled /> 数据源：{{ dataSourceLabel }}</span><span><CircleCheckFilled /> 置信度 {{ market.emotion.confidence }}%</span></div>
    </div>
    <div class="pulse-gauge">
      <div class="eyebrow">MARKET PULSE</div>
      <div class="gauge-wrap">
        <div class="gauge-ring" :style="{ '--progress': `${gaugeDeg}deg` }">
          <div class="gauge-core"><strong>{{ market.emotion.score }}</strong><span>{{ market.emotion.label }}</span></div>
        </div>
      </div>
      <div class="breadth-labels">
        <div><small>上涨数量</small><b class="up-text">{{ market.currentBreadth.up }}</b></div>
        <div><small>下跌数量</small><b class="down-text">{{ market.currentBreadth.down }}</b></div>
      </div>
      <div class="breadth-bar"><i :style="{ width: `${upRatio}%` }" /><i class="down-fill" :style="{ width: `${100 - upRatio}%` }" /></div>
    </div>
  </section>
</template>
