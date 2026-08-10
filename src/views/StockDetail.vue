<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ArrowLeft, Star } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import * as echarts from 'echarts'
import ChartPanel from '../components/ChartPanel.vue'
import SectionHeader from '../components/SectionHeader.vue'
import { searchStocks, type StockSearchResult } from '../services/stockSearch'
import { fetchStockDetail, type MinutePoint, type StockDetail } from '../services/stockDetail'
import { fetchStockAnalysis, type StockAnalysis } from '../services/stockAnalysis'
import { useWatchlistStore } from '../stores/watchlist'

const route = useRoute()
const router = useRouter()
const watchlistStore = useWatchlistStore()

const code = computed(() => String(route.params.code ?? '').toUpperCase())
const quote = ref<StockSearchResult | null>(null)
const detail = ref<StockDetail | null>(null)
const loading = ref(true)
const notFound = ref(false)
const detailError = ref('')
const analysis = ref<StockAnalysis | null>(null)
const analysisLoading = ref(false)
const analysisError = ref('')

const marketLabel = computed(() => {
  const m = detail.value?.market ?? ''
  if (m === 'sh') return '沪市'
  if (m === 'sz') return '深市'
  if (m === 'bj') return '北交所'
  const qm = quote.value?.market
  return qm ? (String(qm).toUpperCase() === 'SH' ? '沪市' : '深市') : ''
})

/** 今日行情九宫格 */
interface QuoteCell {
  label: string
  value: string
  tone: string
}

const quoteItems = computed<QuoteCell[]>(() => {
  const q = detail.value?.quote
  if (!q) return []
  const prev = q.prevClose
  const toneOf = (v: number | null): string => {
    if (v === null || v === undefined || prev === null || prev === undefined) return ''
    if (v > prev) return 'up-text'
    if (v < prev) return 'down-text'
    return ''
  }
  const fmt = (v: number | null, digits = 2): string => (v === null || v === undefined ? '--' : v.toFixed(digits))
  const yi = (v: number | null): string => (v === null || v === undefined ? '--' : `${v.toFixed(2)} 亿`)
  const wanHand = (v: number | null): string => (v === null || v === undefined ? '--' : `${(v / 10000).toFixed(2)} 万手`)
  const pct = (v: number | null): string => (v === null || v === undefined ? '--' : `${v.toFixed(2)}%`)
  const pe = (v: number | null): string => (v === null || v === undefined || v <= 0 ? '--' : fmt(v))
  const time = q.time ? `${q.time.slice(8, 10)}:${q.time.slice(10, 12)}:${q.time.slice(12, 14)}` : '--'
  return [
    { label: '今开', value: fmt(q.open), tone: toneOf(q.open) },
    { label: '昨收', value: fmt(q.prevClose), tone: '' },
    { label: '最高', value: fmt(q.high), tone: toneOf(q.high) },
    { label: '最低', value: fmt(q.low), tone: toneOf(q.low) },
    { label: '成交量', value: wanHand(q.volumeHand), tone: '' },
    { label: '成交额', value: yi(q.amountWan ? q.amountWan / 10000 : null), tone: '' },
    { label: '换手率', value: pct(q.turnoverRate), tone: '' },
    { label: '量比', value: fmt(q.volumeRatio), tone: '' },
    { label: '振幅', value: pct(q.amplitude), tone: '' },
    { label: '均价', value: fmt(q.avgPrice), tone: toneOf(q.avgPrice) },
    { label: '市盈率(动)', value: pe(q.pe), tone: '' },
    { label: '市盈率(TTM)', value: pe(q.peTTM), tone: '' },
    { label: '市净率', value: pe(q.pb), tone: '' },
    { label: '总市值', value: yi(q.totalMcYi), tone: '' },
    { label: '流通市值', value: yi(q.floatMcYi), tone: '' },
    { label: '涨停价', value: fmt(q.limitUp), tone: '' },
    { label: '跌停价', value: fmt(q.limitDown), tone: '' },
    { label: '外盘', value: wanHand(q.outer), tone: '' },
    { label: '内盘', value: wanHand(q.inner), tone: '' },
    { label: '更新时间', value: time, tone: '' }
  ]
})

