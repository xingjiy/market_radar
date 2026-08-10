<script setup lang="ts">
import { computed, nextTick } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Bell, Calendar, TrendCharts } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import { useMarketStore } from './stores/market'

interface NavItem {
  name: string
  section?: string
}

const router = useRouter()
const route = useRoute()
const market = useMarketStore()

const navItems: NavItem[] = [
  { name: '市场全景' },
  { name: '热点板块', section: 'sectors' },
  { name: '核心观察', section: 'watch' },
  { name: 'ETF 雷达', section: 'etf' },
  { name: 'AI 简报', section: 'brief' }
]

const dateLabel = computed(() => new Date().toLocaleDateString('en-GB'))
const phaseText = computed(() => (market.autoRefreshOn ? '交易中' : '已收盘'))

const dataSourceLabel = computed(() => {
  if (market.dataSource === 'tencent') return '腾讯财经'
  if (market.dataSource === 'eastmoney') return '东方财富'
  return 'Mock'
})
const dataSourceDesc = computed(() =>
  market.dataSource === 'mock' ? 'Mock 数据演示' : dataSourceLabel.value + '实时行情')

function isActive(item: NavItem): boolean {
  if (route.path !== '/') return false
  return !item.section
}

async function openNav(item: NavItem): Promise<void> {
  if (!item.section) {
    if (route.path !== '/') await router.push('/')
    return
  }
  if (route.path !== '/') await router.push('/')
  await nextTick()
  const el = document.getElementById(item.section)
  if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
}
</script>

<template>
  <div class="app-shell">
    <header class="topbar">
      <div class="brand" aria-label="Radar OS">
        <div class="brand-mark"><TrendCharts /></div>
        <div><strong>短线雷达</strong><span>RADAR OS · FINAL</span></div>
      </div>
      <nav class="main-nav" aria-label="主导航">
        <button v-for="item in navItems" :key="item.name" :class="['nav-item', { active: isActive(item) }]" @click="openNav(item)">{{ item.name }}</button>
      </nav>
      <div class="market-status">
        <span :class="['status-dot', { loading: market.loading }]" />
        <div><b>A 股 · {{ phaseText }}</b><small>{{ dateLabel }} {{ market.lastUpdated }} · {{ dataSourceLabel }}</small></div>
        <button class="icon-button" aria-label="通知" @click="ElMessage.info('提醒功能将在 V3 开放')"><Bell /></button>
      </div>
    </header>

    <router-view />

    <footer>
      <span>RADAR OS / A-SHARE MARKET INTELLIGENCE</span>
      <span><Calendar /> 数据锚点：{{ dateLabel }} · {{ dataSourceDesc }}</span>
      <span>仅供研究参考，不构成投资建议</span>
    </footer>
  </div>
</template>
