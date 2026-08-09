<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { ArrowUp, ArrowDown, Bell, Calendar, CircleCheckFilled, DataAnalysis, Document, Expand, Fold, Lightning, Refresh, Search, Setting, Star, TrendCharts, View } from '@element-plus/icons-vue'
import * as echarts from 'echarts'
import ChartPanel from './components/ChartPanel.vue'
import SectionHeader from './components/SectionHeader.vue'
import { aiBrief, breadth, emotion, etfs, marketMetrics, pulseSeries, rotationData, sectors, sentimentRadar, timeLabels, watchlist as initialWatchlist } from './data/mock'
import { fetchMarketSnapshot, type MarketSnapshot } from './services/market'

const activeNav = ref('市场全景')
const pulseRange = ref('今日')
const searchValue = ref('')
const showBrief = ref(false)
const lastUpdated = ref('15:08:42')
const watchlist = ref(initialWatchlist.map(item => ({ ...item })))
const selectedSector = ref('半导体')
const liveSnapshot = ref<MarketSnapshot | null>(null)
const dataSource = ref<'eastmoney' | 'mock'>('mock')
const dataLoading = ref(false)

const currentBreadth = computed(() => liveSnapshot.value?.market.breadth ?? breadth)
const displaySectors = computed(() => liveSnapshot.value?.sectors?.length ? liveSnapshot.value.sectors : sectors)
const displayEtfs = computed(() => liveSnapshot.value?.etfs?.length ? liveSnapshot.value.etfs : etfs)

const filteredWatchlist = computed(() => {
  const keyword = searchValue.value.trim().toLowerCase()
  if (!keyword) return watchlist.value
  return watchlist.value.filter(item => item.name.toLowerCase().includes(keyword) || item.code.includes(keyword))
})

const pulseOption = computed<echarts.EChartsOption>(() => ({
  tooltip: { trigger: 'axis', backgroundColor: '#17243b', borderWidth: 0, textStyle: { color: '#f7faff' }, valueFormatter: (value: unknown) => `${value} 分` },
  grid: { left: 24, right: 14, top: 26, bottom: 24, containLabel: true },
  xAxis: { type: 'category', boundaryGap: false, data: timeLabels[pulseRange.value], axisLine: { lineStyle: { color: '#dce5f1' } }, axisLabel: { color: '#8794aa', fontSize: 11 } },
  yAxis: { type: 'value', min: 20, max: 80, splitNumber: 3, axisLabel: { color: '#8794aa', fontSize: 11 }, splitLine: { lineStyle: { color: '#edf1f6' } } },
  series: [{ type: 'line', data: pulseSeries[pulseRange.value], smooth: true, symbol: 'circle', symbolSize: 7, lineStyle: { width: 3, color: '#1677ff' }, itemStyle: { color: '#1677ff', borderColor: '#fff', borderWidth: 2 }, areaStyle: { color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [{ offset: 0, color: 'rgba(22,119,255,.24)' }, { offset: 1, color: 'rgba(22,119,255,0)' }]) } }]
}))

const radarOption = computed<echarts.EChartsOption>(() => ({
  tooltip: { trigger: 'item' },
  radar: { center: ['50%', '53%'], radius: '66%', splitNumber: 4, axisName: { color: '#67758d', fontSize: 11 }, splitArea: { areaStyle: { color: ['rgba(22,119,255,.03)', 'rgba(22,119,255,.07)'] } }, axisLine: { lineStyle: { color: '#dce5f1' } }, splitLine: { lineStyle: { color: '#dce5f1' } }, indicator: sentimentRadar.map(item => ({ name: item.name, max: 100 })) },
  series: [{ type: 'radar', data: [{ value: sentimentRadar.map(item => item.value), name: '市场情绪', areaStyle: { color: 'rgba(22,119,255,.18)' }, lineStyle: { color: '#1677ff', width: 2 }, itemStyle: { color: '#1677ff' } }] }]
}))