/** 分时走势图：价格线 + 均价线 + 分时成交量 */
function buildMinuteOption(detailData: StockDetail | null): echarts.EChartsOption {
  if (!detailData || !detailData.minute.rows.length) return {}
  const rows: MinutePoint[] = detailData.minute.rows
  const prevClose = detailData.quote.prevClose ?? rows[0].price
  const up = (detailData.quote.change ?? 0) >= 0
  const times = rows.map((r) => r.time)
  const prices = rows.map((r) => r.price)
  const avgs = rows.map((r) => r.avg)
  const vols = rows.map((r) => r.volume)
  const maxVol = Math.max(...vols, 1)
  const mainColor = up ? '#ef626e' : '#14a57b'
  const axisLabelStep = Math.max(1, Math.floor(times.length / 4))

  const option = {
    animation: false,
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'cross', label: { backgroundColor: '#7d8ba1' } },
      formatter: (params: any[]) => {
        const idx = params?.[0]?.dataIndex ?? 0
        const p = rows[idx]
        if (!p) return ''
        const chg = prevClose ? p.price - prevClose : 0
        const pct = prevClose ? (chg / prevClose) * 100 : 0
        return [
          `<b>${p.time}</b>`,
          `价格：${p.price.toFixed(2)}　<span style="color:${chg >= 0 ? '#ef626e' : '#14a57b'}">${chg >= 0 ? '+' : ''}${chg.toFixed(2)} (${pct >= 0 ? '+' : ''}${pct.toFixed(2)}%)</span>`,
          `均价：${p.avg.toFixed(2)}`,
          `成交量：${p.volume.toLocaleString()} 手`,
          `成交额：${(p.amount / 10000).toFixed(1)} 万`
        ].join('<br/>')
      }
    },
    axisPointer: { link: [{ xAxisIndex: 'all' }] },
    grid: [
      { left: 60, right: 18, top: 30, height: '50%' },
      { left: 60, right: 18, top: '72%', height: '16%' }
    ],
    xAxis: [
      {
        type: 'category',
        data: times,
        boundaryGap: false,
        axisLine: { lineStyle: { color: '#dbe4f0' } },
        axisTick: { show: false },
        axisLabel: { color: '#7d8ba1', fontSize: 10, interval: axisLabelStep },
        splitLine: { show: false }
      },
      {
        type: 'category',
        gridIndex: 1,
        data: times,
        boundaryGap: true,
        axisLabel: { show: false },
        axisTick: { show: false },
        axisLine: { show: false },
        splitLine: { show: false }
      }
    ],
    yAxis: [
      {
        scale: true,
        splitNumber: 4,
        splitLine: { lineStyle: { color: '#eef3f9' } },
        axisLabel: { color: '#7d8ba1', fontSize: 10, formatter: (v: number) => v.toFixed(2) }
      },
      {
        gridIndex: 1,
        splitNumber: 2,
        splitLine: { show: false },
        axisLabel: { color: '#a4b1c4', fontSize: 9, formatter: (v: number) => `${Math.round(v / 10000)}万` }
      }
    ],
    series: [
      {
        name: '价格',
        type: 'line',
        data: prices,
        symbol: 'none',
        lineStyle: { width: 1.5, color: mainColor },
        itemStyle: { color: mainColor },
        areaStyle: {
          color: {
            type: 'linear',
            x: 0,
            y: 0,
            x2: 0,
            y2: 1,
            colorStops: [
              { offset: 0, color: up ? 'rgba(239,98,110,.16)' : 'rgba(20,165,123,.16)' },
              { offset: 1, color: 'rgba(255,255,255,0)' }
            ]
          }
        },
        markLine: {
          symbol: 'none',
          label: {
            formatter: `昨收 ${prevClose.toFixed(2)}`,
            position: 'insideEndTop',
            color: '#9aa8bc',
            fontSize: 10
          },
          lineStyle: { color: '#b8c4d6', type: 'dashed', width: 1 },
          data: [{ yAxis: prevClose }]
        }
      },
      {
        name: '均价',
        type: 'line',
        data: avgs,
        symbol: 'none',
        lineStyle: { width: 1, color: '#f7a81b', type: 'dashed' },
        itemStyle: { color: '#f7a81b' }
      },
      {
        name: '成交量',
        type: 'bar',
        xAxisIndex: 1,
        yAxisIndex: 1,
        data: vols.map((v, i) => ({
          value: v,
          itemStyle: { color: rows[i].price >= prevClose ? 'rgba(239,98,110,.55)' : 'rgba(20,165,123,.55)' }
        })),
        barWidth: '55%'
      }
    ]
  }
  return option as echarts.EChartsOption
}

