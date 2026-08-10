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
      try {
        detail.value = await fetchStockDetail(code.value, market)
      } catch (error) {
        detailError.value = `行情/分时加载失败：${error instanceof Error ? error.message : 'unavailable'}`
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
          <p class="detail-hint">实时行情 · 今日分时 · 量价分布 · 估值指标（腾讯财经）</p>
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
</style>