const rotationOption = computed<echarts.EChartsOption>(() => ({
  tooltip: { formatter: (params: any) => `${params.name}<br/>热度权重：${params.value}<br/>涨跌：${params.data.change > 0 ? '+' : ''}${params.data.change}%` },
  series: [{ type: 'treemap', roam: false, nodeClick: false, breadcrumb: { show: false }, label: { show: true, formatter: '{b}', color: '#1b273b', fontSize: 13, fontWeight: 600 }, upperLabel: { show: false }, itemStyle: { borderColor: '#fff', borderWidth: 3, gapWidth: 3 }, data: rotationData.map(item => ({ ...item, itemStyle: { color: item.change >= 0 ? `rgba(22,119,255,${Math.min(.22 + item.change / 24, .52)})` : `rgba(255,106,106,${Math.min(.18 + Math.abs(item.change) / 8, .35)})` } })) }]
}))

const sectorBarOption = computed<echarts.EChartsOption>(() => ({
  grid: { left: 6, right: 22, top: 8, bottom: 10, containLabel: true },
  xAxis: { type: 'value', show: false, max: 6 },
  yAxis: { type: 'category', inverse: true, data: displaySectors.value.map(item => item.name), axisLine: { show: false }, axisTick: { show: false }, axisLabel: { color: '#34425a', fontSize: 12 } },
  tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' }, formatter: (params: any) => { const item = displaySectors.value[params[0].dataIndex]; return `${item.name}<br/>涨跌：${item.change > 0 ? '+' : ''}${item.change}%<br/>净流入：${item.amount}` } },
  series: [{ type: 'bar', barWidth: 11, data: displaySectors.value.map(item => ({ value: item.change, itemStyle: { color: item.change >= 0 ? '#1677ff' : '#ff6b73', borderRadius: [0, 6, 6, 0] }, label: { show: true, position: 'right', color: item.change >= 0 ? '#1677ff' : '#ff6b73', formatter: `${item.change > 0 ? '+' : ''}${item.change}%`, fontSize: 11 } })) }]
}))

async function refreshData(showMessage = true) {
  dataLoading.value = true
  const now = new Date()
  lastUpdated.value = now.toLocaleTimeString('zh-CN', { hour12: false })
  try {
    liveSnapshot.value = await fetchMarketSnapshot()
    dataSource.value = 'eastmoney'
    if (liveSnapshot.value.sectors[0]) selectedSector.value = liveSnapshot.value.sectors[0].name
    if (showMessage) ElMessage.success('东方财富行情已刷新')
  } catch {
    dataSource.value = 'mock'
    if (showMessage) ElMessage.warning('实时行情暂不可用，已切换 Mock 数据')
  } finally {
    dataLoading.value = false
  }
}

onMounted(() => { void refreshData(false) })

function runSearch() {
  if (!searchValue.value.trim()) {
    ElMessage.info('请输入股票代码或名称')
    return
  }
  const hit = filteredWatchlist.value[0]
  ElMessage({ type: hit ? 'success' : 'warning', message: hit ? `已定位 ${hit.name}（${hit.code}）` : '观察列表中暂未找到该标的' })
}

function toggleStar(code: string) {
  const target = watchlist.value.find(item => item.code === code)
  if (target) target.starred = !target.starred
}