const minuteOption = computed<echarts.EChartsOption>(() => buildMinuteOption(detail.value))

/** 走势分析：均线 chips（MA 高于现价 = 承压 → 绿） */
const maItems = computed(() => {
  const ma = analysis.value?.trend.ma
  const price = analysis.value?.price
  if (!ma) return []
  const list = [
    { key: 'ma5', label: 'MA5', value: ma.ma5 },
    { key: 'ma10', label: 'MA10', value: ma.ma10 },
    { key: 'ma20', label: 'MA20', value: ma.ma20 },
    { key: 'ma60', label: 'MA60', value: ma.ma60 }
  ]
  return list.map((it) => ({
    ...it,
    value: it.value != null ? it.value.toFixed(2) : '--',
    className: price != null && it.value != null ? (it.value >= price ? 'down-text' : 'up-text') : ''
  }))
})

const trendTone = computed(() => {
  const d = analysis.value?.trend.direction
  if (d === 'up') return 'up-text'
  if (d === 'down') return 'down-text'
  return 'flat-text'
})

function horizonTone(direction: 'up' | 'down' | 'range'): string {
  if (direction === 'up') return 'h-up'
  if (direction === 'down') return 'h-down'
  return 'h-range'
}

/** RSI(14) 展示 */
const rsiInfo = computed(() => {
  const r = analysis.value?.indicators?.rsi14
  if (r === null || r === undefined) return { value: '--', label: '', cls: '' }
  const label = r >= 70 ? '超买' : r >= 55 ? '偏强' : r >= 45 ? '中性' : r >= 30 ? '偏弱' : '超卖'
  const cls = r >= 70 ? 'flat-text' : r >= 55 ? 'up-text' : r >= 45 ? 'flat-text' : r >= 30 ? 'down-text' : 'up-text'
  return { value: r.toFixed(1), label, cls }
})

/** MACD 展示 */
const macdInfo = computed(() => {
  const m = analysis.value?.indicators?.macd
  if (!m || m.dif === null || m.dea === null) return { text: '--', label: '', cls: '' }
  const cross = m.dif >= m.dea ? '金叉上方' : '死叉下方'
  const power = (m.hist ?? 0) >= 0 ? '红柱' : '绿柱'
  return { text: `DIF ${m.dif.toFixed(2)} / DEA ${m.dea.toFixed(2)}`, label: `${cross} · ${power}`, cls: (m.hist ?? 0) >= 0 ? 'up-text' : 'down-text' }
})

/** BOLL 展示 */
const bollInfo = computed(() => {
  const b = analysis.value?.indicators?.boll
  const price = analysis.value?.price
  if (!b || price === undefined) return { text: '--', label: '', cls: '' }
  const pos = b.up > b.low ? Math.round(((price - b.low) / (b.up - b.low)) * 100) : 50
  const label = pos >= 80 ? '上轨附近' : pos <= 20 ? '下轨附近' : '中轨运行'
  return { text: `${b.up.toFixed(2)} / ${b.mid.toFixed(2)} / ${b.low.toFixed(2)}`, label, cls: pos >= 80 ? 'flat-text' : pos <= 20 ? 'up-text' : 'flat-text' }
})

/** 量能 5/20 展示 */
const volInfo = computed(() => {
  const vr = analysis.value?.indicators?.volRatio
  if (vr === null || vr === undefined) return { text: '--', label: '', cls: '' }
  const label = vr >= 1.5 ? '显著放量' : vr >= 1.1 ? '温和放量' : vr <= 0.7 ? '明显缩量' : vr <= 0.9 ? '温和缩量' : '量能平稳'
  const cls = vr >= 1.5 ? 'flat-text' : vr >= 1.1 ? 'up-text' : 'down-text'
  return { text: `${vr.toFixed(2)}x`, label, cls }
})

/** K 线图：蜡烛 + MA5/10/20/60 + 支撑/压力标记 + 成交量 */
const hasKline = computed(() => Boolean(klineOption.value?.series))

const klineOption = computed<echarts.EChartsOption>(() => {
  const a = analysis.value
  if (!a?.kline?.length) return {}
  const rows = a.kline
  const dates = rows.map((r) => r.date)
  const candles = rows.map((r) => [r.open, r.close, r.low, r.high])
  const vols = rows.map((r) => r.volume)
  const maLine = (n: number): Array<number | null> => {
    const closes = rows.map((r) => r.close)
    return closes.map((_, i) => {
      if (i < n - 1) return null
      const slice = closes.slice(i - n + 1, i + 1)
      return Math.round((slice.reduce((x, y) => x + y, 0) / n) * 100) / 100
    })
  }
  const markLines: any[] = [
    ...(a.levels.resistance ?? []).map((lv) => ({ yAxis: lv.price, lineStyle: { color: '#ef626e', type: 'dashed', width: 1 }, label: { formatter: `压力 ${lv.label} ${lv.price.toFixed(2)}`, color: '#ef626e', position: 'insideEndTop', fontSize: 10 } })),
    ...(a.levels.support ?? []).map((lv) => ({ yAxis: lv.price, lineStyle: { color: '#14a57b', type: 'dashed', width: 1 }, label: { formatter: `支撑 ${lv.label} ${lv.price.toFixed(2)}`, color: '#14a57b', position: 'insideEndTop', fontSize: 10 } }))
  ]
  return {
    animation: false,
    tooltip: { trigger: 'axis', axisPointer: { type: 'cross' } },
    axisPointer: { link: [{ xAxisIndex: 'all' }] },
    grid: [
      { left: 62, right: 18, top: 18, height: '54%' },
      { left: 62, right: 18, top: '72%', height: '15%' }
    ],
    xAxis: [
      { type: 'category', data: dates, boundaryGap: true, axisLine: { lineStyle: { color: '#dbe4f0' } }, axisTick: { show: false }, axisLabel: { color: '#7d8ba1', fontSize: 10 }, splitLine: { show: false } },
      { type: 'category', gridIndex: 1, data: dates, axisLabel: { show: false }, axisTick: { show: false }, axisLine: { show: false }, splitLine: { show: false } }
    ],
    yAxis: [
      { scale: true, splitNumber: 4, splitLine: { lineStyle: { color: '#eef3f9' } }, axisLabel: { color: '#7d8ba1', fontSize: 10 } },
      { gridIndex: 1, splitNumber: 2, splitLine: { show: false }, axisLabel: { show: false } }
    ],
    dataZoom: [{ type: 'inside', xAxisIndex: [0, 1], start: 50, end: 100 }],
    series: [
      { name: 'K线', type: 'candlestick', data: candles, itemStyle: { color: '#ef626e', color0: '#14a57b', borderColor: '#ef626e', borderColor0: '#14a57b' }, markLine: { symbol: 'none', data: markLines } },
      { name: 'MA5', type: 'line', data: maLine(5), symbol: 'none', lineStyle: { width: 1, color: '#f7a81b' } },
      { name: 'MA10', type: 'line', data: maLine(10), symbol: 'none', lineStyle: { width: 1, color: '#1677ff' } },
      { name: 'MA20', type: 'line', data: maLine(20), symbol: 'none', lineStyle: { width: 1, color: '#9b59b6' } },
      { name: 'MA60', type: 'line', data: maLine(60), symbol: 'none', lineStyle: { width: 1, color: '#5a6b7f' } },
      { name: '成交量', type: 'bar', xAxisIndex: 1, yAxisIndex: 1, data: vols.map((v, i) => ({ value: v, itemStyle: { color: candles[i][1] >= candles[i][0] ? 'rgba(239,98,110,.5)' : 'rgba(20,165,123,.5)' } })), barWidth: '55%' }
    ]
  }
})