function openNav(name: string) {
  activeNav.value = name
  if (name !== '市场全景') ElMessage.info(`${name} 模块已在当前版本预留，正在展示全景数据`)
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
        <button v-for="item in ['市场全景', '热点板块', '核心观察', 'AI 简报']" :key="item" :class="['nav-item', { active: activeNav === item }]" @click="openNav(item)">{{ item }}</button>
      </nav>
      <div class="market-status"><span :class="['status-dot', { loading: dataLoading }]" /> <div><b>A 股 · 交易中</b><small>08/10/2026 {{ lastUpdated }} · {{ dataSource === 'eastmoney' ? '东方财富' : 'Mock' }}</small></div><button class="icon-button" aria-label="通知"><Bell /></button></div>
    </header>

    <main>
      <section class="search-row">
        <el-input v-model="searchValue" class="search-input" size="large" placeholder="输入代码或名称，例如 000021 / 深科技" @keyup.enter="runSearch">
          <template #prefix><Search /></template><template #suffix><span class="shortcut">Ctrl K</span></template>
        </el-input>
        <el-button type="primary" size="large" class="search-button" @click="runSearch">搜索</el-button>
        <el-button class="refresh-button" :loading="dataLoading" :icon="Refresh" circle aria-label="刷新数据" @click="refreshData" />
      </section>

      <section class="hero-panel surface-grid">
        <div class="hero-copy">
          <div class="eyebrow">LIVE MARKET MAP · 01</div>
          <p class="hero-kicker">市场全景</p>
          <h1>市场脉冲</h1>
          <p class="hero-status">震荡轮动 · 等待聚焦</p>
          <p class="hero-note">{{ emotion.note }}</p>
          <div class="tag-row"><button v-for="tag in emotion.tags" :key="tag" class="topic-tag" @click="selectedSector = tag">↗ {{ tag }}</button></div>
          <div class="hero-meta"><span><CircleCheckFilled /> 开市情绪</span><span><CircleCheckFilled /> 交易中</span><span><CircleCheckFilled /> 数据完整</span></div>
        </div>
        <div class="pulse-gauge">
          <div class="eyebrow">MARKET PULSE</div>
          <div class="gauge-wrap"><div class="gauge-ring" :style="{ '--progress': `${emotion.score * 3.6}deg` }"><div class="gauge-core"><strong>{{ emotion.score }}</strong><span>{{ emotion.label }}</span></div></div></div>
          <div class="breadth-labels"><div><small>上涨数量</small><b class="up-text">{{ currentBreadth.up }}</b></div><div><small>下跌数量</small><b class="down-text">{{ currentBreadth.down }}</b></div></div>
          <div class="breadth-bar"><i :style="{ width: `${currentBreadth.up / (currentBreadth.up + currentBreadth.down) * 100}%` }" /><i class="down-fill" /></div>
        </div>
      </section>

      <section class="metric-grid">
        <article v-for="metric in marketMetrics" :key="metric.label" class="metric-card">
          <div class="metric-icon"><component :is="metric.icon === 'TrendCharts' ? TrendCharts : metric.icon === 'Lightning' ? Lightning : metric.icon === 'DataLine' ? DataAnalysis : metric.icon === 'Warning' ? Bell : metric.icon === 'Aim' ? View : CircleCheckFilled" /></div>
          <div class="metric-content"><span>{{ metric.label }}</span><strong>{{ metric.value }}</strong><em :class="metric.tone">{{ metric.delta }}</em></div>
        </article>
      </section>

      <section class="two-col top-gap">
        <article class="panel-card">
          <SectionHeader eyebrow="MARKET PULSE · 02" title="市场脉冲走势" caption="综合情绪指数（0–100）">
            <div class="segmented"><button v-for="item in ['今日', '本周', '本月']" :key="item" :class="{ active: pulseRange === item }" @click="pulseRange = item">{{ item }}</button></div>
          </SectionHeader>
          <div class="pulse-summary"><strong>{{ pulseSeries[pulseRange][pulseSeries[pulseRange].length - 1] }}</strong><span>当前指数</span><em class="up">+3.8 较前值</em><span class="summary-right">{{ pulseRange === '今日' ? '盘中高位震荡' : '观察周期切换' }}</span></div>
          <ChartPanel :option="pulseOption" :height="244" />
        </article>
        <article class="panel-card">
          <SectionHeader eyebrow="SENTIMENT RADAR · 03" title="市场情绪雷达" caption="多因子交叉验证" />
          <ChartPanel :option="radarOption" :height="280" />
          <div class="legend-row"><span><i class="legend-dot blue" />偏强因子</span><span><i class="legend-dot pale" />待确认因子</span><b>信号置信度 78%</b></div>
        </article>
      </section>

      <section class="two-col top-gap">
        <article class="panel-card">
          <SectionHeader eyebrow="HOT SECTORS · 04" title="热点板块排行" caption="涨幅 × 成交额 × 资金净流入" />
          <div class="sector-highlight"><span>当前聚焦</span><strong>{{ selectedSector }}</strong><em>资金共振</em></div>
          <ChartPanel :option="sectorBarOption" :height="246" />
        </article>
        <article class="panel-card">
          <SectionHeader eyebrow="ROTATION MAP · 05" title="板块轮动地图" caption="面积 = 资金规模 · 颜色 = 涨跌" />
          <ChartPanel :option="rotationOption" :height="300" />
        </article>
      </section>

      <section class="panel-card top-gap">
        <SectionHeader eyebrow="ETF FLOW RADAR · 06" title="ETF 资金雷达" caption="价格动能、资金流向、成交活跃度交叉验证">
          <el-button text type="primary" :icon="Expand" @click="ElMessage.info('ETF 资金明细将在 V2 开放')">查看全部</el-button>
        </SectionHeader>
        <div class="table-wrap"><el-table :data="displayEtfs" class="radar-table" stripe>
          <el-table-column label="ETF 名称" min-width="190"><template #default="{ row }"><div class="name-cell"><span class="etf-icon">ETF</span><div><b>{{ row.name }}</b><small>{{ row.code }}</small></div></div></template></el-table-column>
          <el-table-column prop="price" label="最新价" width="110" />
          <el-table-column label="涨跌幅" width="120"><template #default="{ row }"><span :class="row.change >= 0 ? 'up-text' : 'down-text'">{{ row.change > 0 ? '+' : '' }}{{ row.change }}%</span></template></el-table-column>
          <el-table-column prop="amount" label="成交额" width="130" />
          <el-table-column label="资金净流入" width="150"><template #default="{ row }"><span :class="row.flow.startsWith('+') ? 'up-text' : 'down-text'">{{ row.flow }}</span></template></el-table-column>
          <el-table-column label="雷达信号" min-width="130"><template #default="{ row }"><span class="signal-tag">{{ row.signal }}</span></template></el-table-column>
        </el-table></div>
      </section>

      <section class="two-col top-gap bottom-gap">
        <article class="panel-card">
          <SectionHeader eyebrow="CORE WATCH · 07" title="核心观察列表" caption="我的关注池">
            <el-button text type="primary" :icon="Setting" @click="ElMessage.info('关注池编辑功能即将上线')">管理</el-button>
          </SectionHeader>
          <div v-if="filteredWatchlist.length" class="watch-list">
            <div v-for="item in filteredWatchlist" :key="item.code" class="watch-row" @click="ElMessage.info(`${item.name} · ${item.status}`)">
              <button class="star-button" :aria-label="item.starred ? '取消关注' : '关注'" @click.stop="toggleStar(item.code)"><Star :fill="item.starred ? '#f4b740' : 'none'" :color="item.starred ? '#f4b740' : '#9aa8bc'" /></button>
              <div class="watch-name"><b>{{ item.name }}</b><small>{{ item.code }} · {{ item.type }}</small></div>
              <b class="watch-price">{{ item.price }}</b><span :class="item.change >= 0 ? 'up-text' : 'down-text'">{{ item.change > 0 ? '+' : '' }}{{ item.change }}%</span><span class="watch-flow">{{ item.flow }}</span><span class="status-tag">{{ item.status }}</span>
            </div>
          </div>
          <el-empty v-else description="未找到匹配标的" :image-size="60" />
        </article>
        <article class="panel-card ai-card">
          <SectionHeader eyebrow="AI MARKET BRIEF · 08" title="AI 市场简报" caption="基于数据交叉验证生成" />
          <div class="ai-status"><span class="ai-orb"><DataAnalysis /></span><div><b>{{ aiBrief.status }}</b><small>生成于 {{ aiBrief.generatedAt }}</small></div><span class="confidence">置信度 78%</span></div>
          <p class="ai-summary">{{ aiBrief.summary }}</p>
          <div class="ai-actions"><div v-for="(action, index) in aiBrief.actions" v-show="showBrief || index === 0" :key="action"><span>0{{ index + 1 }}</span>{{ action }}</div></div>
          <button class="text-link" @click="showBrief = !showBrief">{{ showBrief ? '收起简报' : '展开完整简报' }} <ArrowDown v-if="!showBrief" /><ArrowUp v-else /></button>
        </article>
      </section>
    </main>
    <footer><span>RADAR OS / A-SHARE MARKET INTELLIGENCE</span><span><Calendar /> 数据锚点：2026/08/10 收盘后 · Mock 数据演示</span><span>仅供研究参考，不构成投资建议</span></footer>
  </div>
</template>