async function loadQuote(): Promise<void> {
  loading.value = true
  notFound.value = false
  detailError.value = ''
  try {
    const results = await searchStocks(code.value)
    // 同代码多标的时优先 A 股 > ETF/基金 > 指数（避免 000021 命中 180治理 指数）
    const matches = results.filter((r) => r.code.toUpperCase() === code.value)
    quote.value = matches.find((r) => r.type === 'AStock') ?? matches.find((r) => r.type === 'Fund') ?? matches[0] ?? null
    notFound.value = !quote.value
    if (quote.value) {
      const market = String(quote.value.market ?? '').toLowerCase()
      analysisLoading.value = true
      analysisError.value = ''
      try {
        detail.value = await fetchStockDetail(code.value, market)
      } catch (error) {
        detailError.value = `行情/分时加载失败：${error instanceof Error ? error.message : 'unavailable'}`
      }
      // 支撑/压力 + 走势分析：失败不影响行情展示
      try {
        analysis.value = await fetchStockAnalysis(code.value, { market, name: quote.value.name })
      } catch (error) {
        analysisError.value = `支撑位/走势分析暂不可用：${error instanceof Error ? error.message : 'unavailable'}`
      } finally {
        analysisLoading.value = false
      }
    }
  } catch {
    // 搜索不可用时回退观察池
    const watch = watchlistStore.items.find((item) => item.code.toUpperCase() === code.value)
    if (watch) {
      quote.value = {
        code: watch.code,
        name: watch.name,
        type: watch.type === 'ETF' ? 'Fund' : 'AStock',
        quoteId: watch.code,
        price: Number(watch.price) || null,
        change: watch.change,
        amount: null,
        market: ''
      }
      try {
        detail.value = await fetchStockDetail(code.value)
      } catch (error) {
        detailError.value = `行情/分时加载失败：${error instanceof Error ? error.message : 'unavailable'}`
      }
    } else {
      notFound.value = true
    }
  } finally {
    loading.value = false
  }
}

function addToWatch(): void {
  if (!quote.value) return
  const type = quote.value.type === 'Fund' ? 'ETF' : '股票'
  const ok = watchlistStore.add({
    code: quote.value.code,
    name: quote.value.name,
    type,
    price: quote.value.price != null ? quote.value.price.toFixed(2) : '--',
    change: quote.value.change ?? 0,
    flow: '--',
    status: '观察'
  })
  ElMessage.success(ok ? '已加入观察池' : '已在观察池中')
}

onMounted(() => {
  void loadQuote()
})
</script>

<template>
  <main class="detail-main">
    <button class="back-link" @click="router.back()"><ArrowLeft /> 返回市场总览</button>

    <section class="panel-card detail-card">
      <div class="detail-head">
        <div>
          <div class="eyebrow">STOCK TRACKING · 个股追踪</div>
          <h2 class="detail-title">{{ quote?.name ?? code }} <span class="detail-code">{{ code }}</span></h2>
          <p class="detail-hint">实时行情 · 支撑压力 · 走势分析 · 今日分时 · 估值指标（腾讯财经）</p>
        </div>
        <div v-if="quote" class="detail-quote">
          <div class="detail-price-wrap">
            <b :class="(detail?.quote.change ?? 0) >= 0 ? 'up-text' : 'down-text'">{{ detail?.quote.price ?? quote.price ?? '--' }}</b>
            <span :class="(detail?.quote.change ?? 0) >= 0 ? 'up-text' : 'down-text'">
              {{ (detail?.quote.changePct ?? quote.change ?? 0) > 0 ? '+' : '' }}{{ detail?.quote.changePct ?? quote.change ?? '--' }}%
            </span>
            <span class="detail-chg" :class="(detail?.quote.change ?? 0) >= 0 ? 'up-text' : 'down-text'">
              {{ (detail?.quote.change ?? 0) > 0 ? '+' : '' }}{{ detail?.quote.change ?? '--' }}
            </span>
          </div>
          <el-button type="primary" size="small" :icon="Star" @click="addToWatch">加入观察池</el-button>
        </div>
      </div>
      <el-empty v-if="notFound" description="未找到该标的，请确认代码" :image-size="70" />
      <div v-else class="detail-body">
        <el-skeleton :loading="loading" animated :rows="6" />
        <div v-if="!loading && quote" class="detail-tags">
          <span class="status-tag">{{ quote.type === 'Fund' ? 'ETF/基金' : quote.type === 'Index' ? '指数' : 'A股' }}</span>
          <span v-if="marketLabel" class="status-tag">{{ marketLabel }}</span>
          <span class="status-tag">来源：{{ quote.market ? '腾讯财经' : '观察池' }}</span>
          <span v-if="detail?.minute.date" class="status-tag">交易日期 {{ detail.minute.date }}</span>
        </div>
        <p v-if="detailError" class="detail-error">{{ detailError }}</p>
      </div>
    </section>

    <section v-if="detail" class="panel-card top-gap">
      <SectionHeader eyebrow="REAL-TIME QUOTE · 实时行情" title="今日行情" caption="开盘 / 收盘 / 最高 / 最低 / 量价 / 估值" />
      <div class="quote-grid">
        <div v-for="item in quoteItems" :key="item.label" class="quote-cell">
          <span class="quote-label">{{ item.label }}</span>
          <b :class="item.tone">{{ item.value }}</b>
        </div>
      </div>
    </section>

    <section v-if="detail" class="panel-card top-gap">
      <SectionHeader eyebrow="KEY LEVELS · 支撑压力" title="支撑位 / 压力位" caption="基于 120 日 K 线 · MA / 枢轴 / 高低点" />
      <el-skeleton v-if="analysisLoading" :rows="3" animated />
      <p v-else-if="analysisError" class="detail-error">{{ analysisError }}</p>
      <div v-else-if="analysis" class="level-board">
        <div class="level-col">
          <h4>支撑位</h4>
          <div v-for="(lv, i) in analysis.levels.support" :key="lv.label + i" class="level-row">
            <span class="level-no">S{{ i + 1 }}</span>
            <div class="level-info"><b>{{ lv.price.toFixed(2) }}</b><small>{{ lv.label }}</small></div>
            <span class="level-dist down-text">{{ lv.distancePct.toFixed(1) }}%</span>
            <span class="strength-tag" :class="'s-' + lv.strength">{{ lv.strength }}</span>
          </div>
          <div v-if="!analysis.levels.support.length" class="level-empty">暂无支撑位</div>
        </div>
        <div class="level-cur">
          <small>当前价</small>
          <b :class="(detail.quote.change ?? 0) >= 0 ? 'up-text' : 'down-text'">{{ analysis.price.toFixed(2) }}</b>
          <em>{{ analysis.date }}</em>
        </div>
        <div class="level-col">
          <h4>压力位</h4>
          <div v-for="(lv, i) in analysis.levels.resistance" :key="lv.label + i" class="level-row">
            <span class="level-no">R{{ i + 1 }}</span>
            <div class="level-info"><b>{{ lv.price.toFixed(2) }}</b><small>{{ lv.label }}</small></div>
            <span class="level-dist up-text">+{{ lv.distancePct.toFixed(1) }}%</span>
            <span class="strength-tag" :class="'s-' + lv.strength">{{ lv.strength }}</span>
          </div>
          <div v-if="!analysis.levels.resistance.length" class="level-empty">暂无压力位</div>
        </div>
      </div>
    </section>

    <section v-if="detail" class="panel-card top-gap">
      <SectionHeader eyebrow="TREND & AI · 走势分析" title="走势分析" caption="K线趋势 + 技术指标 + 支撑压力 + 智能诊断" />
      <el-skeleton v-if="analysisLoading" :rows="3" animated />
      <p v-else-if="analysisError" class="detail-error">{{ analysisError }}</p>
      <div v-else-if="analysis" class="trend-board">
        <div class="trend-head">
          <div class="trend-score">
            <span>趋势评分</span>
            <strong :class="trendTone">{{ analysis.trend.score }}</strong>
            <em :class="trendTone">{{ analysis.trend.label }}</em>
          </div>
          <div class="trend-ma">
            <div v-for="m in maItems" :key="m.key" class="ma-chip">
              <span>{{ m.label }}</span>
              <b :class="m.className">{{ m.value }}</b>
            </div>
          </div>
        </div>
        <div v-if="analysis.horizons?.length" class="horizon-row">
          <div v-for="h in analysis.horizons" :key="h.horizon" class="horizon-chip" :class="horizonTone(h.direction)">
            <span>{{ h.horizon }}（{{ h.label }}）</span>
            <b>{{ h.score ?? '--' }}</b>
            <em>{{ h.trendLabel }}</em>
          </div>
        </div>
        <div v-if="hasKline" class="kline-chart">
          <ChartPanel :option="klineOption" :height="330" />
        </div>
        <div class="indicator-row">
          <div class="indicator-chip"><span>RSI(14)</span><b :class="rsiInfo.cls">{{ rsiInfo.value }}</b><em :class="rsiInfo.cls">{{ rsiInfo.label }}</em></div>
          <div class="indicator-chip"><span>MACD</span><b :class="macdInfo.cls">{{ macdInfo.text }}</b><em :class="macdInfo.cls">{{ macdInfo.label }}</em></div>
          <div class="indicator-chip"><span>BOLL 上/中/下</span><b :class="bollInfo.cls">{{ bollInfo.text }}</b><em :class="bollInfo.cls">{{ bollInfo.label }}</em></div>
          <div class="indicator-chip"><span>量能 5/20</span><b :class="volInfo.cls">{{ volInfo.text }}</b><em :class="volInfo.cls">{{ volInfo.label }}</em></div>
        </div>
        <ul class="trend-notes">
          <li v-for="(note, i) in analysis.trend.notes" :key="i">{{ note }}</li>
        </ul>
        <div v-if="analysis.ai" class="ai-box">
          <div class="ai-box-head">
            <span class="ai-tag">AI 诊断 · {{ analysis.ai.providerName || analysis.ai.provider }}</span>
            <small>{{ analysis.ai.model }}</small>
          </div>
          <p>{{ analysis.ai.text }}</p>
          <p class="ai-disclaimer">以上内容由大模型生成，仅供参考，不构成投资建议。</p>
        </div>
        <div v-else class="rule-box">
          <p>{{ analysis.summary }}</p>
          <p class="ai-disclaimer">当前为规则化分析；在 Netlify 配置 LLM_API_KEY 后可启用 AI 诊断。</p>
        </div>
      </div>
    </section>

    <section v-if="detail" class="panel-card top-gap">
      <SectionHeader eyebrow="INTRADAY CHART · 分时走势" title="今日分时" caption="价格 / 均价线 / 分时成交量" />
      <div class="minute-chart">
        <el-empty v-if="!detail.minute.trading" description="当前非交易时段或无分时数据" :image-size="60" />
        <ChartPanel v-else :option="minuteOption" :height="430" />
      </div>
    </section>
  </main>
</template>

<style scoped>
.detail-price-wrap {
  display: flex;
  align-items: baseline;
  gap: 10px;
}
.detail-chg {
  font-size: 13px;
  color: #7d8ba1;
}
.detail-error {
  margin: 14px 0 0;
  color: #d25f5f;
  font-size: 13px;
}
.quote-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(128px, 1fr));
  gap: 12px;
}
.quote-cell {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 14px 16px;
  border: 1px solid var(--line);
  border-radius: 12px;
  background: #fafcff;
}
.quote-label {
  color: #8b98aa;
  font-size: 12px;
}
.quote-cell b {
  color: #1c283d;
  font-size: 16px;
  font-weight: 600;
}
.minute-chart {
  margin-top: 4px;
}
.level-board {
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  gap: 22px;
  align-items: stretch;
  margin-top: 6px;
}
.level-col {
  min-width: 0;
  padding: 14px 16px;
  border: 1px solid var(--line);
  border-radius: 14px;
  background: #fafcff;
}
.level-col h4 {
  margin: 0 0 6px;
  color: #55677f;
  font-size: 12px;
}
.level-row {
  display: grid;
  grid-template-columns: 26px 1fr auto auto;
  align-items: center;
  gap: 10px;
  padding: 8px 0;
  border-bottom: 1px dashed #edf1f6;
}
.level-row:last-child {
  border-bottom: 0;
}
.level-no {
  display: grid;
  width: 22px;
  height: 22px;
  place-items: center;
  border-radius: 6px;
  color: #fff;
  background: #b9c4d2;
  font-size: 10px;
  font-weight: 700;
}
.level-col:first-child .level-no {
  background: linear-gradient(135deg, #55b893, #14a57b);
}
.level-col:last-child .level-no {
  background: linear-gradient(135deg, #ff8f66, #ef626e);
}
.level-info b,
.level-info small {
  display: block;
}
.level-info b {
  color: #22304a;
  font-size: 14px;
}
.level-info small {
  margin-top: 2px;
  color: #9aa8bc;
  font-size: 10px;
}
.level-dist {
  font-size: 12px;
  font-weight: 700;
}
.strength-tag {
  padding: 2px 7px;
  border-radius: 100px;
  font-size: 10px;
  font-weight: 600;
}
.strength-tag.s-强 {
  color: #c2484f;
  background: #fff0f1;
}
.strength-tag.s-中 {
  color: #2478df;
  background: #edf5ff;
}
.strength-tag.s-弱 {
  color: #8b98aa;
  background: #f1f4f8;
}
.level-empty {
  padding: 14px 0;
  color: #a6b2c2;
  font-size: 12px;
  text-align: center;
}
.level-cur {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
  min-width: 130px;
  padding: 0 10px;
}
.level-cur small {
  color: #8b98aa;
  font-size: 11px;
}
.level-cur b {
  font-size: 30px;
  letter-spacing: -.02em;
}
.level-cur em {
  color: #a6b2c2;
  font-size: 10px;
  font-style: normal;
}
.trend-board {
  margin-top: 6px;
}
.trend-head {
  display: flex;
  align-items: center;
  gap: 26px;
  flex-wrap: wrap;
}
.trend-score span,
.trend-score strong,
.trend-score em {
  display: block;
}
.trend-score span {
  color: #8b98aa;
  font-size: 11px;
}
.trend-score strong {
  margin-top: 2px;
  font-size: 38px;
  line-height: 1;
  letter-spacing: -.03em;
}
.trend-score em {
  margin-top: 5px;
  font-size: 13px;
  font-style: normal;
  font-weight: 700;
}
.trend-ma {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}
.ma-chip {
  min-width: 74px;
  padding: 10px 13px;
  border: 1px solid var(--line);
  border-radius: 11px;
  background: #fafcff;
}
.ma-chip span,
.ma-chip b {
  display: block;
}
.ma-chip span {
  color: #8b98aa;
  font-size: 10px;
}
.ma-chip b {
  margin-top: 3px;
  font-size: 14px;
}
.trend-notes {
  display: grid;
  gap: 8px;
  margin: 16px 0 0;
  padding: 13px 15px;
  border: 1px solid #edf1f6;
  border-radius: 12px;
  background: #fafcff;
  list-style: none;
}
.trend-notes li {
  position: relative;
  padding-left: 14px;
  color: #52627a;
  font-size: 12px;
  line-height: 1.6;
}
.trend-notes li::before {
  content: '';
  position: absolute;
  top: 7px;
  left: 2px;
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: var(--blue);
}
.ai-box,
.rule-box {
  margin-top: 14px;
  padding: 14px 16px;
  border-radius: 13px;
}
.ai-box {
  border: 1px solid #d9e9ff;
  background: linear-gradient(145deg, #f2f8ff, #fbfdff);
}
.ai-box-head {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 8px;
}
.ai-tag {
  padding: 3px 9px;
  border-radius: 100px;
  color: #2478df;
  background: #e4f0ff;
  font-size: 10px;
  font-weight: 700;
}
.ai-box-head small {
  color: #9aa8bc;
  font-size: 10px;
}
.ai-box p,
.rule-box p {
  margin: 0;
  color: #43546d;
  font-size: 13px;
  line-height: 1.85;
}
.rule-box {
  border: 1px solid #edf1f6;
  background: #fafcff;
}
.ai-disclaimer {
  margin-top: 8px !important;
  color: #a1aec0 !important;
  font-size: 10px !important;
}
@media (max-width: 760px) {
  .level-board {
    grid-template-columns: 1fr;
  }
  .level-cur {
    min-height: 70px;
  }
}
</style>